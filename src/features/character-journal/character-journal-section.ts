import journalStyles from './character-journal.css?raw';
import type {CharacterId} from '../character-art/art-types';
import type {CharacterJournalService} from './character-journal-service';
import {createJournalPhotoViewer} from './character-journal-photo-viewer';
import type {
  CharacterJournalEntry,
  CharacterJournalImageBlock,
  CharacterJournalTextEntryDraft,
} from './character-journal-types';
import {
  getImageBlocks,
  getTextFromJournalEntry,
  normalizeJournalEntryTitle,
} from './character-journal-types';
import {
  filterJournalEntries,
  formatPhotoCount,
  getJournalEmptyMessage,
  getJournalEntryPreview,
  orderJournalEntries,
  type JournalPhotoFilter,
  type JournalSortOrder,
} from './character-journal-query';
import {CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

type JournalStatusTone = 'error' | 'info' | 'success';
type PendingConfirm =
  | {imageId: string; type: 'remove-photo'}
  | {action: () => void; type: 'discard'}
  | {entryId: string; type: 'delete'};

export interface CharacterJournalSection {
  destroy(): void;
  hide(): void;
  isShown(): boolean;
  show(options: CharacterJournalSectionShowOptions): Promise<void>;
}

export interface CharacterJournalSectionShowOptions {
  characterId: CharacterId;
  contentHost: HTMLElement;
  tab: HTMLElement;
}

interface HiddenElementState {
  hidden: boolean;
}

interface JournalSectionElements {
  addPhotoButton: HTMLButtonElement;
  allFilterButton: HTMLButtonElement;
  bodyInput: HTMLTextAreaElement;
  confirmAcceptButton: HTMLButtonElement;
  confirmCancelButton: HTMLButtonElement;
  confirmRegion: HTMLDivElement;
  confirmText: HTMLParagraphElement;
  deleteButton: HTMLButtonElement;
  entryList: HTMLDivElement;
  imageStrip: HTMLDivElement;
  newButton: HTMLButtonElement;
  newestSortButton: HTMLButtonElement;
  oldestSortButton: HTMLButtonElement;
  photoInput: HTMLInputElement;
  photosFilterButton: HTMLButtonElement;
  root: HTMLElement;
  saveButton: HTMLButtonElement;
  searchInput: HTMLInputElement;
  status: HTMLParagraphElement;
  titleInput: HTMLInputElement;
}

export function createCharacterJournalSection(
    service: CharacterJournalService,
    doc: Document = document,
): CharacterJournalSection {
  ensureJournalStyles(doc);

  const elements = createJournalElements(doc);
  const photoViewer = createJournalPhotoViewer(doc);
  const hiddenElements = new Map<HTMLElement, HiddenElementState>();
  const photoUrls = new Map<string, string | null>();
  const photoLoads = new Set<string>();
  const state = {
    characterId: null as CharacterId | null,
    contentHost: null as HTMLElement | null,
    entries: [] as CharacterJournalEntry[],
    isBusy: false,
    pendingConfirm: null as PendingConfirm | null,
    photoFilter: 'all' as JournalPhotoFilter,
    query: '',
    selectedEntryId: null as string | null,
    sortOrder: 'newest' as JournalSortOrder,
    tab: null as HTMLElement | null,
  };

  elements.newButton.addEventListener('click', () => {
    requestNavigation(() => {
      startNewEntry();
      renderStatus('');
    });
  });
  elements.saveButton.addEventListener('click', () => {
    void saveDraft();
  });
  elements.deleteButton.addEventListener('click', () => {
    requestDelete();
  });
  elements.searchInput.addEventListener('input', () => {
    state.query = elements.searchInput.value;
    renderList();
  });
  elements.allFilterButton.addEventListener('click', () => {
    state.photoFilter = 'all';
    renderList();
  });
  elements.photosFilterButton.addEventListener('click', () => {
    state.photoFilter = 'with-photos';
    renderList();
  });
  elements.newestSortButton.addEventListener('click', () => {
    state.sortOrder = 'newest';
    renderList();
  });
  elements.oldestSortButton.addEventListener('click', () => {
    state.sortOrder = 'oldest';
    renderList();
  });
  elements.addPhotoButton.addEventListener('click', () => {
    elements.photoInput.click();
  });
  elements.photoInput.addEventListener('change', () => {
    const file = elements.photoInput.files?.[0];
    elements.photoInput.value = '';
    if (file !== undefined) {
      void addPhoto(file);
    }
  });
  elements.confirmCancelButton.addEventListener('click', () => {
    clearConfirm();
  });
  elements.confirmAcceptButton.addEventListener('click', () => {
    const pending = state.pendingConfirm;
    clearConfirm();
    if (pending?.type === 'discard') {
      pending.action();
    } else if (pending?.type === 'delete') {
      void deleteEntry(pending.entryId);
    } else if (pending?.type === 'remove-photo') {
      void removePhoto(pending.imageId).catch(() => undefined);
    }
  });

  return {
    destroy() {
      hide();
      photoViewer.destroy();
      revokePhotoUrls();
      elements.root.remove();
      removeJournalStyles(doc);
    },
    hide,
    isShown() {
      return !elements.root.hidden;
    },
    show,
  };

  async function show(
      options: CharacterJournalSectionShowOptions,
  ): Promise<void> {
    state.characterId = options.characterId;
    state.contentHost = options.contentHost;
    state.tab = options.tab;
    state.query = '';
    state.photoFilter = 'all';
    state.sortOrder = 'newest';
    elements.searchInput.value = '';
    mountInContentHost(options.contentHost);
    hideNativeContent(options.contentHost);
    setTabActive(options.tab, true);
    elements.root.hidden = false;
    clearConfirm();
    setDraft('', '');
    state.entries = [];
    state.selectedEntryId = null;
    renderList();
    renderPhotos();
    setBusy(true);
    renderStatus('Loading journal...');

    try {
      state.entries = await service.listEntries(options.characterId);
      const firstEntry = orderedEntries()[0];
      if (firstEntry !== undefined) {
        selectEntry(firstEntry.id, {focus: false});
      } else {
        startNewEntry({focus: false});
      }
      renderStatus('');
    } catch {
      renderStatus('Journal entries could not be loaded.', 'error');
    } finally {
      setBusy(false);
      renderList();
      renderPhotos();
    }
  }

  function hide(): void {
    photoViewer.close();
    restoreNativeContent();
    elements.root.hidden = true;
    if (state.tab !== null) {
      setTabActive(state.tab, false);
    }
    state.contentHost = null;
    state.tab = null;
    clearConfirm();
    renderStatus('');
  }

  function mountInContentHost(contentHost: HTMLElement): void {
    if (elements.root.parentElement !== contentHost) {
      contentHost.append(elements.root);
    }
  }

  function hideNativeContent(contentHost: HTMLElement): void {
    restoreNativeContent();
    for (const child of Array.from(contentHost.children)) {
      if (!(child instanceof HTMLElement) || child === elements.root) {
        continue;
      }

      hiddenElements.set(child, {hidden: child.hidden});
      child.hidden = true;
    }
  }

  function restoreNativeContent(): void {
    for (const [element, previousState] of hiddenElements) {
      if (element.isConnected) {
        element.hidden = previousState.hidden;
      }
    }
    hiddenElements.clear();
  }

  function getHiddenSelectionMessage(
      visibleEntries: readonly CharacterJournalEntry[],
  ): string | null {
    const entry = selectedEntry();
    if (
      entry === undefined
      || visibleEntries.some((candidate) => candidate.id === entry.id)
    ) {
      return null;
    }

    if (state.query.trim() !== '') {
      return 'The open note is hidden by this search.';
    }

    if (state.photoFilter === 'with-photos') {
      return 'The open note is hidden by this filter.';
    }

    return null;
  }

  function orderedEntries(): CharacterJournalEntry[] {
    return orderJournalEntries(
        filterJournalEntries(state.entries, state.query, state.photoFilter),
        state.sortOrder,
    );
  }

  function renderList(): void {
    const visibleEntries = orderedEntries();
    elements.entryList.replaceChildren();
    elements.allFilterButton.setAttribute(
        'aria-pressed',
        state.photoFilter === 'all' ? 'true' : 'false',
    );
    elements.photosFilterButton.setAttribute(
        'aria-pressed',
        state.photoFilter === 'with-photos' ? 'true' : 'false',
    );
    elements.newestSortButton.setAttribute(
        'aria-pressed',
        state.sortOrder === 'newest' ? 'true' : 'false',
    );
    elements.oldestSortButton.setAttribute(
        'aria-pressed',
        state.sortOrder === 'oldest' ? 'true' : 'false',
    );

    const emptyMessage = getJournalEmptyMessage(
        state.query,
        state.photoFilter,
        state.entries.length > 0,
    );
    if (visibleEntries.length === 0 && emptyMessage !== null) {
      const emptyState = doc.createElement('div');
      emptyState.className = 'bfa-character-journal-empty';
      const title = doc.createElement('p');
      title.className = 'bfa-character-journal-empty-title';
      title.textContent = emptyMessage;
      emptyState.append(title);
      if (emptyMessage === 'No notes yet.') {
        const hint = doc.createElement('p');
        hint.className = 'bfa-character-journal-empty-hint';
        hint.textContent = 'Session notes and photos stay in this browser.';
        emptyState.append(hint);
      }
      const hiddenSelectionMessage = getHiddenSelectionMessage(visibleEntries);
      if (hiddenSelectionMessage !== null) {
        const hint = doc.createElement('p');
        hint.className = 'bfa-character-journal-empty-hint';
        hint.textContent = hiddenSelectionMessage;
        emptyState.append(hint);
      }
      elements.entryList.append(emptyState);
    }

    for (const entry of visibleEntries) {
      const button = doc.createElement('button');
      const title = doc.createElement('span');
      const meta = doc.createElement('span');
      const preview = doc.createElement('span');
      const photoCount = getImageBlocks(entry).length;
      const photoLabel = formatPhotoCount(photoCount);

      button.className = 'bfa-character-journal-entry-button';
      button.type = 'button';
      button.setAttribute(
          'aria-current',
          state.selectedEntryId === entry.id ? 'true' : 'false',
      );
      button.addEventListener('click', () => {
        requestNavigation(() => {
          selectEntry(entry.id);
          renderStatus('');
        });
      });

      title.className = 'bfa-character-journal-entry-title';
      title.textContent = entry.title;
      meta.className = 'bfa-character-journal-entry-date';
      meta.textContent = [
        formatUpdatedAt(entry.updatedAt),
        photoLabel,
      ].filter((part) => part !== '').join(' · ');
      preview.className = 'bfa-character-journal-entry-preview';
      preview.textContent = getJournalEntryPreview(entry);
      button.append(title, meta, preview);
      elements.entryList.append(button);
    }

    renderButtons();
    renderConfirm();
  }

  function renderPhotos(): void {
    const entry = selectedEntry();
    const blocks = entry === undefined ? [] : getImageBlocks(entry);
    elements.imageStrip.replaceChildren();

    if (blocks.length === 0) {
      const emptyState = doc.createElement('p');
      emptyState.className = 'bfa-character-journal-photo-empty';
      emptyState.textContent = 'No photos on this note.';
      elements.imageStrip.append(emptyState);
    }

    for (const block of blocks) {
      elements.imageStrip.append(createPhotoTile(block));
    }

    void ensurePhotoUrls(entry);
  }

  function createPhotoTile(block: CharacterJournalImageBlock): HTMLElement {
    const tile = doc.createElement('div');
    tile.className = 'bfa-character-journal-photo-tile';

    const viewButton = doc.createElement('button');
    viewButton.className = 'bfa-character-journal-photo';
    viewButton.type = 'button';
    viewButton.setAttribute('aria-label', `View photo ${block.fileName}`);
    viewButton.addEventListener('click', () => {
      openPhoto(block, viewButton);
    });

    const photoUrl = photoUrls.get(block.blobKey);
    if (typeof photoUrl === 'string') {
      const image = doc.createElement('img');
      image.alt = '';
      image.src = photoUrl;
      viewButton.append(image);
    } else {
      const fallback = doc.createElement('span');
      fallback.textContent = photoUrl === null ? 'Unavailable' : 'Loading';
      viewButton.append(fallback);
    }

    const name = doc.createElement('span');
    name.className = 'bfa-character-journal-photo-name';
    name.textContent = block.fileName;

    const removeButton = doc.createElement('button');
    removeButton.className = 'bfa-character-journal-photo-remove';
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.setAttribute('aria-label', `Remove photo ${block.fileName}`);
    removeButton.addEventListener('click', () => {
      state.pendingConfirm = {imageId: block.id, type: 'remove-photo'};
      renderConfirm();
    });

    tile.append(viewButton, name, removeButton);
    return tile;
  }

  function openPhoto(
      block: CharacterJournalImageBlock,
      returnFocus: HTMLElement,
  ): void {
    const photoUrl = photoUrls.get(block.blobKey);
    if (typeof photoUrl !== 'string') {
      renderStatus('That photo could not be opened.', 'error');
      return;
    }

    photoViewer.open({
      fallbackFocus: elements.addPhotoButton,
      imageUrl: photoUrl,
      label: block.fileName,
      onRemove: async () => {
        await removePhoto(block.id);
      },
      returnFocus,
    });
  }

  async function ensurePhotoUrls(
      entry: CharacterJournalEntry | undefined,
  ): Promise<void> {
    if (entry === undefined) {
      return;
    }

    const entryId = entry.id;
    let loadedNewPhoto = false;
    await Promise.all(getImageBlocks(entry).map(async (block) => {
      if (photoUrls.has(block.blobKey) || photoLoads.has(block.blobKey)) {
        return;
      }

      photoLoads.add(block.blobKey);
      try {
        const image = await service.getImage(block.blobKey);
        photoUrls.set(
            block.blobKey,
            image === null
              ? null
              : createPhotoObjectUrl(new Blob(
                  [image.byteBuffer],
                  {type: image.mimeType},
              )),
        );
        loadedNewPhoto = true;
      } catch {
        photoUrls.set(block.blobKey, null);
        loadedNewPhoto = true;
      } finally {
        photoLoads.delete(block.blobKey);
      }
    }));

    if (loadedNewPhoto && state.selectedEntryId === entryId) {
      renderPhotos();
    }
  }

  function selectedEntry(): CharacterJournalEntry | undefined {
    return state.entries.find((entry) => entry.id === state.selectedEntryId);
  }

  function selectEntry(
      entryId: string,
      options: {focus?: boolean} = {},
  ): void {
    const entry = state.entries.find((candidate) => candidate.id === entryId);
    if (entry === undefined) {
      return;
    }

    state.selectedEntryId = entry.id;
    setDraft(entry.title, getTextFromJournalEntry(entry));
    renderList();
    renderPhotos();
    if (options.focus === true) {
      elements.titleInput.focus();
    }
  }

  function startNewEntry(options: {focus?: boolean} = {focus: true}): void {
    state.selectedEntryId = null;
    setDraft('', '');
    renderList();
    renderPhotos();
    if (options.focus !== false) {
      elements.titleInput.focus();
    }
  }

  function currentDraft(): CharacterJournalTextEntryDraft | null {
    if (state.characterId === null) {
      return null;
    }

    const entry = selectedEntry();
    return {
      characterId: state.characterId,
      ...(state.selectedEntryId === null
        ? {}
        : {entryId: state.selectedEntryId}),
      imageBlocks: entry === undefined ? [] : getImageBlocks(entry),
      text: elements.bodyInput.value,
      title: elements.titleInput.value,
    };
  }

  function isDraftDirty(): boolean {
    const entry = selectedEntry();
    const title = elements.titleInput.value;
    const text = elements.bodyInput.value;
    if (entry === undefined) {
      return title.trim() !== '' || text.trim() !== '';
    }

    return title !== entry.title || text !== getTextFromJournalEntry(entry);
  }

  function requestNavigation(action: () => void): void {
    if (!isDraftDirty()) {
      action();
      return;
    }

    state.pendingConfirm = {action, type: 'discard'};
    renderConfirm();
  }

  function requestDelete(): void {
    if (state.selectedEntryId === null || state.isBusy) {
      return;
    }

    state.pendingConfirm = {
      entryId: state.selectedEntryId,
      type: 'delete',
    };
    renderConfirm();
  }

  async function saveDraft(): Promise<void> {
    const draft = currentDraft();
    if (draft === null || state.isBusy) {
      return;
    }

    setBusy(true);
    renderStatus('Saving...');
    try {
      const savedEntry = await service.saveTextEntry(draft);
      rememberEntry(savedEntry);
      setDraft(savedEntry.title, getTextFromJournalEntry(savedEntry));
      renderStatus('Saved.', 'success');
    } catch {
      renderStatus('Entry could not be saved. Your text is still here.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(file: File): Promise<void> {
    const draft = currentDraft();
    if (draft === null || state.isBusy) {
      return;
    }

    setBusy(true);
    renderStatus('Adding photo...');
    try {
      const savedEntry = await service.attachImage(draft, file);
      rememberEntry(savedEntry);
      setDraft(savedEntry.title, getTextFromJournalEntry(savedEntry));
      renderStatus('Photo added.', 'success');
    } catch (error) {
      renderStatus(
          error instanceof Error
            ? error.message
            : 'Photo could not be added. Your note is still here.',
          'error',
      );
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(imageId: string): Promise<void> {
    const draft = currentDraft();
    if (draft === null || state.isBusy) {
      return;
    }

    const removedBlock = (draft.imageBlocks ?? []).find(
        (block) => block.id === imageId,
    );
    setBusy(true);
    renderStatus('Removing photo...');
    try {
      const savedEntry = await service.removeImage(draft, imageId);
      if (removedBlock !== undefined) {
        releasePhotoUrl(removedBlock.blobKey);
      }
      rememberEntry(savedEntry);
      setDraft(savedEntry.title, getTextFromJournalEntry(savedEntry));
      renderStatus('Photo removed.', 'success');
    } catch (error) {
      renderStatus(
          error instanceof Error ? error.message : 'Photo could not be removed.',
          'error',
      );
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function deleteEntry(entryId: string): Promise<void> {
    if (state.characterId === null || state.isBusy) {
      return;
    }

    const entry = state.entries.find((candidate) => candidate.id === entryId);
    if (entry === undefined) {
      return;
    }

    setBusy(true);
    renderStatus('Deleting...');
    try {
      await service.deleteEntry(state.characterId, entryId);
      state.entries = state.entries.filter((candidate) => candidate.id !== entryId);
      releaseEntryPhotoUrls(entry);
      if (state.selectedEntryId === entryId) {
        const nextEntry = orderedEntries()[0];
        if (nextEntry === undefined) {
          startNewEntry({focus: false});
        } else {
          selectEntry(nextEntry.id);
        }
      } else {
        renderList();
        renderPhotos();
      }
      renderStatus('Deleted.', 'success');
    } catch {
      renderStatus('Entry could not be deleted.', 'error');
    } finally {
      setBusy(false);
      renderList();
    }
  }

  function rememberEntry(entry: CharacterJournalEntry): void {
    state.selectedEntryId = entry.id;
    state.entries = [
      entry,
      ...state.entries.filter((candidate) => candidate.id !== entry.id),
    ];
    renderList();
    renderPhotos();
  }

  function renderButtons(): void {
    elements.saveButton.disabled = state.isBusy;
    elements.newButton.disabled = state.isBusy;
    elements.addPhotoButton.disabled = state.isBusy;
    elements.deleteButton.disabled =
      state.isBusy || state.selectedEntryId === null;
    elements.titleInput.disabled = state.isBusy;
    elements.bodyInput.disabled = state.isBusy;
    elements.photoInput.disabled = state.isBusy;
  }

  function setBusy(isBusy: boolean): void {
    state.isBusy = isBusy;
    renderButtons();
  }

  function setDraft(title: string, text: string): void {
    elements.titleInput.value = title;
    elements.bodyInput.value = text;
  }

  function renderStatus(
      message: string,
      tone: JournalStatusTone = 'info',
  ): void {
    elements.status.className =
      `bfa-character-journal-status bfa-character-journal-status--${tone}`;
    elements.status.textContent = message;
  }

  function renderConfirm(): void {
    const pending = state.pendingConfirm;
    elements.confirmRegion.hidden = pending === null;
    if (pending === null) {
      return;
    }

    if (pending.type === 'delete') {
      const entry = state.entries.find(
          (candidate) => candidate.id === pending.entryId,
      );
      const title = entry?.title ?? 'this note';
      elements.confirmText.textContent =
        `Delete “${title}” and its photos? This removes only the local journal entry.`;
      elements.confirmCancelButton.textContent = 'Keep note';
      elements.confirmAcceptButton.textContent = 'Delete note';
      return;
    }

    if (pending.type === 'remove-photo') {
      elements.confirmText.textContent = 'Remove this photo from the note?';
      elements.confirmCancelButton.textContent = 'Keep photo';
      elements.confirmAcceptButton.textContent = 'Remove photo';
      return;
    }

    elements.confirmText.textContent = 'This note has unsaved changes.';
    elements.confirmCancelButton.textContent = 'Keep editing';
    elements.confirmAcceptButton.textContent = 'Discard';
  }

  function clearConfirm(): void {
    state.pendingConfirm = null;
    renderConfirm();
  }

  function releaseEntryPhotoUrls(entry: CharacterJournalEntry): void {
    for (const block of getImageBlocks(entry)) {
      releasePhotoUrl(block.blobKey);
    }
  }

  function releasePhotoUrl(blobKey: string): void {
    const url = photoUrls.get(blobKey);
    photoUrls.delete(blobKey);
    if (typeof url === 'string') {
      URL.revokeObjectURL(url);
    }
  }

  function revokePhotoUrls(): void {
    for (const blobKey of [...photoUrls.keys()]) {
      releasePhotoUrl(blobKey);
    }
  }
}

function createJournalElements(doc: Document): JournalSectionElements {
  const root = doc.createElement('section');
  root.className = 'bfa-character-journal-section';
  root.hidden = true;
  root.id = 'bfa-character-journal-section';
  root.setAttribute('aria-label', 'Character journal');

  const header = doc.createElement('header');
  header.className = 'bfa-character-journal-header';
  const kicker = doc.createElement('p');
  kicker.className = 'bfa-character-journal-kicker';
  kicker.textContent = 'Stored on this device';
  const heading = doc.createElement('h2');
  heading.className = 'bfa-character-journal-heading';
  heading.textContent = 'Journal';
  header.append(kicker, heading);

  const toolbar = doc.createElement('div');
  toolbar.className = 'bfa-character-journal-toolbar';
  const searchInput = doc.createElement('input');
  searchInput.className = 'bfa-character-journal-search';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search notes';
  searchInput.setAttribute('aria-label', 'Search notes');

  const filters = doc.createElement('div');
  filters.className = 'bfa-character-journal-filters';
  const allFilterButton = createButton(doc, 'All notes', 'bfa-character-journal-chip');
  const photosFilterButton = createButton(doc, 'With photos', 'bfa-character-journal-chip');
  allFilterButton.setAttribute('aria-pressed', 'true');
  photosFilterButton.setAttribute('aria-pressed', 'false');
  filters.append(allFilterButton, photosFilterButton);

  const sort = doc.createElement('div');
  sort.className = 'bfa-character-journal-sort';
  const newestSortButton = createButton(doc, 'Newest', 'bfa-character-journal-chip');
  const oldestSortButton = createButton(doc, 'Oldest', 'bfa-character-journal-chip');
  newestSortButton.setAttribute('aria-label', 'Sort notes by newest');
  oldestSortButton.setAttribute('aria-label', 'Sort notes by oldest');
  sort.append(newestSortButton, oldestSortButton);

  const newButton = createButton(
      doc,
      'New entry',
      'bfa-character-journal-button',
  );
  toolbar.append(searchInput, filters, sort, newButton);

  const body = doc.createElement('div');
  body.className = 'bfa-character-journal-body';
  const entryList = doc.createElement('div');
  entryList.className = 'bfa-character-journal-list';
  entryList.setAttribute('aria-label', 'Journal notes');
  const editor = doc.createElement('div');
  editor.className = 'bfa-character-journal-editor';

  const titleInput = doc.createElement('input');
  titleInput.className = 'bfa-character-journal-title-input';
  titleInput.placeholder = normalizeJournalEntryTitle('');
  titleInput.type = 'text';
  titleInput.setAttribute('aria-label', 'Journal entry title');

  const bodyInput = doc.createElement('textarea');
  bodyInput.className = 'bfa-character-journal-body-input';
  bodyInput.placeholder = 'What happened this session?';
  bodyInput.setAttribute('aria-label', 'Journal entry body');

  const imagesPanel = doc.createElement('section');
  imagesPanel.className = 'bfa-character-journal-images';
  imagesPanel.setAttribute('aria-label', 'Note photos');
  const imagesHeader = doc.createElement('div');
  imagesHeader.className = 'bfa-character-journal-images-header';
  const imagesTitle = doc.createElement('h3');
  imagesTitle.className = 'bfa-character-journal-images-title';
  imagesTitle.textContent = 'Photos';
  const addPhotoButton = createButton(
      doc,
      'Add photo',
      'bfa-character-journal-button',
  );
  const photoInput = doc.createElement('input');
  photoInput.className = 'bfa-character-journal-photo-input';
  photoInput.accept = 'image/png,image/jpeg,image/webp';
  photoInput.setAttribute('aria-label', 'Add a journal photo');
  photoInput.type = 'file';
  imagesHeader.append(imagesTitle, addPhotoButton, photoInput);
  const imageStrip = doc.createElement('div');
  imageStrip.className = 'bfa-character-journal-image-strip';
  imagesPanel.append(imagesHeader, imageStrip);

  const status = doc.createElement('p');
  status.className = 'bfa-character-journal-status';
  status.setAttribute('aria-live', 'polite');

  const confirmRegion = doc.createElement('div');
  confirmRegion.className = 'bfa-character-journal-confirm';
  confirmRegion.hidden = true;
  const confirmText = doc.createElement('p');
  confirmText.className = 'bfa-character-journal-confirm-text';
  const confirmActions = doc.createElement('div');
  confirmActions.className = 'bfa-character-journal-confirm-actions';
  const confirmCancelButton = createButton(
      doc,
      'Keep editing',
      'bfa-character-journal-button',
  );
  const confirmAcceptButton = createButton(
      doc,
      'Discard',
      'bfa-character-journal-button bfa-character-journal-button--danger',
  );
  confirmActions.append(confirmCancelButton, confirmAcceptButton);
  confirmRegion.append(confirmText, confirmActions);

  const actions = doc.createElement('div');
  actions.className = 'bfa-character-journal-actions';
  const deleteButton = createButton(
      doc,
      'Delete',
      'bfa-character-journal-button bfa-character-journal-button--danger',
  );
  const saveButton = createButton(
      doc,
      'Save',
      'bfa-character-journal-button bfa-character-journal-button--primary',
  );
  actions.append(deleteButton, saveButton);

  editor.append(
      titleInput,
      bodyInput,
      imagesPanel,
      status,
      confirmRegion,
      actions,
  );
  body.append(entryList, editor);
  root.append(header, toolbar, body);

  return {
    addPhotoButton,
    allFilterButton,
    bodyInput,
    confirmAcceptButton,
    confirmCancelButton,
    confirmRegion,
    confirmText,
    deleteButton,
    entryList,
    imageStrip,
    newButton,
    newestSortButton,
    oldestSortButton,
    photoInput,
    photosFilterButton,
    root,
    saveButton,
    searchInput,
    status,
    titleInput,
  };
}

function createButton(
    doc: Document,
    label: string,
    className: string,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.className = className;
  button.textContent = label;
  button.type = 'button';
  return button;
}

function ensureJournalStyles(doc: Document): void {
  if (
    doc.head.querySelector(`[${CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME}]`) !==
    null
  ) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = journalStyles;
  doc.head.append(styleElement);
}

function removeJournalStyles(doc: Document): void {
  doc.head.querySelector(`[${CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}

function setTabActive(tab: HTMLElement, isActive: boolean): void {
  tab.classList.toggle('bfa-character-journal-tab--active', isActive);
  if (tab.getAttribute('role') === 'tab') {
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return updatedAt;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(date);
}

function createPhotoObjectUrl(blob: Blob): string | null {
  if (typeof URL.createObjectURL !== 'function') {
    return null;
  }

  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
