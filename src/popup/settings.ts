import settingsStyles from './settings.css?raw';
import type {
  CharacterArtMetadata,
  StoredCharacterArtData,
} from '../features/character-art/art-types';
import {
  deleteStoredCharacterArt,
  getStoredCharacterArtImageData,
  listStoredCharacterArtMetadata,
} from '../platform/chrome/messages';
import {buildCharacterPageUrl} from '../platform/dndbeyond/urls';
import {
  getCampaignCardPortraitUpgradeEnabled,
  setCampaignCardPortraitUpgradeEnabled,
} from '../platform/chrome/storage';
import {
  createCharacterArtDownloadFileName,
  downloadBlobUrl,
} from '../shared/download';

const SETTINGS_STYLE_ATTRIBUTE_NAME = 'data-bfa-popup-styles';
const HIDDEN_STATUS_CLASS_NAME = 'bfa-popup__status--hidden';
const ERROR_STATUS_CLASS_NAME = 'bfa-popup__status--error';
const SUCCESS_STATUS_CLASS_NAME = 'bfa-popup__status--success';

void initializePopup(document);

export async function initializePopup(doc: Document): Promise<void> {
  ensureStyles(doc);

  const checkbox = doc.querySelector<HTMLInputElement>(
      '#campaign-card-portrait-upgrade',
  );
  const status = doc.querySelector<HTMLParagraphElement>(
      '#campaign-card-portrait-upgrade-status',
  );
  if (checkbox === null || status === null) {
    return;
  }

  checkbox.checked = await getCampaignCardPortraitUpgradeEnabled();
  checkbox.addEventListener('change', () => {
    void handleCheckboxChange(checkbox, status);
  });

  const inventory = findInventoryElements(doc);
  if (inventory !== null) {
    await refreshStoredArtInventory(inventory, doc);
  }
}

async function handleCheckboxChange(
    checkbox: HTMLInputElement,
    status: HTMLParagraphElement,
): Promise<void> {
  checkbox.disabled = true;
  try {
    await setCampaignCardPortraitUpgradeEnabled(checkbox.checked);
    renderStatus(
        status,
        checkbox.checked
          ? 'Character card portrait enhancement enabled.'
          : 'Character card portrait enhancement disabled.',
        false,
    );
  } catch (error) {
    checkbox.checked = !checkbox.checked;
    renderStatus(
        status,
        asErrorMessage(error),
        true,
    );
  } finally {
    checkbox.disabled = false;
  }
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Setting could not be updated.';
}

function ensureStyles(doc: Document): void {
  if (doc.head.querySelector(`[${SETTINGS_STYLE_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(SETTINGS_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = settingsStyles;
  doc.head.append(styleElement);
}

function renderStatus(
    status: HTMLParagraphElement,
    message: string,
    isError: boolean,
): void {
  status.textContent = message;
  status.classList.toggle(HIDDEN_STATUS_CLASS_NAME, message === '');
  status.classList.toggle(ERROR_STATUS_CLASS_NAME, isError);
  status.classList.toggle(SUCCESS_STATUS_CLASS_NAME, !isError && message !== '');
}

interface InventoryElements {
  emptyState: HTMLParagraphElement;
  list: HTMLUListElement;
  status: HTMLParagraphElement;
  summary: HTMLParagraphElement;
}

function findInventoryElements(doc: Document): InventoryElements | null {
  const emptyState = doc.querySelector<HTMLParagraphElement>(
      '#stored-art-empty',
  );
  const list = doc.querySelector<HTMLUListElement>('#stored-art-list');
  const status = doc.querySelector<HTMLParagraphElement>('#stored-art-status');
  const summary = doc.querySelector<HTMLParagraphElement>('#stored-art-summary');

  if (
    emptyState === null
    || list === null
    || status === null
    || summary === null
  ) {
    return null;
  }

  return {
    emptyState,
    list,
    status,
    summary,
  };
}

async function refreshStoredArtInventory(
    elements: InventoryElements,
    doc: Document,
): Promise<void> {
  renderInventoryLoading(elements);

  try {
    const metadata = await listStoredCharacterArtMetadata();
    renderInventory(elements, metadata, doc);
    renderStatus(elements.status, '', false);
  } catch (error) {
    renderInventory(elements, [], doc);
    renderStatus(elements.status, asErrorMessage(error), true);
  }
}

function renderInventoryLoading(elements: InventoryElements): void {
  elements.summary.textContent = 'Loading stored art...';
  elements.emptyState.hidden = true;
  elements.list.replaceChildren();
}

function renderInventory(
    elements: InventoryElements,
    metadata: CharacterArtMetadata[],
    doc: Document,
): void {
  const totalBytes = metadata.reduce((total, item) => total + item.byteSize, 0);
  elements.summary.textContent = metadata.length === 0
    ? 'No stored full art.'
    : `${formatCount(metadata.length)} / ${formatByteSize(totalBytes)}`;
  elements.emptyState.hidden = metadata.length !== 0;
  elements.list.replaceChildren(
      ...metadata.map((item) => createInventoryItem(item, elements, doc)),
  );
}

function createInventoryItem(
    metadata: CharacterArtMetadata,
    elements: InventoryElements,
    doc: Document,
): HTMLLIElement {
  const item = doc.createElement('li');
  item.className = 'bfa-popup__stored-art-item';

  const details = doc.createElement('div');
  details.className = 'bfa-popup__stored-art-details';

  const title = doc.createElement('span');
  title.className = 'bfa-popup__stored-art-title';
  title.textContent = metadata.fileName;

  const meta = doc.createElement('span');
  meta.className = 'bfa-popup__stored-art-meta';
  meta.textContent = [
    `Character ${metadata.characterId}`,
    formatByteSize(metadata.byteSize),
    `Updated ${formatDate(metadata.updatedAt)}`,
  ].join(' - ');

  details.append(title, meta);

  const actions = doc.createElement('div');
  actions.className = 'bfa-popup__stored-art-actions';

  const openLink = doc.createElement('a');
  openLink.className = 'bfa-popup__button';
  openLink.href = buildCharacterPageUrl(metadata.characterId);
  openLink.rel = 'noopener';
  openLink.target = '_blank';
  openLink.textContent = 'Open';

  const downloadButton = doc.createElement('button');
  downloadButton.className = 'bfa-popup__button';
  downloadButton.textContent = 'Download';
  downloadButton.type = 'button';
  downloadButton.addEventListener('click', () => {
    void handleDownloadClick(metadata, elements, doc, downloadButton);
  });

  const deleteButton = doc.createElement('button');
  deleteButton.className = 'bfa-popup__button bfa-popup__button--danger';
  deleteButton.textContent = 'Delete';
  deleteButton.type = 'button';
  deleteButton.addEventListener('click', () => {
    void handleDeleteClick(metadata, elements, doc, deleteButton);
  });

  actions.append(openLink, downloadButton, deleteButton);
  item.append(details, actions);
  return item;
}

async function handleDownloadClick(
    metadata: CharacterArtMetadata,
    elements: InventoryElements,
    doc: Document,
    button: HTMLButtonElement,
): Promise<void> {
  button.disabled = true;
  try {
    const imageData = await getStoredCharacterArtImageData(metadata.characterId);
    if (imageData === null) {
      await refreshStoredArtInventory(elements, doc);
      renderStatus(elements.status, 'Stored full art could not be found.', true);
      return;
    }

    downloadStoredImageData(metadata.characterId, imageData, doc);
    renderStatus(elements.status, 'Stored full art download started.', false);
  } catch (error) {
    renderStatus(elements.status, asErrorMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

async function handleDeleteClick(
    metadata: CharacterArtMetadata,
    elements: InventoryElements,
    doc: Document,
    button: HTMLButtonElement,
): Promise<void> {
  const popupWindow = doc.defaultView;
  if (
    popupWindow === null
    || !popupWindow.confirm(
        `Delete stored full art for character ${metadata.characterId}? This does not change D&D Beyond.`,
    )
  ) {
    return;
  }

  button.disabled = true;
  try {
    await deleteStoredCharacterArt(metadata.characterId);
    await refreshStoredArtInventory(elements, doc);
    renderStatus(elements.status, 'Stored full art deleted.', false);
  } catch (error) {
    renderStatus(elements.status, asErrorMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

function downloadStoredImageData(
    characterId: string,
    imageData: StoredCharacterArtData,
    doc: Document,
): void {
  const blob = new Blob([imageData.byteBuffer], {type: imageData.mimeType});
  const objectUrl = URL.createObjectURL(blob);
  downloadBlobUrl(
      objectUrl,
      imageData.fileName || createCharacterArtDownloadFileName(characterId),
      doc,
  );
  doc.defaultView?.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

function formatCount(count: number): string {
  return count === 1 ? '1 stored artwork' : `${count} stored artworks`;
}

function formatByteSize(byteSize: number): string {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  const kibibytes = byteSize / 1024;
  if (kibibytes < 1024) {
    return `${kibibytes.toFixed(1)} KB`;
  }

  return `${(kibibytes / 1024).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }

  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
