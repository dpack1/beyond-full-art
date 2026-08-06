import characterArtStyles from './upload-control.css?raw';
import type {CharacterArtService} from './art-service';
import type {CharacterId} from './art-types';
import {
  CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME,
  CHARACTER_ART_STYLES_ATTRIBUTE_NAME,
  PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
} from '../../platform/dndbeyond/selectors';
import {isHtmlInputElement, isHtmlElement} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

type StatusTone = 'error' | 'info' | 'success';

export interface CharacterArtControlsController {
  cleanup: Cleanup;
  setStatus(message: string, tone: StatusTone): void;
}

export interface CharacterArtControlsTarget {
  manager: HTMLElement;
  uploadSection: HTMLElement;
}

interface StatusState {
  message: string;
  tone: StatusTone;
}

export function installCharacterArtControls(
    target: CharacterArtControlsTarget,
    service: CharacterArtService,
    characterId: CharacterId,
    doc: Document = document,
): CharacterArtControlsController {
  ensureCharacterArtStyles(doc);

  const existingControls = target.manager.querySelector<HTMLElement>(
      `[${CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME}]`,
  );
  if (existingControls !== null) {
    return {
      cleanup() {},
      setStatus() {},
    };
  }

  const state = {
    destroyed: false,
    isBusy: false,
    status: ({
      message: '',
      tone: 'info',
    } as StatusState),
  };

  const controls = doc.createElement('section');
  controls.className = 'bfa-art-sync';
  controls.setAttribute(CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME, 'true');
  controls.classList.add(resolveThemeClassName(target.uploadSection, doc));

  const statusText = doc.createElement('p');
  statusText.className = 'bfa-art-sync__status bfa-art-sync__status--info';
  statusText.hidden = true;

  const setBusy = (isBusy: boolean) => {
    state.isBusy = isBusy;
    render();
  };

  const setStatus = (message: string, tone: StatusTone) => {
    state.status = {message, tone};
    renderStatus(statusText, state.status);
  };

  const handlePortraitUploadChange = async (event: Event) => {
    const uploadInput = event.target;
    if (!isHtmlInputElement(uploadInput)) {
      return;
    }

    if (!uploadInput.matches(PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR)) {
      return;
    }

    const selectedFile = uploadInput.files?.[0];
    if (selectedFile === undefined || state.isBusy) {
      return;
    }

    setStatus('Saving the selected portrait locally as full art...', 'info');
    setBusy(true);
    const result = await service.saveArt(characterId, selectedFile);
    setBusy(false);

    if (!result.ok) {
      setStatus(result.error, 'error');
      return;
    }

    setStatus('Portrait saved locally as full art.', 'success');
    render();
  };

  const onManagerChange = (event: Event) => {
    void handlePortraitUploadChange(event);
  };

  target.manager.addEventListener('change', onManagerChange);

  controls.append(statusText);
  target.uploadSection.append(controls);

  render();

  return {
    cleanup() {
      state.destroyed = true;
      target.manager.removeEventListener('change', onManagerChange);
      controls.remove();
      if (doc.querySelector(`[${CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME}]`) === null) {
        removeCharacterArtStyles(doc);
      }
    },
    setStatus,
  };

  function render() {
    if (state.destroyed) {
      return;
    }

    renderStatus(statusText, state.status);
  }
}

function ensureCharacterArtStyles(doc: Document): void {
  if (doc.head.querySelector(`[${CHARACTER_ART_STYLES_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CHARACTER_ART_STYLES_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = characterArtStyles;
  doc.head.append(styleElement);
}

function removeCharacterArtStyles(doc: Document): void {
  doc.head.querySelector(`[${CHARACTER_ART_STYLES_ATTRIBUTE_NAME}]`)?.remove();
}

function renderStatus(element: HTMLElement, status: StatusState): void {
  element.className = `bfa-art-sync__status bfa-art-sync__status--${status.tone}`;
  element.textContent = status.message;
  element.hidden = status.message === '';
}

function resolveThemeClassName(
    uploadSection: HTMLElement,
    doc: Document,
): string {
  const backgroundColor = findEffectiveBackgroundColor(uploadSection, doc);
  if (backgroundColor === null) {
    return 'bfa-art-sync--dark';
  }

  return isLightColor(backgroundColor)
    ? 'bfa-art-sync--light'
    : 'bfa-art-sync--dark';
}

function findEffectiveBackgroundColor(
    startElement: HTMLElement,
    doc: Document,
): string | null {
  const view = doc.defaultView;
  if (view === null) {
    return null;
  }

  let currentElement: HTMLElement | null = startElement;
  while (currentElement !== null) {
    const backgroundColor = view.getComputedStyle(currentElement).backgroundColor;
    if (!isTransparentColor(backgroundColor)) {
      return backgroundColor;
    }

    currentElement = isHtmlElement(currentElement.parentElement)
      ? currentElement.parentElement
      : null;
  }

  return null;
}

function isLightColor(backgroundColor: string): boolean {
  const match = /rgba?\(([^)]+)\)/.exec(backgroundColor);
  const colorList = match?.[1];
  if (colorList === undefined) {
    return false;
  }

  const colorChannels = colorList
      .split(',')
      .slice(0, 3)
      .map((value) => Number.parseFloat(value.trim()));
  if (
    colorChannels.length !== 3
    || colorChannels.some((value) => Number.isNaN(value))
  ) {
    return false;
  }

  const [red, green, blue] = colorChannels as [number, number, number];
  const relativeLuminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  return relativeLuminance >= 150;
}

function isTransparentColor(backgroundColor: string): boolean {
  return backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)';
}
