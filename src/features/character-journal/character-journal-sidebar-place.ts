import {journalSidebarBox} from '../../platform/dndbeyond/sidebar-parity';
import {SIDEBAR_CLASS, SIDEBAR_PORTAL_CLASS} from '../../platform/dndbeyond/selectors';

const OPEN_SIDEBAR_WIDTH_PX = 200;

export function placeJournalSidebar(
    root: HTMLElement,
    dialog: HTMLElement,
    doc: Document,
): void {
  const native = nativeSidebar(doc, root);
  const top = sidebarTopPx(doc, native);
  dismissNativeSidebar(native);
  mountBesideNativePortal(root, doc);
  const box = journalSidebarBox({
    topPx: top,
    viewportHeight: doc.defaultView?.innerHeight ?? 800,
  });
  dialog.style.position = box.position;
  dialog.style.top = box.top;
  dialog.style.right = box.right;
  dialog.style.left = box.left;
  dialog.style.width = box.width;
  dialog.style.height = box.height;
  dialog.style.zIndex = box.zIndex;
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
