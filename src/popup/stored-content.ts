import type {
  CharacterArtMetadata,
  StoredCharacterArtData,
} from '../features/character-art/art-types';
import {
  deleteStoredCharacterArt,
  getStoredCharacterArtImageData,
  listStoredCharacterArtMetadata,
} from '../platform/chrome/messages';
import {
  getAllRawCharacterJournalRecords,
  readableImportedJournalRecords,
  type StoredCharacterJournalRecords,
} from '../platform/chrome/storage';
import {buildCharacterPageUrl} from '../platform/dndbeyond/urls';
import {
  createCharacterArtDownloadFileName,
  downloadBlobUrl,
} from '../shared/download';
import {
  downloadJournalExport,
  importJournalExportFile,
} from './journal-export';

interface StoredContentElements {
  emptyState: HTMLParagraphElement;
  exportAll: HTMLButtonElement;
  importAll: HTMLButtonElement;
  importInput: HTMLInputElement;
  list: HTMLUListElement;
  status: HTMLParagraphElement;
  summary: HTMLParagraphElement;
}

interface StoredCharacterContent {
  art: CharacterArtMetadata | null;
  characterId: string;
  journal: StoredCharacterJournalRecords | null;
}

export async function installStoredContent(doc: Document): Promise<void> {
  const elements = findElements(doc);
  if (elements === null) {
    return;
  }

  elements.exportAll.addEventListener('click', () => {
    void exportJournals(null, elements, doc, elements.exportAll);
  });
  elements.importAll.addEventListener('click', () => {
    chooseImport(null, elements);
  });
  elements.importInput.addEventListener('change', () => {
    const file = elements.importInput.files?.[0];
    const target = elements.importInput.dataset.characterId;
    elements.importInput.value = '';
    delete elements.importInput.dataset.characterId;
    if (file !== undefined) {
      void importJournals(file, target, elements, doc);
    }
  });

  await refresh(elements, doc);
}

async function refresh(elements: StoredContentElements, doc: Document): Promise<void> {
  elements.summary.textContent = 'Loading stored content…';
  elements.emptyState.hidden = true;
  elements.list.replaceChildren();
  try {
    const [art, journals] = await Promise.all([
      listStoredCharacterArtMetadata(),
      getAllRawCharacterJournalRecords(),
    ]);
    const content = mergeStoredContent(art, journals);
    elements.summary.textContent = content.length === 0
      ? 'No stored content.'
      : `${content.length} ${content.length === 1 ? 'character' : 'characters'}`;
    elements.emptyState.hidden = content.length !== 0;
    elements.exportAll.disabled = journals.length === 0;
    elements.list.replaceChildren(
        ...content.map((character) => createItem(character, elements, doc)),
    );
  } catch (error) {
    elements.summary.textContent = 'Stored content unavailable.';
    renderStatus(elements.status, errorMessage(error), true);
  }
}

function mergeStoredContent(
    art: readonly CharacterArtMetadata[],
    journals: readonly StoredCharacterJournalRecords[],
): StoredCharacterContent[] {
  const content = new Map<string, StoredCharacterContent>();
  for (const metadata of art) {
    content.set(metadata.characterId, {
      art: metadata,
      characterId: metadata.characterId,
      journal: null,
    });
  }
  for (const journal of journals) {
    const existing = content.get(journal.characterId);
    content.set(journal.characterId, {
      art: existing?.art ?? null,
      characterId: journal.characterId,
      journal,
    });
  }
  return [...content.values()].sort((left, right) =>
    displayName(left).localeCompare(displayName(right)));
}

function createItem(
    content: StoredCharacterContent,
    elements: StoredContentElements,
    doc: Document,
): HTMLLIElement {
  const item = doc.createElement('li');
  item.className = 'bfa-popup__stored-art-item';
  const details = doc.createElement('div');
  details.className = 'bfa-popup__stored-art-details';
  const title = doc.createElement('span');
  title.className = 'bfa-popup__stored-art-title';
  title.textContent = displayName(content);
  const meta = doc.createElement('span');
  meta.className = 'bfa-popup__stored-art-meta';
  const notes = content.journal === null
    ? 0
    : readableImportedJournalRecords(content.journal.records).length;
  meta.textContent = [
    `Character ${content.characterId}`,
    content.art === null ? null : `Full art ${formatByteSize(content.art.byteSize)}`,
    `${notes} journal ${notes === 1 ? 'note' : 'notes'}`,
  ].filter((value): value is string => value !== null).join(' · ');
  details.append(title, meta);

  const openLink = doc.createElement('a');
  openLink.className = 'bfa-popup__button';
  openLink.href = buildCharacterPageUrl(content.characterId);
  openLink.rel = 'noopener';
  openLink.target = '_blank';
  openLink.textContent = 'Open character';
  const actions = doc.createElement('div');
  actions.className = 'bfa-popup__stored-art-actions';
  actions.append(openLink);

  const art = content.art;
  if (art !== null) {
    actions.append(actionGroup(doc, 'Full art', [
      actionButton(doc, 'Download', () => {
        void downloadArt(art, elements, doc);
      }),
      actionButton(doc, 'Delete', () => {
        void deleteArt(art, elements, doc);
      }, true),
    ]));
  }

  const journalActions = [];
  const journal = content.journal;
  if (journal !== null) {
    journalActions.push(actionButton(doc, 'Export', (button) => {
      void exportJournals(journal, elements, doc, button);
    }));
  }
  journalActions.push(actionButton(doc, 'Import', () => {
    chooseImport(content.characterId, elements);
  }));
  actions.append(actionGroup(doc, 'Journal', journalActions));
  item.append(details, actions);
  return item;
}

function actionGroup(
    doc: Document,
    label: string,
    buttons: readonly HTMLButtonElement[],
): HTMLElement {
  const group = doc.createElement('div');
  group.className = 'bfa-popup__content-actions';
  const title = doc.createElement('span');
  title.className = 'bfa-popup__content-actions-label';
  title.textContent = label;
  group.append(title, ...buttons);
  return group;
}

function actionButton(
    doc: Document,
    label: string,
    onClick: (button: HTMLButtonElement) => void,
    danger = false,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.className = `bfa-popup__button${danger ? ' bfa-popup__button--danger' : ''}`;
  button.textContent = label;
  button.type = 'button';
  button.addEventListener('click', () => onClick(button));
  return button;
}

async function exportJournals(
    journal: StoredCharacterJournalRecords | null,
    elements: StoredContentElements,
    doc: Document,
    button: HTMLButtonElement,
): Promise<void> {
  button.disabled = true;
  renderStatus(elements.status, 'Preparing journal export…', false);
  try {
    const journals = journal === null
      ? await getAllRawCharacterJournalRecords()
      : [journal];
    const result = await downloadJournalExport(journals, doc);
    renderStatus(
        elements.status,
        result.missingPhotos === 0
          ? 'Journal export downloaded.'
          : `Journal export downloaded with ${result.missingPhotos} missing ${result.missingPhotos === 1 ? 'photo' : 'photos'}.`,
        result.missingPhotos > 0,
    );
  } catch (error) {
    renderStatus(elements.status, errorMessage(error), true);
  } finally {
    button.disabled = false;
  }
}

function chooseImport(characterId: string | null, elements: StoredContentElements): void {
  elements.importInput.value = '';
  if (characterId === null) {
    delete elements.importInput.dataset.characterId;
  } else {
    elements.importInput.dataset.characterId = characterId;
  }
  elements.importInput.click();
}

async function importJournals(
    file: File,
    characterId: string | undefined,
    elements: StoredContentElements,
    doc: Document,
): Promise<void> {
  renderStatus(elements.status, 'Importing journal backup…', false);
  try {
    const result = await importJournalExportFile(file, doc, characterId);
    await refresh(elements, doc);
    renderStatus(
        elements.status,
        `Imported ${result.notes} ${result.notes === 1 ? 'note' : 'notes'} for ${result.characters} ${result.characters === 1 ? 'character' : 'characters'}${result.missingPhotos === 0 ? '.' : ` with ${result.missingPhotos} missing photos.`}`,
        result.missingPhotos > 0,
    );
  } catch (error) {
    renderStatus(elements.status, errorMessage(error), true);
  }
}

async function downloadArt(
    metadata: CharacterArtMetadata,
    elements: StoredContentElements,
    doc: Document,
): Promise<void> {
  const imageData = await getStoredCharacterArtImageData(metadata.characterId);
  if (imageData === null) {
    await refresh(elements, doc);
    renderStatus(elements.status, 'Stored full art could not be found.', true);
    return;
  }
  downloadStoredImageData(metadata.characterId, imageData, doc);
  renderStatus(elements.status, 'Stored full art download started.', false);
}

async function deleteArt(
    metadata: CharacterArtMetadata,
    elements: StoredContentElements,
    doc: Document,
): Promise<void> {
  if (!doc.defaultView?.confirm(
      `Delete stored full art for character ${metadata.characterId}? This does not change D&D Beyond.`,
  )) {
    return;
  }
  try {
    await deleteStoredCharacterArt(metadata.characterId);
    await refresh(elements, doc);
    renderStatus(elements.status, 'Stored full art deleted.', false);
  } catch (error) {
    renderStatus(elements.status, errorMessage(error), true);
  }
}

function downloadStoredImageData(
    characterId: string,
    imageData: StoredCharacterArtData,
    doc: Document,
): void {
  const objectUrl = URL.createObjectURL(
      new Blob([imageData.byteBuffer], {type: imageData.mimeType}),
  );
  downloadBlobUrl(
      objectUrl,
      imageData.fileName || createCharacterArtDownloadFileName(characterId),
      doc,
  );
  doc.defaultView?.setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(objectUrl);
    }
  }, 0);
}

function displayName(content: StoredCharacterContent): string {
  const fileName = content.art?.fileName.trim();
  if (fileName === undefined || fileName === '') {
    return `Character ${content.characterId}`;
  }
  return fileName.replace(/\.[^.]+$/, '') || fileName;
}

function findElements(doc: Document): StoredContentElements | null {
  const emptyState = doc.querySelector<HTMLParagraphElement>('#stored-content-empty');
  const exportAll = doc.querySelector<HTMLButtonElement>('#stored-content-export-all');
  const importAll = doc.querySelector<HTMLButtonElement>('#stored-content-import-all');
  const importInput = doc.querySelector<HTMLInputElement>('#stored-content-import-file');
  const list = doc.querySelector<HTMLUListElement>('#stored-content-list');
  const status = doc.querySelector<HTMLParagraphElement>('#stored-content-status');
  const summary = doc.querySelector<HTMLParagraphElement>('#stored-content-summary');
  if (emptyState === null || exportAll === null || importAll === null
    || importInput === null || list === null || status === null || summary === null) {
    return null;
  }
  return {emptyState, exportAll, importAll, importInput, list, status, summary};
}

function renderStatus(status: HTMLParagraphElement, message: string, error: boolean): void {
  status.textContent = message;
  status.classList.toggle('bfa-popup__status--hidden', message === '');
  status.classList.toggle('bfa-popup__status--error', error);
  status.classList.toggle('bfa-popup__status--success', !error && message !== '');
}

function formatByteSize(byteSize: number): string {
  if (byteSize < 1024) {
    return `${byteSize} B`;
  }
  const kibibytes = byteSize / 1024;
  return kibibytes < 1024
    ? `${kibibytes.toFixed(1)} KB`
    : `${(kibibytes / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'Stored content could not be updated.';
}
