import type {SidebarChrome} from '../../platform/dndbeyond/sidebar-chrome';
import {
  SIDEBAR_BORDER_BG_CLASS,
  SIDEBAR_BORDER_BOTTOM_CLASS,
  SIDEBAR_BORDER_CLASS,
  SIDEBAR_BORDER_FILL_CLASS,
  SIDEBAR_BORDER_STROKE_CLASS,
  SIDEBAR_CALLOUT_CLASS,
  SIDEBAR_CLASS,
  SIDEBAR_CONTENT_CLASS,
  SIDEBAR_CONTROLS_CLASS,
  SIDEBAR_DARK_MODE_CLASS,
  SIDEBAR_FRAME_CLASS,
  SIDEBAR_GAP_CLASS,
  SIDEBAR_HEADER_CLASS,
  SIDEBAR_HEADER_PRIMARY_CLASS,
  SIDEBAR_HEADING_CLASS,
  SIDEBAR_HEADING_HASH_CLASS,
  SIDEBAR_HIDE_CLASS,
  SIDEBAR_LOCKED_CLASS,
  SIDEBAR_INNER_CLASS,
  SIDEBAR_MASK_CLASS,
  SIDEBAR_NAV_BUTTON_CLASS,
  SIDEBAR_NAV_CLASS,
  SIDEBAR_NAV_LABEL_CLASS,
  SIDEBAR_NOTE_PANE_CLASS,
  SIDEBAR_OVERLAY_CLASS,
  SIDEBAR_PANE_CLASS,
  SIDEBAR_PLACEMENT_CLASS,
  SIDEBAR_PORTAL_CLASS,
  SIDEBAR_SURFACE_DARK_CLASS,
  SIDEBAR_SWIPEABLE_CLASS,
  SIDEBAR_TOOLTIP_CLASS,
  SIDEBAR_VISIBILITY_CLASS,
  SIDEBAR_WRAPPER_CLASS,
} from '../../platform/dndbeyond/selectors';
import {bindSidebarChrome} from './character-journal-sidebar-chrome';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface JournalSidebarShell {
  body: HTMLElement;
  callout: HTMLElement;
  chrome(): SidebarChrome;
  closeButton: HTMLButtonElement;
  collapse(): void;
  dialog: HTMLElement;
  expand(): void;
  fitViewport(viewportWidth: number): void;
  footer: HTMLElement;
  nav: HTMLElement;
  nextButton: HTMLButtonElement;
  prevButton: HTMLButtonElement;
  root: HTMLElement;
  scroller: HTMLElement;
  setDark(on: boolean): void;
  setOnChromeChange(listener: () => void): void;
  title: HTMLElement;
}

export function createJournalSidebar(doc: Document): JournalSidebarShell {
  const root = doc.createElement('div');
  root.className = `${SIDEBAR_PORTAL_CLASS} bfa-journal-panel`;
  root.dataset.bfaJournalPanel = 'true';
  root.hidden = true;
  root.tabIndex = -1;

  const mask = doc.createElement('div');
  mask.className = SIDEBAR_MASK_CLASS;
  const swipeHost = doc.createElement('div');
  const swipeable = doc.createElement('div');
  swipeable.className = SIDEBAR_SWIPEABLE_CLASS;

  const dialog = doc.createElement('div');
  dialog.className = `${SIDEBAR_CLASS} ${SIDEBAR_FRAME_CLASS}`;
  dialog.setAttribute('role', 'dialog');
  dialog.style.position = 'fixed';
  dialog.style.left = 'auto';
  dialog.style.right = '0px';
  dialog.style.width = 'min(400px, calc(100vw - 36px))';
  dialog.style.zIndex = '10001';

  const inner = doc.createElement('div');
  inner.className = SIDEBAR_INNER_CLASS;
  inner.style.position = 'absolute';
  inner.style.inset = '0px';
  const controls = doc.createElement('div');
  controls.className = SIDEBAR_CONTROLS_CLASS;
  controls.style.display = 'flex';
  controls.style.flex = '0 0 auto';
  controls.dataset.bfaJournalNativeChrome = 'true';
  const visibility = doc.createElement('div');
  visibility.className = SIDEBAR_VISIBILITY_CLASS;
  const closeButton = iconButton(doc, 'Hide sidebar', SIDEBAR_HIDE_CLASS, hideIcon(doc));
  closeButton.classList.add('bfa-journal-close');
  closeButton.dataset.bfaJournalClose = 'true';
  const hideTip = tooltip(doc, closeButton);
  const unlockButton = iconButton(doc, 'Unlocked', '', lockIcon(doc));
  const unlockTip = tooltip(doc, unlockButton);
  visibility.append(hideTip, unlockTip);
  const overlayButton = iconButton(doc, 'Set to overlay position', '', overlayIcon(doc));
  const fixedButton = iconButton(doc, 'Set to fixed position', '', fixedIcon(doc));
  const overlay = doc.createElement('div');
  overlay.className = SIDEBAR_OVERLAY_CLASS;
  overlay.append(tooltip(doc, overlayButton), tooltip(doc, fixedButton));
  const alignLeft = iconButton(doc, 'Align Left', '', alignLeftIcon(doc));
  const alignRight = iconButton(doc, 'Align Right', '', alignRightIcon(doc));
  const placement = doc.createElement('div');
  placement.className = SIDEBAR_PLACEMENT_CLASS;
  placement.append(tooltip(doc, alignLeft), tooltip(doc, alignRight));
  const lockButton = iconButton(doc, 'Locked', SIDEBAR_LOCKED_CLASS, lockedIcon(doc));
  lockButton.hidden = true;
  controls.append(lockButton, visibility, overlay, placement);

  const pane = doc.createElement('div');
  pane.className = SIDEBAR_PANE_CLASS;
  pane.style.position = 'relative';
  pane.style.display = 'flex';
  pane.style.flexDirection = 'column';
  pane.style.flex = '1 1 auto';
  pane.style.minHeight = '0px';
  const border = borderSvg(doc, false);
  border.classList.add('bfa-journal-frame');
  const gap = doc.createElement('div');
  gap.className = `${SIDEBAR_GAP_CLASS} bfa-journal-frame`;
  const content = doc.createElement('div');
  content.className = SIDEBAR_CONTENT_CLASS;
  content.dataset.scrollableContainer = 'true';
  const nav = doc.createElement('nav');
  nav.className = SIDEBAR_NAV_CLASS;
  nav.dataset.bfaJournalNativeChrome = 'true';
  nav.setAttribute('aria-label', 'Notes');
  const prevButton = navButton(doc, 'Prev', true);
  const nextButton = navButton(doc, 'Next', false);
  nav.append(prevButton, nextButton);
  const wrapper = doc.createElement('div');
  wrapper.className = `${SIDEBAR_WRAPPER_CLASS} bfa-journal-panel-wrapper`;
  const note = doc.createElement('div');
  note.className = `${SIDEBAR_NOTE_PANE_CLASS} bfa-journal-note-pane`;
  note.dataset.bfaJournalNativeChrome = 'true';
  const header = doc.createElement('header');
  header.className = SIDEBAR_HEADER_CLASS;
  const parentSlot = doc.createElement('div');
  const primary = doc.createElement('div');
  primary.className = `${SIDEBAR_HEADER_PRIMARY_CLASS} bfa-journal-header-primary`;
  const title = doc.createElement('h1');
  title.className = `${SIDEBAR_HEADING_CLASS} ${SIDEBAR_HEADING_HASH_CLASS} bfa-journal-panel-title`;
  const callout = doc.createElement('div');
  callout.className = `${SIDEBAR_CALLOUT_CLASS} bfa-journal-panel-actions`;
  primary.append(title, callout);
  header.append(parentSlot, primary);
  const body = doc.createElement('div');
  body.className = 'bfa-journal-panel-body';
  const footer = doc.createElement('footer');
  footer.className = 'bfa-journal-panel-footer';
  note.append(header, body, footer);
  wrapper.append(note);
  content.append(nav, wrapper);
  const bottom = borderSvg(doc, true);
  bottom.classList.add('bfa-journal-frame');
  pane.append(border, gap, content, bottom);
  inner.append(controls, pane);
  dialog.append(inner);
  swipeable.append(dialog);
  swipeHost.append(swipeable);
  root.append(mask, swipeHost);

  const darkTargets = [border, gap, content, bottom];
  const chrome = bindSidebarChrome({
    alignLeft,
    alignRight,
    controls,
    dialog,
    doc,
    fixed: fixedButton,
    hide: closeButton,
    hideIcon: () => hideIcon(doc),
    hideTip,
    lock: lockButton,
    mask,
    overlay: overlayButton,
    overlayGroup: overlay,
    pane,
    placementGroup: placement,
    showIcon: () => showIcon(doc),
    unlock: unlockButton,
    unlockTip,
    visibility,
  });
  return {
    body,
    callout,
    chrome: chrome.chrome,
    closeButton,
    collapse: chrome.collapse,
    dialog,
    expand: chrome.expand,
    fitViewport: chrome.fitViewport,
    footer,
    nav,
    nextButton,
    prevButton,
    root,
    scroller: content,
    setDark(on: boolean) {
      dialog.classList.toggle(SIDEBAR_DARK_MODE_CLASS, on);
      for (const target of darkTargets) {
        target.classList.toggle(SIDEBAR_SURFACE_DARK_CLASS, on);
      }
    },
    setOnChromeChange: chrome.setOnChromeChange,
    title,
  };
}

function tooltip(doc: Document, control: HTMLElement): HTMLElement {
  const tip = doc.createElement('span');
  tip.className = SIDEBAR_TOOLTIP_CLASS;
  tip.append(control);
  return tip;
}

function iconButton(
    doc: Document,
    label: string,
    className: string,
    icon: SVGElement,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.append(icon);
  return button;
}

function navButton(doc: Document, label: string, previous: boolean): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = SIDEBAR_NAV_BUTTON_CLASS;
  button.setAttribute('aria-label', label);
  const text = doc.createElement('span');
  text.className = SIDEBAR_NAV_LABEL_CLASS;
  text.textContent = label;
  const icon = chevron(doc, previous);
  button.append(...(previous ? [icon, text] : [text, icon]));
  return button;
}

function hideIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {viewBox: '0 0 16 16', width: '1em', height: '1em'}, [
    svg(doc, 'path', {
      d: 'M5.21.36h0A2.25,2.25,0,0,1,7.89.53L16,8,7.89,15.47a2.25,2.25,0,0,1-2.68.17h0A1.3,1.3,0,0,1,5,13.52L11,8,5,2.48A1.3,1.3,0,0,1,5.21.36Z',
    }),
    svg(doc, 'polygon', {points: '9.09 8 0 0 0 16 9.09 8'}),
  ]);
}

function showIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {viewBox: '0 0 16 16', width: '1em', height: '1em'}, [
    svg(doc, 'path', {
      d: 'M11,2.48,5,8l6,5.52a1.3,1.3,0,0,1-.21,2.12h0a2.25,2.25,0,0,1-2.68-.17L0,8,8.11.53A2.25,2.25,0,0,1,10.79.36h0A1.3,1.3,0,0,1,11,2.48Z',
    }),
    svg(doc, 'polygon', {points: '6.92 8 16 0 16 16 6.92 8'}),
  ]);
}

function lockedIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {
    height: '1em',
    viewBox: '0 0 448 512',
    width: '1em',
    xmlns: SVG_NS,
  }, [svg(doc, 'path', {
    d: 'M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z',
  })]);
}

function lockIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {
    height: '1em',
    viewBox: '0 0 448 512',
    width: '1em',
    xmlns: SVG_NS,
  }, [svg(doc, 'path', {
    d: 'M144 144c0-44.2 35.8-80 80-80c31.9 0 59.4 18.6 72.3 45.7c7.6 16 26.7 22.8 42.6 15.2s22.8-26.7 15.2-42.6C331 33.7 281.5 0 224 0C144.5 0 80 64.5 80 144v48H64c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V256c0-35.3-28.7-64-64-64H144V144z',
  })]);
}

function overlayIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {viewBox: '0 0 24 24', width: '1em', height: '1em'}, [
    svg(doc, 'path', {d: 'M14.5,3V21H3V3H14.5m3-3H0V24H17.5V0Z'}),
    svg(doc, 'rect', {x: '17.59', y: '0.5', width: '5.91', height: '23'}),
    svg(doc, 'path', {d: 'M23,1V23H18.09V1H23m1-1H17.09V24H24V0Z'}),
    svg(doc, 'polygon', {points: '6.28 12.32 12.5 19.14 12.5 5.5 6.28 12.32'}),
  ]);
}

function fixedIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {viewBox: '0 0 24 24', width: '1em', height: '1em'}, [
    svg(doc, 'path', {d: 'M15.5,3V21H3V3H15.5m3-3H0V24H18.5V0Z'}),
    svg(doc, 'rect', {x: '17.59', y: '0.5', width: '5.91', height: '23'}),
    svg(doc, 'path', {d: 'M23,1V23H18.09V1H23m1-1H17.09V24H24V0Z'}),
    svg(doc, 'line', {
      fill: 'none',
      stroke: '#000',
      'stroke-miterlimit': '10',
      'stroke-width': '3px',
      x1: '12',
      x2: '12',
      y1: '5.5',
      y2: '19',
    }),
  ]);
}

function alignLeftIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {viewBox: '0 0 24 24', width: '1em', height: '1em'}, [
    svg(doc, 'path', {d: 'M21,3V21H9.5V3H21m3-3H6.5V24H24V0Z'}),
    svg(doc, 'rect', {x: '0.5', y: '0.5', width: '5.91', height: '23'}),
    svg(doc, 'path', {d: 'M5.91,1V23H1V1H5.91m1-1H0V24H6.91V0Z'}),
  ]);
}

function alignRightIcon(doc: Document): SVGElement {
  return svg(doc, 'svg', {viewBox: '0 0 24 24', width: '1em', height: '1em'}, [
    svg(doc, 'path', {d: 'M15.5,3V21H3V3H15.5m3-3H0V24H18.5V0Z'}),
    svg(doc, 'rect', {x: '17.59', y: '0.5', width: '5.91', height: '23'}),
    svg(doc, 'path', {d: 'M23,1V23H18.09V1H23m1-1H17.09V24H24V0Z'}),
  ]);
}

function chevron(doc: Document, previous: boolean): SVGElement {
  const path = previous
    ? 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z'
    : 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z';
  return svg(doc, 'svg', {
    height: '1em',
    viewBox: '0 0 320 512',
    width: '1em',
    xmlns: SVG_NS,
  }, [svg(doc, 'path', {d: path})]);
}

function borderSvg(doc: Document, bottom: boolean): SVGElement {
  const stroke = {
    fill: 'none',
    'stroke-miterlimit': '10px',
    'stroke-width': '2px',
  };
  const element = svg(doc, 'svg', {
    class: bottom
      ? `${SIDEBAR_BORDER_CLASS} ${SIDEBAR_BORDER_BOTTOM_CLASS}`
      : SIDEBAR_BORDER_CLASS,
    preserveAspectRatio: 'none',
    viewBox: '0 0 340 18',
  }, [
    svg(doc, 'path', {
      class: SIDEBAR_BORDER_BG_CLASS,
      d: 'M328.1,6.19H201a57,57,0,0,1-30.15,9.14A54.55,54.55,0,0,1,141,6.19H12A30.25,30.25,0,0,1,.4,17.26V18H340v-.27A28.68,28.68,0,0,1,328.1,6.19Z',
    }),
    svg(doc, 'path', {...stroke, 'stroke-width': '3px', class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M-46,22.28'}),
    svg(doc, 'path', {...stroke, 'stroke-width': '1.5px', class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M168.15,3'}),
    svg(doc, 'path', {...stroke, class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M339.6,17.09C328.4,12.16,325.17,1,325.17,1H169.42'}),
    svg(doc, 'path', {...stroke, class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M.4,17.09C11.6,12.16,14.83,1,14.83,1H170.41'}),
    svg(doc, 'path', {...stroke, 'stroke-width': '1.5px', class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M171.85,3.56'}),
    svg(doc, 'path', {...stroke, class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M200.23,6.19c-7.16,6.12-20.56,8.32-30.35,8.32'}),
    svg(doc, 'path', {...stroke, class: SIDEBAR_BORDER_STROKE_CLASS, d: 'M170.12,14.51c-9.79,0-23.19-2.2-30.35-8.32'}),
    svg(doc, 'path', {
      class: SIDEBAR_BORDER_FILL_CLASS,
      d: 'M167.12,14.51a3,3,0,1,0,3-3,3,3,0,0,0-3,3',
    }),
    svg(doc, 'path', {
      ...stroke,
      'stroke-width': '3px',
      class: SIDEBAR_BORDER_STROKE_CLASS,
      d: 'M1.5,18V10.89A5.44,5.44,0,0,1,7,5.5h326.1a5.44,5.44,0,0,1,5.45,5.39V18',
    }),
  ]);
  return element;
}

function svg(
    doc: Document,
    tag: string,
    attrs: Record<string, string>,
    children: SVGElement[] = [],
): SVGElement {
  const element = doc.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}
