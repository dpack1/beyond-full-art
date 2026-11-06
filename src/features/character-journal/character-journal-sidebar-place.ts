import {
  journalOpenWidthPx,
  sheetShiftPx,
  sidebarEdge,
  type SidebarChrome,
} from '../../platform/dndbeyond/sidebar-chrome';
import {journalSidebarBox} from '../../platform/dndbeyond/sidebar-parity';
import {
  CHARACTER_SHEET_CLASS,
  CHARACTER_SHEET_INNER_CLASS,
  SIDEBAR_CLASS,
  SIDEBAR_CONTROLS_CLASS,
  SIDEBAR_PORTAL_CLASS,
} from '../../platform/dndbeyond/selectors';

const COLLAPSED_SIDEBAR_WIDTH = '1.5625rem';
const OPEN_SIDEBAR_WIDTH_PX = 200;
const SLIDE_MS = 150;

// One watch for the open note. The sheet can replace this bar or clear its
// inline style while the note stays up.
let controlsWatch: MutationObserver | null = null;
let sheetShiftWatch: MutationObserver | null = null;
let hideTimer = 0;
let hideToken = 0;

export function beginJournalSidebarShow(root: HTMLElement): void {
  const opening = root.hidden || root.dataset.bfaJournalSlide === 'out';
  cancelJournalSidebarHide(root);
  if (opening) {
    root.dataset.bfaJournalSlide = 'in';
  }
  root.hidden = false;
}

export function cancelJournalSidebarHide(root: HTMLElement): void {
  hideToken += 1;
  const view = root.ownerDocument.defaultView;
  if (hideTimer !== 0) {
    view?.clearTimeout(hideTimer);
    hideTimer = 0;
  }
  if (root.dataset.bfaJournalSlide === 'out') {
    delete root.dataset.bfaJournalSlide;
  }
  root.inert = false;
  root.style.pointerEvents = '';
}

export function hideJournalSidebar(root: HTMLElement, onHidden?: () => void): void {
  const finish = (): void => {
    delete root.dataset.bfaJournalSlide;
    root.hidden = true;
    root.inert = false;
    root.style.pointerEvents = '';
    onHidden?.();
  };

  if (root.hidden) {
    onHidden?.();
    return;
  }

  const view = root.ownerDocument.defaultView;
  if (view === null || !motionAllowed(view)) {
    finish();
    return;
  }

  hideToken += 1;
  const token = hideToken;
  root.dataset.bfaJournalSlide = 'out';
  root.inert = true;
  root.style.pointerEvents = 'none';
  if (hideTimer !== 0) {
    view.clearTimeout(hideTimer);
  }
  hideTimer = view.setTimeout(() => {
    hideTimer = 0;
    if (token !== hideToken) {
      return;
    }
    finish();
  }, SLIDE_MS);
}

export function placeJournalSidebar(
    root: HTMLElement,
    dialog: HTMLElement,
    doc: Document,
    chrome: SidebarChrome,
): void {
  const frame = measuredSheetFrame(doc);
  const native = nativeSidebar(doc, root);
  const top = frame !== null ? frame.top : sidebarTopPx(doc, native);
  // A locked note parked on another tab must not Hide the sheet sidebar.
  // During the slide out the panel is still on screen, and the click that
  // opened the sheet sidebar would place() again and hide that bar.
  const yielding = root.dataset.bfaJournalYield === 'true';
  const slidingOut = root.dataset.bfaJournalSlide === 'out';
  if (!yielding && !slidingOut) {
    dismissNativeSidebar(native);
  }
  if (!slidingOut) {
    concealNativeSidebarControls(doc, root, true);
  }
  mountBesideNativePortal(root, doc);
  const box = journalSidebarBox({
    topPx: top,
    viewportHeight: doc.defaultView?.innerHeight ?? 800,
  });
  const viewportWidth = doc.defaultView?.innerWidth ?? 0;
  const edge = sidebarEdge({
    chrome,
    panelWidth: journalOpenWidthPx(viewportWidth),
    sheetWidth: frame?.width ?? null,
    viewportWidth,
  });
  root.dataset.bfaJournalAlign = chrome.alignment;
  if (!chrome.visible && root.dataset.bfaJournalSlide === 'in') {
    delete root.dataset.bfaJournalSlide;
  }
  watchSlide(root, dialog);
  dialog.style.position = box.position;
  dialog.style.top = box.top;
  dialog.style.right = edge.right;
  dialog.style.left = edge.left;
  dialog.style.width = chrome.visible ? box.width : COLLAPSED_SIDEBAR_WIDTH;
  dialog.style.height = box.height;
  dialog.style.zIndex = box.zIndex;
  applySheetShift(doc, sheetShiftPx(chrome, viewportWidth));
}

export function releaseJournalSheetShift(doc: Document): void {
  const sheet = sheetElement(doc);
  if (sheet !== null) {
    restoreSheetTransform(sheet);
  }
}

export function sidebarTopPx(doc: Document, native: HTMLElement | null): number {
  if (native !== null) {
    const rect = native.getBoundingClientRect();
    if (rect.width >= OPEN_SIDEBAR_WIDTH_PX && rect.height > OPEN_SIDEBAR_WIDTH_PX && rect.top < 400) {
      return rect.top;
    }
  }

  const styles = doc.defaultView?.getComputedStyle(doc.documentElement);
  const variable = styles?.getPropertyValue('--top-navigation-height').trim()
    || styles?.getPropertyValue('--ttui-site-nav-height').trim()
    || '';
  const parsed = lengthPx(variable, styles?.fontSize ?? '16px');
  if (parsed !== null) {
    return parsed + 6;
  }

  const header = doc.querySelector('header');
  if (header instanceof HTMLElement) {
    const bottom = header.getBoundingClientRect().bottom;
    if (bottom > 40 && bottom < 320) {
      return Math.round(bottom + 6);
    }
  }

  return 0;
}

export function dismissNativeSidebar(sidebar: HTMLElement | null): boolean {
  if (sidebar === null) {
    return false;
  }

  if (sidebar.getBoundingClientRect().width < OPEN_SIDEBAR_WIDTH_PX) {
    delete sidebar.dataset.bfaJournalHide;
    return false;
  }

  if (sidebar.dataset.bfaJournalHide === 'true') {
    return false;
  }

  const button = [...sidebar.querySelectorAll('button')].find((element) =>
    element.getAttribute('aria-label') === 'Hide sidebar');
  if (!(button instanceof HTMLElement)) {
    return false;
  }

  sidebar.dataset.bfaJournalHide = 'true';
  button.click();
  return true;
}

let sidebarWatch: MutationObserver | null = null;

export function stopNativeSidebarWatch(): void {
  sidebarWatch?.disconnect();
  sidebarWatch = null;
}

// Fires once when the sheet sidebar goes from narrow to open. A sidebar that
// is already open when the watch starts does not count: the note has been
// closing that one, and a leftover open frame should not take the note down.
export function whenNativeSidebarOpens(
    doc: Document,
    ours: HTMLElement,
    onOpen: () => void,
): void {
  stopNativeSidebarWatch();
  const view = doc.defaultView;
  if (view === null) {
    return;
  }

  const initial = nativeSidebar(doc, ours);
  let seenNarrow = initial === null
    || initial.getBoundingClientRect().width < OPEN_SIDEBAR_WIDTH_PX;
  let fired = false;
  const check = (): void => {
    if (fired) {
      return;
    }

    const current = nativeSidebar(doc, ours);
    const width = current?.getBoundingClientRect().width ?? 0;
    if (width < OPEN_SIDEBAR_WIDTH_PX) {
      seenNarrow = true;
      return;
    }

    if (!seenNarrow) {
      return;
    }

    fired = true;
    stopNativeSidebarWatch();
    onOpen();
  };

  const watchPortal = (): void => {
    const portal = nativePortal(doc, ours);
    if (portal === null) {
      return;
    }
    sidebarWatch?.observe(portal, {
      attributes: true,
      childList: true,
      subtree: true,
    });
  };
  sidebarWatch = new view.MutationObserver(() => {
    watchPortal();
    check();
  });
  if (doc.body !== null) {
    sidebarWatch.observe(doc.body, {childList: true});
  }
  watchPortal();
  check();
}

export function concealNativeSidebarControls(
    doc: Document,
    ours: HTMLElement,
    conceal: boolean,
): void {
  if (!conceal) {
    stopControlsWatch();
    restoreNativeControls(nativeControls(doc, ours));
    return;
  }

  // The collapsed strip stays on the page, Show included. Hide the whole
  // controls element so those buttons cannot be clicked while our bar is up.
  hideNativeControls(nativeControls(doc, ours));
  watchNativeControls(doc, ours);
}

function nativeControls(doc: Document, ours: HTMLElement): HTMLElement | null {
  const controls = nativePortal(doc, ours)
      ?.getElementsByClassName(SIDEBAR_CONTROLS_CLASS)
      .item(0);
  return controls instanceof HTMLElement ? controls : null;
}

function hideNativeControls(controls: HTMLElement | null): void {
  if (controls === null) {
    return;
  }

  if (controls.dataset.bfaJournalConcealed !== 'true') {
    const current = controls.style.display;
    controls.dataset.bfaJournalControlsDisplay = current === 'none' ? '' : current;
    controls.dataset.bfaJournalConcealed = 'true';
  }

  if (controls.style.display !== 'none') {
    controls.style.display = 'none';
  }
}

function restoreNativeControls(controls: HTMLElement | null): void {
  if (controls === null || controls.dataset.bfaJournalConcealed !== 'true') {
    return;
  }

  controls.style.display = controls.dataset.bfaJournalControlsDisplay ?? '';
  delete controls.dataset.bfaJournalConcealed;
  delete controls.dataset.bfaJournalControlsDisplay;
}

function watchNativeControls(doc: Document, ours: HTMLElement): void {
  const view = doc.defaultView;
  const portal = nativePortal(doc, ours);
  if (view === null || portal === null) {
    return;
  }

  if (controlsWatch === null) {
    controlsWatch = new view.MutationObserver(() => {
      const controls = nativeControls(doc, ours);
      hideNativeControls(controls);
      if (controls !== null) {
        controlsWatch?.observe(controls, {
          attributeFilter: ['class', 'style'],
          attributes: true,
        });
      }
    });
  }

  controlsWatch.observe(portal, {childList: true, subtree: true});
  const controls = nativeControls(doc, ours);
  if (controls !== null) {
    controlsWatch.observe(controls, {
      attributeFilter: ['class', 'style'],
      attributes: true,
    });
  }
}

function stopControlsWatch(): void {
  controlsWatch?.disconnect();
  controlsWatch = null;
}

function nativeSidebar(doc: Document, ours: HTMLElement): HTMLElement | null {
  const portal = nativePortal(doc, ours);
  if (portal === null) {
    return null;
  }

  const sidebar = [...portal.getElementsByClassName(SIDEBAR_CLASS)]
      .find((element) => element instanceof HTMLElement);
  return sidebar instanceof HTMLElement ? sidebar : null;
}

function mountBesideNativePortal(root: HTMLElement, doc: Document): void {
  const portal = nativePortal(doc, root);
  if (portal !== null) {
    if (portal.nextElementSibling !== root) {
      portal.after(root);
    }
    return;
  }

  if (root.parentElement !== doc.body) {
    doc.body.append(root);
  }
}

function nativePortal(doc: Document, ours: HTMLElement): HTMLElement | null {
  for (const portal of doc.getElementsByClassName(SIDEBAR_PORTAL_CLASS)) {
    if (portal instanceof HTMLElement && portal !== ours && !portal.contains(ours)) {
      return portal;
    }
  }

  return null;
}

function measuredSheetFrame(doc: Document): {top: number; width: number} | null {
  const inner = frameOf(doc.getElementsByClassName(CHARACTER_SHEET_INNER_CLASS).item(0));
  if (inner !== null) {
    return inner;
  }
  return frameOf(doc.getElementsByClassName(CHARACTER_SHEET_CLASS).item(0));
}

function frameOf(element: Element | null): {top: number; width: number} | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {top: rect.top, width: rect.width};
}

function motionAllowed(view: Window): boolean {
  if (typeof view.matchMedia !== 'function') {
    return false;
  }
  return !view.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function watchSlide(root: HTMLElement, dialog: HTMLElement): void {
  if (dialog.dataset.bfaJournalSlideBound === 'true') {
    return;
  }

  dialog.dataset.bfaJournalSlideBound = 'true';
  dialog.addEventListener('animationend', (event) => {
    if (event.target === dialog && root.dataset.bfaJournalSlide === 'in') {
      delete root.dataset.bfaJournalSlide;
    }
  });
}

function sheetElement(doc: Document): HTMLElement | null {
  // The artwork lives on the full-bleed sheet. Fixed mode on the real sheet
  // nudges only the centered column, so the art does not slide off and leave
  // a white strip. A fixture with no column still shifts the outer sheet.
  const column = doc.getElementsByClassName(CHARACTER_SHEET_INNER_CLASS).item(0);
  if (column instanceof HTMLElement) {
    return column;
  }
  const sheet = doc.getElementsByClassName(CHARACTER_SHEET_CLASS).item(0);
  return sheet instanceof HTMLElement ? sheet : null;
}

function applySheetShift(doc: Document, shiftPx: number): void {
  const sheet = sheetElement(doc);
  if (sheet === null) {
    stopSheetShiftWatch();
    return;
  }

  if (shiftPx === 0) {
    restoreSheetTransform(sheet);
    return;
  }

  if (sheet.dataset.bfaJournalSheetShift !== 'true') {
    sheet.dataset.bfaJournalSheetTransform = sheet.style.transform;
    sheet.dataset.bfaJournalSheetShift = 'true';
  }
  sheet.dataset.bfaJournalSheetShiftPx = String(shiftPx);
  writeSheetShift(sheet, true);
  watchSheetShift(sheet);
}

function writeSheetShift(sheet: HTMLElement, animate: boolean): void {
  const shiftPx = sheet.dataset.bfaJournalSheetShiftPx;
  if (shiftPx === undefined) {
    return;
  }

  const value = `translateX(${shiftPx}px)`;
  if (sheet.style.transform === value) {
    return;
  }

  // The sheet writes translateX(0px) on its own renders. Put the nudge back
  // without replaying the slide, or the column jitters on every update.
  if (!animate) {
    const previous = sheet.style.transition;
    sheet.style.transition = 'none';
    sheet.style.transform = value;
    sheet.ownerDocument.defaultView?.getComputedStyle(sheet).transform;
    if (previous === '') {
      sheet.style.removeProperty('transition');
    } else {
      sheet.style.transition = previous;
    }
    return;
  }

  sheet.style.transform = value;
}

function watchSheetShift(sheet: HTMLElement): void {
  const view = sheet.ownerDocument.defaultView;
  if (view === null) {
    return;
  }

  stopSheetShiftWatch();
  sheetShiftWatch = new view.MutationObserver(() => {
    if (sheet.dataset.bfaJournalSheetShift !== 'true') {
      return;
    }
    writeSheetShift(sheet, false);
  });
  sheetShiftWatch.observe(sheet, {
    attributeFilter: ['style'],
    attributes: true,
  });
}

function stopSheetShiftWatch(): void {
  sheetShiftWatch?.disconnect();
  sheetShiftWatch = null;
}

function restoreSheetTransform(sheet: HTMLElement): void {
  stopSheetShiftWatch();
  if (sheet.dataset.bfaJournalSheetShift !== 'true') {
    return;
  }

  sheet.style.transform = sheet.dataset.bfaJournalSheetTransform ?? '';
  delete sheet.dataset.bfaJournalSheetShift;
  delete sheet.dataset.bfaJournalSheetTransform;
  delete sheet.dataset.bfaJournalSheetShiftPx;
}

function lengthPx(value: string, fontSize: string): number | null {
  if (value.endsWith('px')) {
    const px = Number.parseFloat(value);
    return Number.isFinite(px) ? px : null;
  }

  if (value.endsWith('rem')) {
    const rem = Number.parseFloat(value);
    const base = Number.parseFloat(fontSize);
    return Number.isFinite(rem) && Number.isFinite(base) ? rem * base : null;
  }

  return null;
}
