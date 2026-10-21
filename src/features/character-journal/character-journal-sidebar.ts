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
  SIDEBAR_INNER_CLASS,
  SIDEBAR_MASK_CLASS,
  SIDEBAR_NAV_BUTTON_CLASS,
  SIDEBAR_NAV_CLASS,
  SIDEBAR_NAV_LABEL_CLASS,
  SIDEBAR_NOTE_PANE_CLASS,
  SIDEBAR_PANE_CLASS,
  SIDEBAR_PORTAL_CLASS,
  SIDEBAR_SURFACE_DARK_CLASS,
  SIDEBAR_SWIPEABLE_CLASS,
  SIDEBAR_TOOLTIP_CLASS,
  SIDEBAR_VISIBILITY_CLASS,
  SIDEBAR_WRAPPER_CLASS,
} from '../../platform/dndbeyond/selectors';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface JournalSidebarShell {
  body: HTMLElement;
  callout: HTMLElement;
  closeButton: HTMLButtonElement;
  dialog: HTMLElement;
  footer: HTMLElement;
  nav: HTMLElement;
  nextButton: HTMLButtonElement;
  prevButton: HTMLButtonElement;
  root: HTMLElement;
  setDark(on: boolean): void;
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
  dialog.style.width = '340px';
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
  const closeButton = iconButton(doc, 'Close', SIDEBAR_HIDE_CLASS, hideIcon(doc));
  closeButton.classList.add('bfa-journal-close');
  closeButton.dataset.bfaJournalClose = 'true';
  visibility.append(tooltip(doc, closeButton));
  controls.append(visibility);

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
  wrapper.className = SIDEBAR_WRAPPER_CLASS;
  const note = doc.createElement('div');
  note.className = SIDEBAR_NOTE_PANE_CLASS;
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
  return {
    body,
    callout,
    closeButton,
    dialog,
    footer,
    nav,
    nextButton,
    prevButton,
    root,
    setDark(on: boolean) {
      dialog.classList.toggle(SIDEBAR_DARK_MODE_CLASS, on);
      for (const target of darkTargets) {
        target.classList.toggle(SIDEBAR_SURFACE_DARK_CLASS, on);
      }
    },
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
