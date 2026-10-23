import companionPortraitStyles from './companion-portrait.css?raw';
import type {CompanionPortraitSelection} from '../../platform/chrome/companion-portrait-storage';
import type {
  CharacterHeaderPortraitTarget,
  ExtrasCompanionTarget,
} from '../../platform/dndbeyond/extras-companion-adapter';
import {COMPANION_PORTRAIT_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

const SELECT_ATTRIBUTE = 'data-bfa-companion-select';
const SELECT_HOST_ATTRIBUTE = 'data-bfa-companion-select-host';
const OVERLAY_ATTRIBUTE = 'data-bfa-companion-overlay';
const OVERLAY_FAILED_URL_ATTRIBUTE = 'data-bfa-companion-failed-url';
const ROW_ATTRIBUTE = 'data-bfa-companion-row';
const HEADER_CLASS = 'bfa-companion-header';
const OVERLAY_CLASS = 'bfa-companion-overlay';
const PLAYER_PORTRAIT_CLASS = 'bfa-companion-player-portrait';
const PLAYER_PORTRAIT_FRAME_CLASS = 'bfa-companion-player-portrait-frame';
const SELECT_CLASS = 'bfa-companion-select';

export function ensureCompanionPortraitStyles(doc: Document): void {
  if (doc.head.querySelector(`[${COMPANION_PORTRAIT_STYLE_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }
  const style = doc.createElement('style');
  style.setAttribute(COMPANION_PORTRAIT_STYLE_ATTRIBUTE_NAME, 'true');
  style.textContent = companionPortraitStyles;
  doc.head.append(style);
}

export function reconcileCompanionControls(options: {
  companions: ExtrasCompanionTarget[];
  doc: Document;
  enabled: boolean;
  onChange: (companionId: string, checked: boolean) => void;
  selectedCompanionId: string | null;
}): void {
  const {companions, doc, enabled, onChange, selectedCompanionId} = options;
  const liveRows = new Set(companions.map((target) => target.row));
  for (const control of doc.querySelectorAll<HTMLElement>(`[${SELECT_ATTRIBUTE}]`)) {
    const row = control.closest<HTMLElement>(`[${ROW_ATTRIBUTE}]`);
    if (row === null || !liveRows.has(row)) {
      removeControl(control);
    }
  }

  if (!enabled) {
    removeAllControls(doc);
    return;
  }

  for (const companion of companions) {
    companion.row.setAttribute(ROW_ATTRIBUTE, companion.companionId);
    const preview = companion.image.parentElement;
    if (preview === null) {
      continue;
    }
    preview.setAttribute(SELECT_HOST_ATTRIBUTE, 'true');
    let label = preview.querySelector<HTMLLabelElement>(`[${SELECT_ATTRIBUTE}]`);
    if (label === null) {
      label = createSelectionControl(companion, onChange, doc);
      preview.append(label);
    }
    const checkbox = label.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox !== null) {
      checkbox.checked = selectedCompanionId === companion.companionId;
    }
  }
}

export function reconcileCompanionOverlay(options: {
  doc: Document;
  enabled: boolean;
  header: CharacterHeaderPortraitTarget | null;
  onActivate: () => void;
  selection: CompanionPortraitSelection | null;
}): void {
  const {doc, enabled, header, onActivate, selection} = options;
  for (const overlay of doc.querySelectorAll<HTMLElement>(`[${OVERLAY_ATTRIBUTE}]`)) {
    if (header === null || overlay.parentElement !== header.container) {
      overlay.remove();
    }
  }
  for (const markedHeader of doc.querySelectorAll<HTMLElement>(`.${HEADER_CLASS}`)) {
    if (header === null || markedHeader !== header.container) {
      markedHeader.classList.remove(HEADER_CLASS);
    }
  }
  for (const portrait of doc.querySelectorAll<HTMLElement>(`.${PLAYER_PORTRAIT_CLASS}`)) {
    if (header === null || portrait !== header.portrait) {
      portrait.classList.remove(PLAYER_PORTRAIT_CLASS);
    }
  }
  for (const frame of doc.querySelectorAll<HTMLElement>(`.${PLAYER_PORTRAIT_FRAME_CLASS}`)) {
    if (header === null || frame !== header.portrait.parentElement) {
      frame.classList.remove(PLAYER_PORTRAIT_FRAME_CLASS);
    }
  }

  if (header !== null) {
    header.container.classList.add(HEADER_CLASS);
    header.portrait.classList.add(PLAYER_PORTRAIT_CLASS);
    header.portrait.parentElement?.classList.add(PLAYER_PORTRAIT_FRAME_CLASS);
  }

  if (!enabled || selection === null || header === null) {
    header?.container.querySelector(`[${OVERLAY_ATTRIBUTE}]`)?.remove();
    return;
  }

  let overlay = header.container.querySelector<HTMLImageElement>(
      `[${OVERLAY_ATTRIBUTE}]`,
  );
  if (overlay === null) {
    overlay = doc.createElement('img');
    overlay.className = OVERLAY_CLASS;
    overlay.setAttribute(OVERLAY_ATTRIBUTE, 'true');
    overlay.setAttribute('role', 'button');
    overlay.tabIndex = 0;
    const createdOverlay = overlay;
    overlay.addEventListener('click', (event) => {
      event.stopPropagation();
      onActivate();
    });
    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onActivate();
    });
    overlay.addEventListener('error', () => {
      const failedUrl = createdOverlay.getAttribute('src');
      if (failedUrl !== null) {
        createdOverlay.hidden = true;
        createdOverlay.setAttribute(OVERLAY_FAILED_URL_ATTRIBUTE, failedUrl);
      }
    });
    header.container.append(overlay);
  }
  overlay.alt = `${selection.name} companion portrait`;
  overlay.setAttribute('aria-label', `Open ${selection.name} companion details`);
  if (overlay.getAttribute('src') !== selection.imageUrl) {
    overlay.hidden = false;
    overlay.removeAttribute(OVERLAY_FAILED_URL_ATTRIBUTE);
    overlay.src = selection.imageUrl;
  } else if (overlay.getAttribute(OVERLAY_FAILED_URL_ATTRIBUTE) === null) {
    overlay.hidden = false;
  }
}

export function removeCompanionPortraitView(doc: Document): void {
  removeAllControls(doc);
  for (const overlay of doc.querySelectorAll(`[${OVERLAY_ATTRIBUTE}]`)) {
    overlay.remove();
  }
  for (const header of doc.querySelectorAll<HTMLElement>(`.${HEADER_CLASS}`)) {
    header.classList.remove(HEADER_CLASS);
  }
  for (const portrait of doc.querySelectorAll<HTMLElement>(`.${PLAYER_PORTRAIT_CLASS}`)) {
    portrait.classList.remove(PLAYER_PORTRAIT_CLASS);
  }
  for (const frame of doc.querySelectorAll<HTMLElement>(`.${PLAYER_PORTRAIT_FRAME_CLASS}`)) {
    frame.classList.remove(PLAYER_PORTRAIT_FRAME_CLASS);
  }
  doc.head.querySelector(`[${COMPANION_PORTRAIT_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}

function createSelectionControl(
    companion: ExtrasCompanionTarget,
    onChange: (companionId: string, checked: boolean) => void,
    doc: Document,
): HTMLLabelElement {
  const label = doc.createElement('label');
  label.className = SELECT_CLASS;
  label.setAttribute(SELECT_ATTRIBUTE, companion.companionId);
  const checkbox = doc.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.setAttribute(
      'aria-label',
      `Show ${companion.name} beside character portrait`,
  );
  checkbox.addEventListener('pointerdown', stopEventPropagation);
  checkbox.addEventListener('click', stopEventPropagation);
  checkbox.addEventListener('change', () => {
    onChange(label.getAttribute(SELECT_ATTRIBUTE) ?? '', checkbox.checked);
  });
  label.append(checkbox);
  return label;
}

function stopEventPropagation(event: Event): void {
  event.stopPropagation();
}

function removeControl(control: HTMLElement): void {
  const host = control.parentElement;
  control.remove();
  host?.removeAttribute(SELECT_HOST_ATTRIBUTE);
  host?.closest<HTMLElement>(`[${ROW_ATTRIBUTE}]`)?.removeAttribute(ROW_ATTRIBUTE);
}

function removeAllControls(doc: Document): void {
  for (const control of doc.querySelectorAll<HTMLElement>(`[${SELECT_ATTRIBUTE}]`)) {
    removeControl(control);
  }
  for (const host of doc.querySelectorAll<HTMLElement>(`[${SELECT_HOST_ATTRIBUTE}]`)) {
    host.removeAttribute(SELECT_HOST_ATTRIBUTE);
  }
  for (const row of doc.querySelectorAll<HTMLElement>(`[${ROW_ATTRIBUTE}]`)) {
    row.removeAttribute(ROW_ATTRIBUTE);
  }
}
