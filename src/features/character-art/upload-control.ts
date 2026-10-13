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
  PORTRAIT_MANAGER_CUSTOM_SECTION_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_FORM_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_HEADING_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
} from '../../platform/dndbeyond/selectors';
import {
  findChangePortraitButton,
  findChangePortraitButtonContainer,
  findCurrentCustomContent,
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

interface StoredArtPreviewState {
  imageUrl: string;
  releaseImageUrl: Cleanup | null;
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
    currentPreview: null as StoredArtPreviewState | null,
    destroyed: false,
    fullArtMetadata: null as CharacterArtMetadata | null,
    isBusy: false,
    pendingSelectedFile: null as File | null,
    pendingSelectedFileCrop: null as PendingPortraitCropState | null,
    portraitCropMetadata: null as CharacterPortraitCropMetadata | null,
    proposedPreview: null as StoredArtPreviewState | null,
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
  const topLayout = doc.createElement('section');
  topLayout.className = 'bfa-art-sync__top-layout';
  const topMain = doc.createElement('div');
  topMain.className = 'bfa-art-sync__top-main';
  const uploadIntro = doc.createElement('div');
  uploadIntro.className = 'bfa-art-sync__upload-intro';
  const currentPreviewPanel = createPreviewPanel(doc, 'Current Full Art');
  const proposedPreviewPanel = createPreviewPanel(doc, 'Proposed Full Art');
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
    setProposedPreviewFromFile(selectedFile ?? null);
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
    const result = await service.saveArt(characterId, selectedFile);

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

  ensureTopLayout();
  render();
  void refresh();

  return {
    cleanup() {
      state.destroyed = true;
      clearScheduledRenders(state.scheduledRenderHandles);
      releasePreview(state.currentPreview);
      releasePreview(state.proposedPreview);
      resizeObserver?.disconnect();
      target.manager.removeEventListener('change', onManagerChange);
      target.manager.removeEventListener('click', onManagerClick);
      currentPreviewPanel.panel.remove();
      proposedPreviewPanel.panel.remove();
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

    ensureTopLayout();
    syncLayoutMode();
    mountCropButton();
    renderStatus(statusText, state.status);
    renderCurrentPreview();
    renderProposedPreview();
    const controlsOwnVisibleButtonRow =
      buttonRow.parentElement === controls && !buttonRow.hidden;
    controls.hidden =
      !controlsOwnVisibleButtonRow
      && state.proposedPreview === null
      && statusText.hidden;
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
    releasePreview(state.currentPreview);
    state.currentPreview = null;
    if (state.fullArtMetadata === null) {
      return;
    }

    const resolution = await service.resolveViewerImage(
        characterId,
        resolveFallbackViewerImage(target.manager),
    );
    if (state.destroyed) {
      resolution.releaseImageUrl?.();
      return;
    }

    if (!resolution.usingStoredArt) {
      resolution.releaseImageUrl?.();
      return;
    }

    state.currentPreview = {
      imageUrl: resolution.imageUrl,
      releaseImageUrl: resolution.releaseImageUrl ?? null,
    };
  }

  function renderCurrentPreview() {
    if (state.currentPreview === null || isCompactLayout(target.manager)) {
      currentPreviewPanel.panel.hidden = true;
      currentPreviewPanel.image.removeAttribute('src');
      return;
    }

    currentPreviewPanel.panel.hidden = false;
    currentPreviewPanel.image.src = state.currentPreview.imageUrl;
    if (currentPreviewPanel.panel.parentElement !== topLayout) {
      topLayout.append(currentPreviewPanel.panel);
    }
  }

  function renderProposedPreview() {
    if (state.proposedPreview === null) {
      proposedPreviewPanel.panel.hidden = true;
      proposedPreviewPanel.image.removeAttribute('src');
      clearSelectedRowLayout(target.uploadSection, proposedPreviewPanel.panel);
      return;
    }

    const compactLayout = isCompactLayout(target.manager);
    proposedPreviewPanel.panel.hidden = compactLayout;
    proposedPreviewPanel.image.src = state.proposedPreview.imageUrl;
    const selectedPortraitContainer = findSelectedPortraitContainer(target.uploadSection);
    if (selectedPortraitContainer === null) {
      return;
    }

    selectedPortraitContainer.classList.add('bfa-art-sync__selected-row');
    const actionContainer = findChangePortraitButtonContainer(target.uploadSection);
    if (actionContainer === null) {
      return;
    }
    const selectedControlsColumn = ensureSelectedControlsColumn(doc, selectedPortraitContainer);
    const nativePreviewContainer = findNativeSelectedPreviewContainer(
        selectedPortraitContainer,
        selectedControlsColumn,
        actionContainer,
        proposedPreviewPanel.panel,
    );
    nativePreviewContainer?.classList.add('bfa-art-sync__selected-preview-container');
    actionContainer.classList.add('bfa-art-sync__selected-actions');
    if (selectedControlsColumn.parentElement !== selectedPortraitContainer) {
      selectedPortraitContainer.prepend(selectedControlsColumn);
    }
    if (nativePreviewContainer !== null
      && nativePreviewContainer.parentElement !== selectedControlsColumn) {
      selectedControlsColumn.append(nativePreviewContainer);
    }
    if (actionContainer.parentElement !== selectedControlsColumn) {
      selectedControlsColumn.append(actionContainer);
    }
    applySelectedRowLayout(
        selectedPortraitContainer,
        selectedControlsColumn,
        nativePreviewContainer,
        actionContainer,
        proposedPreviewPanel.panel,
        compactLayout,
    );

    if (compactLayout) {
      proposedPreviewPanel.panel.remove();
      return;
    }

    if (proposedPreviewPanel.panel.parentElement !== selectedPortraitContainer) {
      selectedPortraitContainer.append(proposedPreviewPanel.panel);
    }
  }

  function setProposedPreviewFromFile(file: File | null) {
    releasePreview(state.proposedPreview);
    state.proposedPreview =
      file === null ? null : createPreviewFromFile(file);
  }

  function ensureTopLayout() {
    const customSection = target.manager.querySelector<HTMLElement>(
        PORTRAIT_MANAGER_CUSTOM_SECTION_SELECTOR,
    );
    const uploadHeading = target.uploadSection.querySelector<HTMLElement>(
        PORTRAIT_MANAGER_UPLOAD_HEADING_SELECTOR,
    );
    const uploadHeadingRules = target.uploadSection.querySelector<HTMLElement>(
        PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_SELECTOR,
    );
    const uploadForm = target.uploadSection.querySelector<HTMLElement>(
        PORTRAIT_MANAGER_UPLOAD_FORM_SELECTOR,
    );

    if (customSection === null || uploadHeading === null || uploadForm === null) {
      return;
    }

    if (originalUploadRulesText === null && uploadHeadingRules !== null) {
      originalUploadRulesText = uploadHeadingRules.textContent?.trim() ?? '';
    }

    topMain.classList.add('bfa-art-sync__top-column');
    uploadIntro.classList.add('bfa-art-sync__top-column');
    if (customSection.parentElement !== topMain) {
      topMain.append(customSection);
    }
    if (uploadHeading.parentElement !== uploadIntro) {
      uploadIntro.append(uploadHeading);
    }
    if (uploadForm.parentElement !== uploadIntro) {
      uploadIntro.append(uploadForm);
    }
    if (uploadIntro.parentElement !== topMain) {
      topMain.append(uploadIntro);
    }
    if (topMain.parentElement !== topLayout) {
      topLayout.prepend(topMain);
    }
    if (topLayout.parentElement !== target.manager) {
      target.manager.prepend(topLayout);
    }

    const customContent = findCurrentCustomContent(target.manager);
    customContent?.classList.add('bfa-art-sync__custom-content');
  }

  function syncLayoutMode() {
    const compactLayout = isCompactLayout(target.manager);
    controls.classList.toggle('bfa-art-sync--compact', compactLayout);
    topLayout.classList.toggle('bfa-art-sync__top-layout--compact', compactLayout);

    const uploadHeadingRules = target.manager.querySelector<HTMLElement>(
        PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_SELECTOR,
    );
    if (uploadHeadingRules !== null) {
      uploadHeadingRules.textContent = compactLayout
        ? COMPACT_UPLOAD_RULES_TEXT
        : (originalUploadRulesText ?? uploadHeadingRules.textContent ?? '');
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

function createPreviewPanel(
    doc: Document,
    label: string,
): {image: HTMLImageElement; panel: HTMLElement} {
  const panel = doc.createElement('aside');
  panel.className = 'bfa-art-sync__preview';
  panel.hidden = true;
  const previewLabel = doc.createElement('p');
  previewLabel.className = 'bfa-art-sync__preview-label';
  previewLabel.textContent = label;
  const image = doc.createElement('img');
  image.className = 'bfa-art-sync__preview-image';
  image.alt = `${label} preview`;
  panel.append(previewLabel, image);
  return {image, panel};
}

function findNativeSelectedPreviewContainer(
    selectedPortraitContainer: HTMLElement,
    selectedControlsColumn: HTMLElement,
    actionContainer: HTMLElement,
    proposedPreviewPanel: HTMLElement,
): HTMLElement | null {
  for (const child of selectedPortraitContainer.children) {
    if (!isHtmlElement(child)) {
      continue;
    }

    if (child === selectedControlsColumn
      || child === actionContainer
      || child === proposedPreviewPanel) {
      continue;
    }

    return child;
  }

  return null;
}

function applySelectedRowLayout(
    selectedPortraitContainer: HTMLElement,
    selectedControlsColumn: HTMLElement,
    nativePreviewContainer: HTMLElement | null,
    actionContainer: HTMLElement,
    proposedPreviewPanel: HTMLElement,
    compactLayout: boolean,
): void {
  setImportantStyle(selectedPortraitContainer, 'display', 'grid');
  setImportantStyle(selectedPortraitContainer, 'align-items', 'start');
  setImportantStyle(selectedPortraitContainer, 'column-gap', compactLayout ? '16px' : '28px');
  setImportantStyle(
      selectedPortraitContainer,
      'grid-template-columns',
      compactLayout ? '1fr' : 'max-content minmax(0, 1fr)',
  );

  setImportantStyle(selectedControlsColumn, 'display', 'grid');
  setImportantStyle(selectedControlsColumn, 'align-content', 'start');
  setImportantStyle(selectedControlsColumn, 'gap', compactLayout ? '12px' : '18px');
  setImportantStyle(selectedControlsColumn, 'grid-column', '1');
  setImportantStyle(selectedControlsColumn, 'justify-items', compactLayout ? 'start' : 'center');
  setImportantStyle(selectedControlsColumn, 'width', compactLayout ? '100%' : 'max-content');

  if (nativePreviewContainer !== null) {
    setImportantStyle(nativePreviewContainer, 'display', 'grid');
    setImportantStyle(nativePreviewContainer, 'justify-self', compactLayout ? 'start' : 'center');
    setImportantStyle(nativePreviewContainer, 'min-width', '0');
    setImportantStyle(nativePreviewContainer, 'width', 'max-content');
    const nativePreviewHeading = nativePreviewContainer.firstElementChild;
    if (isHtmlElement(nativePreviewHeading)) {
      setImportantStyle(nativePreviewHeading, 'box-sizing', 'border-box');
      setImportantStyle(nativePreviewHeading, 'text-align', 'center');
      setImportantStyle(nativePreviewHeading, 'width', '100%');
    }
  }

  setImportantStyle(actionContainer, 'display', 'grid');
  setImportantStyle(actionContainer, 'align-content', 'start');
  setImportantStyle(actionContainer, 'gap', compactLayout ? '10px' : '14px');
  setImportantStyle(actionContainer, 'justify-self', compactLayout ? 'start' : 'center');
  setImportantStyle(actionContainer, 'min-width', '0');
  setImportantStyle(
      actionContainer,
      'width',
      compactLayout ? 'min(100%, 220px)' : 'max-content',
  );

  const injectedButtonRow = actionContainer.querySelector<HTMLElement>(':scope > .bfa-art-sync__buttons');
  setImportantStyle(injectedButtonRow, 'width', compactLayout ? '100%' : 'auto');
  setImportantStyle(injectedButtonRow, 'justify-items', compactLayout ? 'stretch' : 'start');
  const injectedCropButton = injectedButtonRow?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');
  const nativeChangeButton = actionContainer.querySelector<HTMLButtonElement>(
      ':scope > button',
  );
  const buttonWidth = computeUniformButtonWidth(nativeChangeButton, injectedCropButton ?? null);
  if (compactLayout) {
    setImportantStyle(nativeChangeButton, 'width', '100%');
    setImportantStyle(injectedCropButton ?? null, 'width', '100%');
  } else {
    setUniformButtonWidth(nativeChangeButton, buttonWidth);
    setUniformButtonWidth(injectedCropButton ?? null, buttonWidth);
  }

  setImportantStyle(proposedPreviewPanel, 'grid-column', '2');
  setImportantStyle(proposedPreviewPanel, 'align-self', 'start');
  setImportantStyle(proposedPreviewPanel, 'min-width', '0');
  setImportantStyle(proposedPreviewPanel, 'width', compactLayout ? '0' : 'min(100%, 360px)');
  const proposedPreviewImage = proposedPreviewPanel.querySelector<HTMLImageElement>(
      '.bfa-art-sync__preview-image',
  );
  setImportantStyle(proposedPreviewImage ?? null, 'max-height', compactLayout ? '0' : '280px');
}

function clearSelectedRowLayout(
    uploadSection: HTMLElement,
    proposedPreviewPanel: HTMLElement,
): void {
  const selectedPortraitContainer = findSelectedPortraitContainer(uploadSection);
  const actionContainer = findChangePortraitButtonContainer(uploadSection);
  const selectedControlsColumn = selectedPortraitContainer?.querySelector<HTMLElement>(
      ':scope > .bfa-art-sync__selected-controls',
  ) ?? null;
  const nativePreviewContainer = selectedPortraitContainer === null || actionContainer === null
    ? null
    : findNativeSelectedPreviewContainer(
        selectedPortraitContainer,
        selectedControlsColumn ?? createDetachedElement(uploadSection.ownerDocument),
        actionContainer,
        proposedPreviewPanel,
    );

  clearImportantStyle(selectedPortraitContainer, 'display');
  clearImportantStyle(selectedPortraitContainer, 'align-items');
  clearImportantStyle(selectedPortraitContainer, 'column-gap');
  clearImportantStyle(selectedPortraitContainer, 'grid-template-columns');
  clearImportantStyle(selectedControlsColumn, 'display');
  clearImportantStyle(selectedControlsColumn, 'align-content');
  clearImportantStyle(selectedControlsColumn, 'gap');
  clearImportantStyle(selectedControlsColumn, 'grid-column');
  clearImportantStyle(selectedControlsColumn, 'justify-items');
  clearImportantStyle(selectedControlsColumn, 'width');

  clearImportantStyle(nativePreviewContainer, 'display');
  clearImportantStyle(nativePreviewContainer, 'justify-self');
  clearImportantStyle(nativePreviewContainer, 'min-width');
  clearImportantStyle(nativePreviewContainer, 'width');
  const nativePreviewHeading = nativePreviewContainer?.firstElementChild ?? null;
  if (isHtmlElement(nativePreviewHeading)) {
    clearImportantStyle(nativePreviewHeading, 'box-sizing');
    clearImportantStyle(nativePreviewHeading, 'text-align');
    clearImportantStyle(nativePreviewHeading, 'width');
  }

  clearImportantStyle(actionContainer, 'display');
  clearImportantStyle(actionContainer, 'align-content');
  clearImportantStyle(actionContainer, 'gap');
  clearImportantStyle(actionContainer, 'justify-self');
  clearImportantStyle(actionContainer, 'min-width');
  clearImportantStyle(actionContainer, 'width');
  const injectedButtonRow = actionContainer?.querySelector<HTMLElement>(':scope > .bfa-art-sync__buttons');
  clearImportantStyle(injectedButtonRow ?? null, 'width');
  clearImportantStyle(injectedButtonRow ?? null, 'justify-items');
  const nativeChangeButton = actionContainer?.querySelector<HTMLButtonElement>(':scope > button') ?? null;
  clearImportantStyle(nativeChangeButton, 'width');
  const injectedCropButton = injectedButtonRow?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');
  clearImportantStyle(injectedCropButton ?? null, 'width');

  clearImportantStyle(proposedPreviewPanel, 'grid-column');
  clearImportantStyle(proposedPreviewPanel, 'align-self');
  clearImportantStyle(proposedPreviewPanel, 'min-width');
  clearImportantStyle(proposedPreviewPanel, 'width');
  const proposedPreviewImage = proposedPreviewPanel.querySelector<HTMLImageElement>(
      '.bfa-art-sync__preview-image',
  );
  clearImportantStyle(proposedPreviewImage ?? null, 'max-height');

  if (selectedPortraitContainer !== null && selectedControlsColumn !== null) {
    while (selectedControlsColumn.firstChild !== null) {
      selectedPortraitContainer.insertBefore(selectedControlsColumn.firstChild, selectedControlsColumn);
    }
    selectedControlsColumn.remove();
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

function ensureSelectedControlsColumn(
    doc: Document,
    selectedPortraitContainer: HTMLElement,
): HTMLElement {
  for (const child of selectedPortraitContainer.children) {
    if (!isHtmlElement(child)) {
      continue;
    }

    if (child.classList.contains('bfa-art-sync__selected-controls')) {
      return child;
    }
  }

  const selectedControlsColumn = doc.createElement('div');
  selectedControlsColumn.className = 'bfa-art-sync__selected-controls';
  return selectedControlsColumn;
}

function createDetachedElement(doc: Document): HTMLElement {
  return doc.createElement('div');
}

function computeUniformButtonWidth(
    nativeChangeButton: HTMLButtonElement | null,
    injectedCropButton: HTMLButtonElement | null,
): number {
  const nativeWidth = nativeChangeButton?.getBoundingClientRect().width ?? 0;
  const injectedWidth = injectedCropButton?.getBoundingClientRect().width ?? 0;
  return Math.ceil(Math.max(nativeWidth, injectedWidth));
}

function setUniformButtonWidth(
    button: HTMLButtonElement | null,
    width: number,
): void {
  if (button === null || width <= 0) {
    return;
  }

  setImportantStyle(button, 'width', `${width}px`);
}

function createPreviewFromFile(file: File): StoredArtPreviewState | null {
  const objectUrl = tryCreateObjectUrl(file);
  if (objectUrl === null) {
    return null;
  }

  return {
    imageUrl: objectUrl,
    releaseImageUrl: () => {
      revokeObjectUrl(objectUrl);
    },
  };
}

function releasePreview(preview: StoredArtPreviewState | null): void {
  preview?.releaseImageUrl?.();
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

function tryCreateObjectUrl(file: File): string | null {
  const urlConstructor = globalThis.URL as typeof URL & {
    createObjectURL?: (blob: Blob) => string;
  };
  if (typeof urlConstructor.createObjectURL !== 'function') {
    return null;
  }

  return urlConstructor.createObjectURL(file);
}

function revokeObjectUrl(objectUrl: string): void {
  const urlConstructor = globalThis.URL as typeof URL & {
    revokeObjectURL?: (value: string) => void;
  };
  if (typeof urlConstructor.revokeObjectURL !== 'function') {
    return;
  }

  urlConstructor.revokeObjectURL(objectUrl);
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
