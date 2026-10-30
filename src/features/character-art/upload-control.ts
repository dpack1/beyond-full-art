import characterArtStyles from './upload-control.css?raw';
import type {CharacterArtService} from './art-service';
import type {
  CharacterArtMetadata,
  CharacterId,
  CharacterPortraitCropMetadata,
  CharacterPortraitCropRect,
  SaveCharacterPortraitCropInput,
  ViewerImageResolution,
} from './art-types';
import type {
  CharacterPortraitCropWorkflow,
  CropWorkflowSourceOverride,
} from '../crop-workflow/crop-workflow';
import {
  CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME,
  CHARACTER_ART_STYLES_ATTRIBUTE_NAME,
  PORTRAIT_MANAGER_AVATAR_IMAGE_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_FILE_CLASS,
  PORTRAIT_MANAGER_UPLOAD_FILE_INPUT_CLASS,
  PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_CLASS,
  PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
} from '../../platform/dndbeyond/selectors';
import {
  findChangePortraitButton,
  findChangePortraitButtonContainer,
  findSelectedPortraitContainer,
} from '../../platform/dndbeyond/portrait-manager-adapter';
import {isExtensionDrivenPortraitUpload} from '../../platform/dndbeyond/portrait-upload-handoff';
import {
  isHtmlImageElement,
  isHtmlButtonElement,
  isHtmlInputElement,
  isHtmlElement,
} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

type StatusTone = 'error' | 'info' | 'success';

export interface CharacterArtControlsController {
  cleanup: Cleanup;
  refresh(): Promise<void>;
  setStatus(message: string, tone: StatusTone): void;
}

export interface CharacterArtControlsTarget {
  manager: HTMLElement;
  uploadInput: HTMLInputElement;
  uploadSection: HTMLElement;
}

interface StatusState {
  message: string;
  tone: StatusTone;
}

interface PendingPortraitCropState {
  cropFile: File;
  cropRect: CharacterPortraitCropRect;
  height: number;
  width: number;
}

type ScheduledRenderHandle = ReturnType<typeof globalThis.setTimeout>;

const COMPACT_LAYOUT_MAX_WIDTH_PX = 540;
const COMPACT_UPLOAD_RULES_TEXT = '150 x 150 recommended, 3 MB max';

export function installCharacterArtControls(
    target: CharacterArtControlsTarget,
    service: CharacterArtService,
    cropWorkflow: CharacterPortraitCropWorkflow,
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
      async refresh() {},
      setStatus() {},
    };
  }

  const state = {
    destroyed: false,
    fullArtMetadata: null as CharacterArtMetadata | null,
    isBusy: false,
    loadedFullArtSha256: null as string | null,
    pendingSelectedFile: null as File | null,
    pendingSelectedFileCrop: null as PendingPortraitCropState | null,
    portraitCropMetadata: null as CharacterPortraitCropMetadata | null,
    scheduledRenderHandles: [] as ScheduledRenderHandle[],
    status: ({
      message: '',
      tone: 'info',
    } as StatusState),
  };

  const controls = doc.createElement('section');
  controls.className = 'bfa-art-sync';
  controls.setAttribute(CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME, 'true');
  controls.classList.add(resolveThemeClassName(target.uploadSection, doc));

  const buttonRow = doc.createElement('div');
  buttonRow.className = 'bfa-art-sync__buttons';
  const statusText = doc.createElement('p');
  statusText.className = 'bfa-art-sync__status bfa-art-sync__status--info';
  statusText.hidden = true;
  const resizeObserver = createResizeObserver(target.manager, () => {
    render();
  }, doc);
  let originalUploadRulesText: string | null = null;

  const refresh = async () => {
    const [metadataResult, cropMetadataResult] = await Promise.all([
      service.getMetadata(characterId),
      service.getCropMetadata(characterId),
    ]);

    if (!metadataResult.ok) {
      setStatus(metadataResult.error, 'error');
      render();
      return;
    }

    if (!cropMetadataResult.ok) {
      setStatus(cropMetadataResult.error, 'error');
      render();
      return;
    }

    state.fullArtMetadata = metadataResult.value;
    state.portraitCropMetadata = resolveCurrentCropMetadata(
        metadataResult.value,
        cropMetadataResult.value,
    );
    await refreshPreviewImage();
    render();
  };

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

    if (isExtensionDrivenPortraitUpload(uploadInput)) {
      return;
    }

    const selectedFile = uploadInput.files?.[0];
    state.pendingSelectedFile = selectedFile ?? null;
    state.pendingSelectedFileCrop = null;
    render();
    scheduleRender(render, state.scheduledRenderHandles);
    if (selectedFile !== undefined) {
      scheduleRenderBurst(render, state.scheduledRenderHandles);
    }
  };

  const handlePortraitCommitClick = async (event: Event) => {
    const clickTarget = event.target instanceof Element ? event.target : null;
    if (!isHtmlElement(clickTarget)) {
      return;
    }

    const clickedButton = clickTarget.closest('button');
    if (!isHtmlButtonElement(clickedButton)) {
      return;
    }

    const changePortraitButton = findChangePortraitButton(target.uploadSection);
    if (clickedButton !== changePortraitButton || state.isBusy) {
      return;
    }

    const selectedFile = state.pendingSelectedFile;
    const selectedFileCrop = state.pendingSelectedFileCrop;
    if (selectedFile === null) {
      return;
    }

    state.pendingSelectedFile = null;
    setStatus('Saving the selected portrait locally as full art...', 'info');
    render();
    const result = await service.saveArt(
        characterId,
        selectedFile,
        state.loadedFullArtSha256,
    );

    if (!result.ok) {
      state.pendingSelectedFile = selectedFile;
      state.pendingSelectedFileCrop = selectedFileCrop;
      setStatus(result.error, 'error');
      render();
      return;
    }

    state.pendingSelectedFileCrop = null;
    if (selectedFileCrop !== null) {
      const cropSaveResult = await service.savePortraitCrop({
        byteBuffer: await readBlobAsArrayBuffer(selectedFileCrop.cropFile, doc),
        byteSize: selectedFileCrop.cropFile.size,
        characterId,
        cropRect: selectedFileCrop.cropRect,
        fileName: selectedFileCrop.cropFile.name,
        height: selectedFileCrop.height,
        mimeType: selectedFileCrop.cropFile.type as SaveCharacterPortraitCropInput['mimeType'],
        sourceArtBlobKey: result.value.blobKey,
        width: selectedFileCrop.width,
      });
      if (!cropSaveResult.ok) {
        await refresh();
        setStatus(
            'Portrait saved locally as full art, but the portrait crop could not be saved locally.',
            'error',
        );
        render();
        return;
      }
    }

    await refresh();
    setStatus(
        selectedFileCrop === null
          ? 'Portrait saved locally as full art.'
          : 'Portrait and crop saved locally.',
        'success',
    );
    render();
  };

  const handleCropClick = async () => {
    if (state.isBusy) {
      return;
    }

    const cropSourceOverride = buildCropSourceOverride(
        state.pendingSelectedFile,
        state.pendingSelectedFileCrop,
    );
    setBusy(true);
    const result = await cropWorkflow.openForCharacter(
        characterId,
        target.uploadInput,
        cropSourceOverride,
    );
    setBusy(false);

    if (!result.ok) {
      setStatus(result.error, 'error');
      return;
    }

    if (result.value === null) {
      return;
    }

    state.pendingSelectedFileCrop = result.value.savedLocally
      ? null
      : result.value.cropResult;

    await refresh();
    setStatus(result.value.message, result.value.tone);
    render();
  };

  const cropButton = createButton(
      doc,
      'Crop portrait',
      'bfa-art-sync__button',
      () => {
        void handleCropClick();
      },
      false,
  );

  const onManagerChange = (event: Event) => {
    void handlePortraitUploadChange(event);
  };
  const onManagerClick = (event: Event) => {
    void handlePortraitCommitClick(event);
  };

  target.manager.addEventListener('change', onManagerChange);
  target.manager.addEventListener('click', onManagerClick);

  controls.append(buttonRow, statusText);
  target.uploadSection.append(controls);

  render();
  void refresh();

  return {
    cleanup() {
      state.destroyed = true;
      clearScheduledRenders(state.scheduledRenderHandles);
      resizeObserver?.disconnect();
      target.manager.removeEventListener('change', onManagerChange);
      target.manager.removeEventListener('click', onManagerClick);
      clearSelectedPortraitLayout(target.uploadSection);
      target.manager.classList.remove('bfa-art-sync--compact');
      controls.remove();
      if (doc.querySelector(`[${CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME}]`) === null) {
        removeCharacterArtStyles(doc);
      }
    },
    refresh,
    setStatus,
  };

  function render() {
    if (state.destroyed || !target.manager.isConnected) {
      return;
    }

    syncLayoutMode();
    mountCropButton();
    renderStatus(statusText, state.status);
    layoutSelectedPortrait();
    const controlsOwnVisibleButtonRow =
      buttonRow.parentElement === controls && !buttonRow.hidden;
    controls.hidden = !controlsOwnVisibleButtonRow && statusText.hidden;
  }

  function mountCropButton() {
    buttonRow.replaceChildren();

    const shouldShowCropButton =
      state.fullArtMetadata !== null && hasSelectedPortraitUpload(target.uploadInput);
    if (!shouldShowCropButton) {
      buttonRow.hidden = true;
      return;
    }

    cropButton.disabled = state.isBusy;
    cropButton.textContent = state.isBusy
      ? 'Working...'
      : resolveCropButtonHasExistingCrop(
          state.pendingSelectedFile,
          state.pendingSelectedFileCrop,
          state.portraitCropMetadata,
      ) === false
        ? 'Crop portrait'
        : 'Edit portrait crop';

    const changePortraitButton = findChangePortraitButton(target.uploadSection);
    const changePortraitButtonContainer = findChangePortraitButtonContainer(target.uploadSection);
    if (changePortraitButton !== null) {
      synchronizeButtonAppearance(cropButton, changePortraitButton);
    } else {
      cropButton.className = 'bfa-art-sync__button';
    }

    buttonRow.append(cropButton);
    buttonRow.hidden = false;

    if (changePortraitButtonContainer !== null) {
      changePortraitButtonContainer.classList.add('bfa-art-sync__native-button-stack');
      if (buttonRow.parentElement !== changePortraitButtonContainer) {
        changePortraitButtonContainer.append(buttonRow);
      }
      return;
    }

    if (buttonRow.parentElement !== controls) {
      controls.prepend(buttonRow);
    }
  }

  async function refreshPreviewImage() {
    state.loadedFullArtSha256 = null;
    if (state.fullArtMetadata === null) {
      return;
    }

    const resolution = await service.resolveViewerImage(
        characterId,
        resolveFallbackViewerImage(target.manager),
    );
    resolution.releaseImageUrl?.();
    if (state.destroyed || !resolution.usingStoredArt) {
      return;
    }

    state.loadedFullArtSha256 = resolution.sha256 ?? null;
  }

  function layoutSelectedPortrait() {
    const selectedPortraitContainer = findSelectedPortraitContainer(target.uploadSection);
    const actionContainer = findChangePortraitButtonContainer(target.uploadSection);
    if (
      selectedPortraitContainer === null
      || actionContainer === null
      || !hasSelectedPortraitUpload(target.uploadInput)
    ) {
      clearSelectedPortraitLayout(target.uploadSection);
      return;
    }

    selectedPortraitContainer.classList.add('bfa-art-sync__selected-row');
    actionContainer.classList.add('bfa-art-sync__selected-actions');
    const nativePreviewContainer = findNativeSelectedPreviewContainer(
        selectedPortraitContainer,
        actionContainer,
    );
    nativePreviewContainer?.classList.add('bfa-art-sync__selected-preview-container');
    applySelectedRowLayout(
        selectedPortraitContainer,
        nativePreviewContainer,
        actionContainer,
        isCompactLayout(target.manager),
    );
  }

  function syncLayoutMode() {
    const compactLayout = isCompactLayout(target.manager);
    controls.classList.toggle('bfa-art-sync--compact', compactLayout);
    target.manager.classList.toggle('bfa-art-sync--compact', compactLayout);

    const uploadHeadingRules = target.manager.querySelector<HTMLElement>(
        PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_SELECTOR,
    );
    if (uploadHeadingRules !== null) {
      if (originalUploadRulesText === null) {
        originalUploadRulesText = uploadHeadingRules.textContent?.trim() ?? '';
      }
      uploadHeadingRules.textContent = compactLayout
        ? COMPACT_UPLOAD_RULES_TEXT
        : originalUploadRulesText;
    }
  }
}

function hasSelectedPortraitUpload(uploadInput: HTMLInputElement): boolean {
  return uploadInput.files?.[0] !== undefined;
}

function resolveCurrentCropMetadata(
    fullArtMetadata: CharacterArtMetadata | null,
    portraitCropMetadata: CharacterPortraitCropMetadata | null,
): CharacterPortraitCropMetadata | null {
  if (fullArtMetadata === null || portraitCropMetadata === null) {
    return null;
  }

  return portraitCropMetadata.sourceArtBlobKey === fullArtMetadata.blobKey
    ? portraitCropMetadata
    : null;
}

function buildCropSourceOverride(
    pendingSelectedFile: File | null,
    pendingSelectedFileCrop: PendingPortraitCropState | null,
): CropWorkflowSourceOverride | null {
  if (pendingSelectedFile === null) {
    return null;
  }

  return {
    existingCropRect: pendingSelectedFileCrop?.cropRect ?? null,
    selectedFile: pendingSelectedFile,
  };
}

function resolveCropButtonHasExistingCrop(
    pendingSelectedFile: File | null,
    pendingSelectedFileCrop: PendingPortraitCropState | null,
    portraitCropMetadata: CharacterPortraitCropMetadata | null,
): boolean {
  if (pendingSelectedFile !== null) {
    return pendingSelectedFileCrop !== null;
  }

  return portraitCropMetadata !== null;
}

function isCompactLayout(manager: HTMLElement): boolean {
  const width = manager.getBoundingClientRect().width;
  return width > 0 && width <= COMPACT_LAYOUT_MAX_WIDTH_PX;
}

function resolveFallbackViewerImage(manager: HTMLElement): ViewerImageResolution {
  const portraitImage = manager.querySelector(PORTRAIT_MANAGER_AVATAR_IMAGE_SELECTOR);
  const fallbackUrl = isHtmlImageElement(portraitImage)
    ? portraitImage.src
    : '';

  return {
    altText: 'Character portrait',
    imageUrl: fallbackUrl,
    usingStoredArt: false,
    warningMessage: null,
  };
}

function synchronizeButtonAppearance(
    targetButton: HTMLButtonElement,
    sourceButton: HTMLButtonElement,
): void {
  targetButton.className = `${sourceButton.className} bfa-art-sync__button bfa-art-sync__button--native`;
}

function findNativeSelectedPreviewContainer(
    selectedPortraitContainer: HTMLElement,
    actionContainer: HTMLElement,
): HTMLElement | null {
  for (const child of selectedPortraitContainer.children) {
    if (!isHtmlElement(child) || child === actionContainer) {
      continue;
    }

    return child;
  }

  return null;
}

function applySelectedRowLayout(
    selectedPortraitContainer: HTMLElement,
    nativePreviewContainer: HTMLElement | null,
    actionContainer: HTMLElement,
    compactLayout: boolean,
): void {
  // One column, only as wide as the longer button label or the native thumbnail.
  // A fixed fraction of the modal leaves "Edit portrait crop" wrapping, or stretches
  // the pair across the empty space where the full-art preview used to sit.
  setImportantStyle(selectedPortraitContainer, 'display', 'grid');
  setImportantStyle(selectedPortraitContainer, 'align-items', 'start');
  setImportantStyle(selectedPortraitContainer, 'gap', '12px');
  setImportantStyle(selectedPortraitContainer, 'justify-items', 'stretch');
  setImportantStyle(selectedPortraitContainer, 'justify-self', 'start');
  setImportantStyle(selectedPortraitContainer, 'max-width', '100%');
  setImportantStyle(
      selectedPortraitContainer,
      'grid-template-columns',
      compactLayout ? 'minmax(0, 1fr)' : 'max-content',
  );
  setImportantStyle(
      selectedPortraitContainer,
      'width',
      compactLayout ? '100%' : 'max-content',
  );

  if (nativePreviewContainer !== null) {
    setImportantStyle(nativePreviewContainer, 'justify-self', 'start');
    setImportantStyle(nativePreviewContainer, 'max-width', '100%');
    setImportantStyle(nativePreviewContainer, 'width', 'max-content');
    const nativePreviewImage = nativePreviewContainer.querySelector('img');
    if (isHtmlElement(nativePreviewImage)) {
      setImportantStyle(nativePreviewImage, 'height', 'auto');
      setImportantStyle(nativePreviewImage, 'max-width', '100%');
    }
  }

  setImportantStyle(actionContainer, 'display', 'grid');
  setImportantStyle(actionContainer, 'align-items', 'stretch');
  setImportantStyle(actionContainer, 'gap', '8px');
  setImportantStyle(actionContainer, 'justify-items', 'stretch');
  setImportantStyle(actionContainer, 'justify-self', 'stretch');
  setImportantStyle(actionContainer, 'max-width', '100%');
  setImportantStyle(actionContainer, 'width', '100%');
  const injectedButtonRow = actionContainer.querySelector<HTMLElement>(':scope > .bfa-art-sync__buttons');
  setImportantStyle(injectedButtonRow, 'display', 'grid');
  setImportantStyle(injectedButtonRow, 'width', '100%');
  setImportantStyle(injectedButtonRow, 'max-width', '100%');
  const nativeChangeButton = actionContainer.querySelector<HTMLButtonElement>(':scope > button');
  const injectedCropButton = injectedButtonRow?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');
  for (const button of [nativeChangeButton, injectedCropButton ?? null]) {
    setImportantStyle(button, 'box-sizing', 'border-box');
    setImportantStyle(button, 'max-width', '100%');
    setImportantStyle(button, 'min-width', compactLayout ? '0' : 'max-content');
    setImportantStyle(button, 'width', '100%');
    setImportantStyle(button, 'white-space', compactLayout ? 'normal' : 'nowrap');
  }
}

function clearSelectedPortraitLayout(uploadSection: HTMLElement): void {
  const selectedPortraitContainer = findSelectedPortraitContainer(uploadSection);
  const actionContainer = findChangePortraitButtonContainer(uploadSection);
  const nativePreviewContainer = selectedPortraitContainer === null || actionContainer === null
    ? null
    : findNativeSelectedPreviewContainer(selectedPortraitContainer, actionContainer);
  const nativePreviewImage = nativePreviewContainer?.querySelector('img') ?? null;

  selectedPortraitContainer?.classList.remove('bfa-art-sync__selected-row');
  actionContainer?.classList.remove('bfa-art-sync__selected-actions');
  nativePreviewContainer?.classList.remove('bfa-art-sync__selected-preview-container');

  for (const propertyName of [
    'display',
    'align-items',
    'gap',
    'justify-items',
    'justify-self',
    'max-width',
    'grid-template-columns',
    'width',
  ]) {
    clearImportantStyle(selectedPortraitContainer, propertyName);
  }
  for (const propertyName of ['justify-self', 'max-width', 'width']) {
    clearImportantStyle(nativePreviewContainer, propertyName);
  }
  if (isHtmlElement(nativePreviewImage)) {
    clearImportantStyle(nativePreviewImage, 'height');
    clearImportantStyle(nativePreviewImage, 'max-width');
  }
  for (const propertyName of [
    'display',
    'align-items',
    'gap',
    'justify-items',
    'justify-self',
    'max-width',
    'width',
  ]) {
    clearImportantStyle(actionContainer, propertyName);
  }
  const injectedButtonRow = actionContainer?.querySelector<HTMLElement>(':scope > .bfa-art-sync__buttons');
  for (const propertyName of ['display', 'max-width', 'width']) {
    clearImportantStyle(injectedButtonRow ?? null, propertyName);
  }
  const nativeChangeButton = actionContainer?.querySelector<HTMLButtonElement>(':scope > button') ?? null;
  const injectedCropButton = injectedButtonRow?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');
  for (const button of [nativeChangeButton, injectedCropButton ?? null]) {
    clearImportantStyle(button, 'box-sizing');
    clearImportantStyle(button, 'max-width');
    clearImportantStyle(button, 'min-width');
    clearImportantStyle(button, 'width');
    clearImportantStyle(button, 'white-space');
  }
}

function setImportantStyle(
    element: HTMLElement | null,
    propertyName: string,
    propertyValue: string,
): void {
  element?.style.setProperty(propertyName, propertyValue, 'important');
}

function clearImportantStyle(
    element: HTMLElement | null,
    propertyName: string,
): void {
  element?.style.removeProperty(propertyName);
}

function createResizeObserver(
    manager: HTMLElement,
    onResize: () => void,
    doc: Document,
): ResizeObserver | null {
  const ResizeObserverConstructor = doc.defaultView?.ResizeObserver ?? globalThis.ResizeObserver;
  if (typeof ResizeObserverConstructor !== 'function') {
    return null;
  }

  const observer = new ResizeObserverConstructor(() => {
    onResize();
  });
  observer.observe(manager);
  return observer;
}

function createButton(
    doc: Document,
    label: string,
    className: string,
    onClick: () => void,
    disabled: boolean,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.className = className;
  button.disabled = disabled;
  button.textContent = label;
  button.type = 'button';
  button.addEventListener('click', () => {
    onClick();
  });
  return button;
}

function portraitManagerLayoutCss(): string {
  // Class names stay in the selector map so a D&D Beyond rename is one edit.
  const rules = PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_CLASS;
  const file = PORTRAIT_MANAGER_UPLOAD_FILE_CLASS;
  const input = PORTRAIT_MANAGER_UPLOAD_FILE_INPUT_CLASS;
  return [
    `.bfa-art-sync--compact .${rules} {`,
    '  font-size: 12px;',
    '  line-height: 1.35;',
    '  max-width: 100%;',
    '  overflow-wrap: anywhere;',
    '}',
    `.bfa-art-sync--compact .${file},`,
    `.bfa-art-sync--compact .${input} {`,
    '  max-width: 100%;',
    '  min-width: 0;',
    '}',
  ].join('\n');
}

function ensureCharacterArtStyles(doc: Document): void {
  if (doc.head.querySelector(`[${CHARACTER_ART_STYLES_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CHARACTER_ART_STYLES_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = `${characterArtStyles}\n${portraitManagerLayoutCss()}`;
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

function scheduleRender(
    callback: () => void,
    handles: ScheduledRenderHandle[],
): void {
  handles.push(globalThis.setTimeout(callback, 0));
}

function scheduleRenderBurst(
    callback: () => void,
    handles: ScheduledRenderHandle[],
): void {
  const delaysMs = [25, 100, 250];
  for (const delayMs of delaysMs) {
    handles.push(globalThis.setTimeout(callback, delayMs));
  }
}

function clearScheduledRenders(
    handles: ScheduledRenderHandle[],
): void {
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle === undefined) {
      continue;
    }

    globalThis.clearTimeout(handle);
  }
}

async function readBlobAsArrayBuffer(
    blob: Blob,
    doc: Document,
): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  const FileReaderConstructor = doc.defaultView?.FileReader ?? globalThis.FileReader;
  if (typeof FileReaderConstructor !== 'function') {
    throw new Error('Blob reading support is unavailable.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReaderConstructor();
    reader.onerror = () => {
      reject(new Error('The selected file could not be read.'));
    };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('The selected file could not be read.'));
    };
    reader.readAsArrayBuffer(blob);
  });
}
