import type {CharacterId} from '../character-art/art-types';
import {fitJournalToVisiblePane} from './character-journal-pane';
import {createWikiAutocomplete} from './character-journal-autocomplete';
import {ensureJournalStyles, removeJournalStyles} from './character-journal-elements';
import {journalSaveErrorMessage} from './character-journal-errors';
import {
  libraryEmptyMessage,
  notesUsingPhoto,
  photoDeleteQuestion,
  visibleLibraryPhotos,
  type JournalPhotoUse,
} from './character-journal-library';
import {createJournalList, type JournalRowModel} from './character-journal-list';
import {
  createJournalPhotoGrid,
  createJournalPhotoSwitch,
} from './character-journal-photos';
import {previewJournalText} from './character-journal-markdown';
import {installJournalNotes, type JournalNotes, type OpenPanel} from './character-journal-notes';
import {
  concealNativeSidebarControls,
  stopNativeSidebarWatch,
  whenNativeSidebarOpens,
} from './character-journal-sidebar-place';
import {createJournalPhotoViewer} from './character-journal-photo-viewer';
import {
  journalEmptyLabel,
  formatJournalListDate,
  visibleJournalNotes,
} from './character-journal-query';
import {applyCopiedControlClasses, paintJournalSurface} from './character-journal-sheet-style';
import type {CharacterJournalService} from './character-journal-service';
import {applySheetTheme, observeSheetTheme} from './character-journal-theme';
import type {JournalEntryType, JournalImage, JournalNote} from './character-journal-types';
import {
  restoreNativeTabAfterJournal,
  setJournalTabSelected,
} from '../../platform/dndbeyond/character-sheet-tabs-adapter';
import {isFolderLibrary} from '../../platform/chrome/library-mode';
import {
  DEFAULT_JOURNAL_LIST_PREFERENCES,
  type JournalListPreferences,
} from '../../platform/chrome/journal-list-preferences';

export interface CharacterJournalSection {
  destroy(): void;
  hide(): void;
  holdLockedNote(): boolean;
  isShown(): boolean;
  requestHide(onHidden?: () => void, onCancel?: () => void): void;
  setListPreferences(preferences: JournalListPreferences): void;
  show(options: CharacterJournalSectionShowOptions): Promise<void>;
  syncRoute(characterId: CharacterId | null): void;
}

export interface CharacterJournalSectionShowOptions {
  characterId: CharacterId;
  contentHost: HTMLElement;
  tab: HTMLElement;
}

export function createCharacterJournalSection(
    service: CharacterJournalService,
    doc: Document = document,
): CharacterJournalSection {
  ensureJournalStyles(doc);
  const photoViewer = createJournalPhotoViewer(doc);
  const photoUrls = new Map<string, string>();
  let showGeneration = 0;
  let lockedYieldGeneration = 0;
  let reloadSerial = 0;
  let nativeContentObserver: MutationObserver | null = null;
  const flags = {
    hideCancel: null as (() => void) | null,
    pendingTeardown: null as (() => void) | null,
    suppressRouteAdopt: false,
  };
  const state = {
    characterId: null as CharacterId | null,
    contentHost: null as HTMLElement | null,
    fileError: null as string | null,
    filters: [] as JournalEntryType[],
    migration: 'current' as 'current' | 'failed' | 'loading' | 'migrated',
    listPreferences: {...DEFAULT_JOURNAL_LIST_PREFERENCES},
    notes: [] as JournalNote[],
    panel: null as OpenPanel | null,
    photoFilter: 'all' as JournalPhotoUse,
    photoQuery: '',
    photos: [] as JournalImage[],
    query: '',
    view: 'notes' as 'notes' | 'photos',
    routeId: null as CharacterId | null,
    stopTheme: null as (() => void) | null,
    tab: null as HTMLElement | null,
  };

  const autocomplete = createWikiAutocomplete(doc, () => state.notes);
  let notes!: JournalNotes;
  const list = createJournalList(doc, {
    onFilter: (types) => {
      state.filters = [...types];
      renderList();
    },
    onManage: () => {
      if (state.view === 'photos') {
        addPhotoInput.click();
        return;
      }
      notes.openNew(
          'unset',
          list.root.querySelector<HTMLElement>('.bfa-journal-manage') ?? list.root,
      );
    },
    onOpen: (entryId, returnFocus) => {
      const note = state.notes.find((entry) => entry.id === entryId);
      if (note !== undefined) {
        notes.openNote(note, 'read', returnFocus, []);
      }
    },
    onPhotoFilter: (use) => {
      state.photoFilter = use;
      renderPhotos();
    },
    onSearch: (query) => {
      if (state.view === 'photos') {
        state.photoQuery = query;
        renderPhotos();
        return;
      }
      state.query = query;
      renderList();
    },
    onSync: () => {
      void syncFolder();
    },
  });
  notes = installJournalNotes({
    autocomplete,
    doc,
    flags,
    hide,
    hydrateImages,
    libraryPhotos: () => state.photos,
    list,
    photoUrls,
    photoViewer,
    refreshPhotos,
    reload,
    renderList,
    service,
    state,
  });
  const photoSwitch = createJournalPhotoSwitch(doc, (view) => {
    selectView(view);
  });
  const photoGrid = createJournalPhotoGrid(doc);
  const addPhotoInput = doc.createElement('input');
  addPhotoInput.className = 'bfa-journal-library-file-input';
  addPhotoInput.type = 'file';
  addPhotoInput.accept = 'image/png,image/jpeg,image/webp';
  addPhotoInput.hidden = true;
  addPhotoInput.tabIndex = -1;
  addPhotoInput.addEventListener('change', () => {
    const file = addPhotoInput.files?.[0];
    addPhotoInput.value = '';
    if (file !== undefined) {
      void addLibraryPhoto(file);
    }
  });
  list.root.prepend(photoSwitch.root);
  list.root.append(photoGrid.root, addPhotoInput);
  doc.body.append(notes.panel.root);
  doc.addEventListener('click', keepNotePanelDocked, true);
  doc.addEventListener('click', keepNotePanelDocked);
  doc.addEventListener('click', dismissNoteFromOutside);
  doc.defaultView?.addEventListener('resize', fitOpenJournal);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      void notes.savePanel();
    }
  });

  return {
    destroy,
    hide,
    holdLockedNote,
    isShown,
    requestHide,
    setListPreferences,
    show,
    syncRoute,
  };

  function setListPreferences(preferences: JournalListPreferences): void {
    state.listPreferences = {...preferences};
    renderList();
  }

  async function show(options: CharacterJournalSectionShowOptions): Promise<void> {
    cancelLockedYield();
    const generation = ++showGeneration;
    state.characterId = options.characterId;
    state.routeId = options.characterId;
    state.view = 'notes';
    state.photoQuery = '';
    state.photoFilter = 'all';
    photoSwitch.adoptLiveNav();
    photoSwitch.setSelected('notes');
    list.setMode('notes');
    list.setPhotoUse('all');
    list.setManageLabel('New Note');
    list.setSearchValue('');
    photoGrid.root.hidden = true;
    state.contentHost = options.contentHost;
    state.tab = options.tab;
    mount(options.contentHost);
    setTabActive(options.tab, true);
    list.root.hidden = false;
    paint();
    void refreshSyncVisibility();
    state.stopTheme?.();
    state.stopTheme = observeSheetTheme(options.contentHost, paint);
    state.migration = 'loading';
    renderList();
    try {
      const opened = await service.open(options.characterId);
      if (generation !== showGeneration || state.characterId !== options.characterId) {
        return;
      }

      state.notes = opened.notes;
      state.photos = opened.photos;
      state.migration = opened.migration === 'failed' ? 'failed' : 'current';
      await hydrateImages(opened.notes);
      await hydratePhotos(opened.photos);
    } catch (error) {
      if (generation !== showGeneration) {
        return;
      }

      state.migration = 'current';
      state.fileError = journalSaveErrorMessage(error);
      list.setAlert(state.fileError);
    }

    renderList();
    fitOpenJournal();
  }

  function syncRoute(characterId: CharacterId | null): void {
    state.routeId = characterId;
    if (!isShown()) {
      // The list is hidden, but a locked note can still be on screen.
      if (notes.panel.root.hidden || characterId === state.characterId) {
        return;
      }
      if (characterId === null || state.panel === null) {
        requestHide();
        return;
      }
      state.panel.mismatch = true;
      state.panel.status = 'error';
      notes.renderPanel();
      return;
    }

    if (characterId === null) {
      requestHide();
      return;
    }

    if (state.panel !== null && characterId !== state.characterId) {
      state.panel.mismatch = true;
      state.panel.status = 'error';
      notes.renderPanel();
      return;
    }

    if (state.panel === null && characterId !== state.characterId) {
      state.characterId = characterId;
      state.notes = [];
      state.migration = 'loading';
      renderList();
      void reload();
    }
  }

  function requestHide(onHidden?: () => void, onCancel?: () => void): void {
    const panelOpen = !notes.panel.root.hidden;
    // A locked note can stay up after the list is hidden. Leaving the
    // character, or turning Journal off, still has to ask before a dirty
    // draft is dropped.
    if (!isShown() && (!panelOpen || !notes.isDirty())) {
      if (panelOpen) {
        hide();
      }
      onHidden?.();
      return;
    }

    if (isShown() && !notes.isDirty()) {
      const teardown = onHidden ?? flags.pendingTeardown;
      flags.pendingTeardown = null;
      flags.hideCancel = null;
      hide();
      teardown?.();
      return;
    }

    if (onHidden !== undefined) {
      flags.pendingTeardown = onHidden;
    }
    flags.hideCancel = onCancel ?? null;

    if (state.panel === null) {
      hide();
      flags.pendingTeardown?.();
      flags.pendingTeardown = null;
      return;
    }

    notes.panel.expand();
    state.panel.confirm = 'hide';
    notes.renderPanel();
  }

  function holdLockedNote(): boolean {
    const root = notes.panel.root;
    if (root.hidden || !notes.panel.chrome().locked) {
      return false;
    }

    list.root.hidden = true;
    list.root.inert = false;
    restoreNativeContent();
    if (state.tab !== null) {
      setTabActive(state.tab, false);
    }
    if (root.dataset.bfaJournalYield === 'true') {
      return true;
    }

    root.dataset.bfaJournalYield = 'true';
    whenNativeSidebarOpens(doc, root, () => {
      void yieldLockedNote();
    });
    return true;
  }

  function cancelLockedYield(): void {
    lockedYieldGeneration += 1;
    stopNativeSidebarWatch();
    delete notes.panel.root.dataset.bfaJournalYield;
  }

  async function yieldLockedNote(): Promise<void> {
    const generation = lockedYieldGeneration;
    const root = notes.panel.root;
    stopNativeSidebarWatch();
    // The sheet sidebar is taking this edge. Restore its bar before the
    // note slides away, or place() hides that bar for the rest of the slide.
    concealNativeSidebarControls(doc, root, false);
    if (notes.isDirty()) {
      await notes.savePanel();
    }
    if (
      generation !== lockedYieldGeneration
      || root.dataset.bfaJournalYield !== 'true'
      || root.hidden
      || !notes.panel.chrome().locked
      || notes.isDirty()
      || state.panel?.confirm !== null
    ) {
      return;
    }

    delete root.dataset.bfaJournalYield;
    notes.closePanel();
  }

  function hide(): void {
    cancelLockedYield();
    showGeneration += 1;
    notes.cancelSave();
    photoViewer.close();
    flags.suppressRouteAdopt = true;
    notes.closePanel();
    flags.suppressRouteAdopt = false;
    list.root.hidden = true;
    list.root.inert = false;
    restoreNativeContent();
    state.stopTheme?.();
    state.stopTheme = null;
    if (state.tab !== null) {
      setTabActive(state.tab, false);
    }
    list.root.style.removeProperty('max-height');
  }

  function destroy(): void {
    doc.removeEventListener('click', keepNotePanelDocked, true);
    doc.removeEventListener('click', keepNotePanelDocked);
    doc.removeEventListener('click', dismissNoteFromOutside);
    doc.defaultView?.removeEventListener('resize', fitOpenJournal);
    hide();
    flags.pendingTeardown = null;
    photoViewer.destroy();
    revokePhotoUrls();
    list.disconnect();
    list.root.remove();
    notes.release();
    notes.panel.root.remove();
    removeJournalStyles(doc);
  }

  function isShown(): boolean {
    return !list.root.hidden;
  }

  function mount(host: HTMLElement): void {
    concealNativeSiblings(host);
    if (list.root.parentElement !== host) {
      host.append(list.root);
    }
    nativeContentObserver?.disconnect();
    nativeContentObserver = new MutationObserver(() => {
      if (!isShown() || state.contentHost !== host) {
        return;
      }
      concealNativeSiblings(host);
    });
    nativeContentObserver.observe(host, {childList: true});
  }

  function concealNativeSiblings(host: HTMLElement): void {
    for (const child of [...host.children]) {
      if (child === list.root || !(child instanceof HTMLElement)) {
        continue;
      }
      if (child.dataset.bfaJournalConcealed === 'true') {
        continue;
      }
      // The sheet's own display rule beats the hidden attribute, so Extras
      // stays on screen unless display is forced off.
      child.dataset.bfaJournalHidden = child.hidden ? 'true' : 'false';
      child.dataset.bfaJournalDisplay = child.style.getPropertyValue('display');
      child.dataset.bfaJournalDisplayPriority = child.style.getPropertyPriority('display');
      child.hidden = true;
      child.style.setProperty('display', 'none', 'important');
      child.dataset.bfaJournalConcealed = 'true';
    }
  }

  function restoreNativeContent(): void {
    nativeContentObserver?.disconnect();
    nativeContentObserver = null;
    const host = state.contentHost;
    if (host === null) {
      return;
    }

    for (const child of [...host.children]) {
      if (!(child instanceof HTMLElement) || child.dataset.bfaJournalConcealed !== 'true') {
        continue;
      }
      const previous = child.dataset.bfaJournalDisplay ?? '';
      const priority = child.dataset.bfaJournalDisplayPriority ?? '';
      if (previous === '') {
        child.style.removeProperty('display');
      } else {
        child.style.setProperty('display', previous, priority);
      }
      child.hidden = child.dataset.bfaJournalHidden === 'true';
      delete child.dataset.bfaJournalHidden;
      delete child.dataset.bfaJournalDisplay;
      delete child.dataset.bfaJournalDisplayPriority;
      delete child.dataset.bfaJournalConcealed;
    }
  }

  async function reload(): Promise<void> {
    if (state.characterId === null || !isShown()) {
      return;
    }

    const characterId = state.characterId;
    const generation = showGeneration;
    const request = ++reloadSerial;
    const opened = await service.open(characterId);
    if (!reloadIsCurrent(request, generation, characterId)) {
      return;
    }

    if (state.routeId !== null && state.routeId !== state.characterId && state.panel !== null) {
      return;
    }

    state.notes = opened.notes;
    state.photos = opened.photos;
    state.migration = opened.migration === 'failed' ? 'failed' : 'current';
    await hydrateImages(opened.notes);
    await hydratePhotos(opened.photos);
    if (!reloadIsCurrent(request, generation, characterId)) {
      return;
    }
    renderList();
  }

  async function syncFolder(): Promise<void> {
    if (state.characterId === null || !isShown()) {
      return;
    }
    list.setSyncBusy(true);
    try {
      await reload();
      notes.applyFolderCheck();
    } catch (error) {
      state.fileError = journalSaveErrorMessage(error);
      list.setAlert(state.fileError);
    } finally {
      list.setSyncBusy(false);
    }
  }

  async function refreshSyncVisibility(): Promise<void> {
    const visible = await isFolderLibrary();
    if (isShown()) {
      list.setSyncVisible(visible);
    }
  }

  function reloadIsCurrent(
      request: number,
      generation: number,
      characterId: CharacterId,
  ): boolean {
    return isShown()
      && generation === showGeneration
      && state.characterId === characterId
      && request === reloadSerial;
  }

  function selectView(view: 'notes' | 'photos'): void {
    const apply = (): void => {
      state.view = view;
      photoSwitch.setSelected(view);
      list.setMode(view);
      list.setManageLabel(view === 'photos' ? 'Add photo' : 'New Note');
      list.setSearchValue(view === 'photos' ? state.photoQuery : state.query);
      photoGrid.root.hidden = view !== 'photos';
      if (view === 'photos') {
        renderPhotos();
      } else {
        renderList();
      }
    };
    if (view === 'photos' && state.panel !== null) {
      notes.leaveNote(apply);
      return;
    }
    apply();
  }

  function renderPhotos(): void {
    if (state.view !== 'photos') {
      return;
    }
    const visible = visibleLibraryPhotos(
        state.photos,
        state.notes,
        state.photoQuery,
        state.photoFilter,
    );
    photoGrid.setPhotos(visible.map((photo) => ({
      fileName: photo.fileName,
      id: photo.id,
      url: photoUrls.get(photo.blobKey) ?? null,
    })), (imageId, returnFocus) => {
      openLibraryPhoto(imageId, returnFocus);
    });
    list.setMessage(
        libraryEmptyMessage(
            state.photos.length,
            visible.length,
            state.photoQuery,
            state.photoFilter,
        ),
        'muted',
    );
    list.setAlert(state.fileError);
  }

  async function refreshPhotos(): Promise<void> {
    if (state.characterId === null) {
      return;
    }
    state.photos = await service.listPhotos(state.characterId);
    await hydratePhotos(state.photos);
    renderPhotos();
  }

  async function addLibraryPhoto(file: File): Promise<void> {
    if (state.characterId === null) {
      return;
    }
    state.fileError = null;
    try {
      await service.addPhoto(state.characterId, file);
      await refreshPhotos();
    } catch (error) {
      state.fileError = journalSaveErrorMessage(error);
      list.setAlert(state.fileError);
    }
  }

  function openLibraryPhoto(imageId: string, returnFocus: HTMLElement): void {
    const image = state.photos.find((candidate) => candidate.id === imageId);
    const url = image === undefined ? null : photoUrls.get(image.blobKey) ?? null;
    if (image === undefined || url === null) {
      return;
    }
    const used = notesUsingPhoto(state.notes, image.id);
    photoViewer.open({
      confirmText: photoDeleteQuestion(used.map((note) => note.title)),
      fallbackFocus: list.root,
      imageUrl: url,
      label: image.fileName,
      notes: used.map((note) => ({id: note.id, title: note.title})),
      onOpenNote: (noteId) => {
        photoViewer.close();
        const note = state.notes.find((candidate) => candidate.id === noteId);
        if (note !== undefined) {
          notes.openNote(note, 'read', returnFocus, []);
        }
      },
      onRemove: async () => {
        if (state.characterId === null) {
          return;
        }
        const result = await service.deletePhoto(state.characterId, image.id);
        state.notes = result.notes;
        state.photos = result.photos;
        if (state.panel !== null) {
          const open = result.notes.find((note) => note.id === state.panel?.note.id);
          if (open !== undefined) {
            state.panel.note = open;
            state.panel.loadedUpdatedAt = open.updatedAt;
            notes.renderPanel();
          }
        }
        renderPhotos();
        renderList();
      },
      removeLabel: 'Delete photo',
      returnFocus,
      unusedText: 'Not in a note yet.',
    });
  }

  function renderList(): void {
    const loading = state.migration === 'loading';
    const failed = state.migration === 'failed';
    list.setFilters(state.filters);
    list.setAlert(state.fileError);
    if (loading) {
      list.setRows([]);
      list.setMessage('Loading notes', 'muted');
      return;
    }

    if (failed) {
      list.setRows([]);
      list.setMessage('Your existing notes were left unchanged.', 'alert');
      return;
    }

    const visible = visibleJournalNotes(state.notes, state.filters, state.query);
    list.setRows(visible.map(rowModel));
    const notice = state.filters.length === 0
      && state.query.trim() === ''
      && state.notes.some((note) => note.type === 'unset' && !note.needsDetails);
    if (state.view === 'photos') {
      renderPhotos();
      return;
    }
    if (notice) {
      list.setMessage('Earlier notes are uncategorized.', 'notice');
    } else if (visible.length === 0) {
      list.setMessage(journalEmptyLabel(state.filters, state.query), 'muted');
    } else {
      list.setMessage(null, 'muted');
    }
  }

  function rowModel(note: JournalNote): JournalRowModel {
    const createdDate = formatJournalListDate(note.createdAt) ?? '';
    const updatedDate = state.listPreferences.showUpdatedDate
      ? formatJournalListDate(note.updatedAt)
      : null;
    return {
      createdAt: note.createdAt,
      createdDate,
      id: note.id,
      label: `${note.title}, ${createdDate}${note.needsDetails ? ', needs details' : ''}`,
      needsDetails: note.needsDetails,
      preview: state.listPreferences.showPreview ? previewJournalText(note.body) : null,
      thumbUrl: state.listPreferences.showThumbnail ? thumbUrl(note) : null,
      title: note.title,
      updatedAt: updatedDate !== null && updatedDate !== createdDate ? note.updatedAt : null,
      updatedDate: updatedDate !== createdDate ? updatedDate : null,
    };
  }

  async function hydratePhotos(photos: readonly JournalImage[]): Promise<void> {
    await Promise.all(photos.map(async (image) => {
      await rememberPhotoUrl(image);
    }));
  }

  async function hydrateImages(notes: readonly JournalNote[]): Promise<void> {
    await Promise.all(notes.flatMap((note) => note.images.map(async (image) => {
      await rememberPhotoUrl(image);
    })));
  }

  async function rememberPhotoUrl(image: JournalImage): Promise<void> {
    if (photoUrls.has(image.blobKey)) {
      return;
    }

    const stored = await service.getImage(image.blobKey);
    if (stored === null) {
      return;
    }

    const url = URL.createObjectURL(new Blob([stored.byteBuffer], {type: stored.mimeType}));
    photoUrls.set(image.blobKey, url);
  }

  function thumbUrl(note: JournalNote): string | null {
    const image = note.images[0];
    return image === undefined ? null : photoUrls.get(image.blobKey) ?? null;
  }

  function paint(): void {
    const anchor = state.contentHost ?? list.root;
    applySheetTheme(list.root, anchor);
    applyCopiedControlClasses(list.root, paintJournalSurface(list.root, anchor));
    if (!notes.panel.root.hidden) {
      applyCopiedControlClasses(
          notes.panel.root,
          paintJournalSurface(notes.panel.root, anchor, 'panel'),
      );
    }
    fitOpenJournal();
  }

  function keepNotePanelDocked(): void {
    if (!notes.panel.root.hidden) {
      notes.panel.place();
    }
  }

  function dismissNoteFromOutside(event: MouseEvent): void {
    const target = event.target;
    const path = event.composedPath();
    if (
      notes.panel.root.hidden
      || !(target instanceof Node)
      || path.includes(notes.panel.root)
      || path.includes(list.root)
      || path.some((node) =>
        node instanceof Element && (
          node.classList.contains('bfa-journal-photo-viewer')
          || node.classList.contains('bfa-journal-photo-picker')
        ))
    ) {
      return;
    }

    notes.dismissFromOutside();
  }

  function fitOpenJournal(): void {
    if (state.contentHost !== null && isShown()) {
      fitJournalToVisiblePane(list.root, state.contentHost);
    }
    if (!notes.panel.root.hidden) {
      notes.panel.place();
    }
  }

  function revokePhotoUrls(): void {
    for (const url of photoUrls.values()) {
      URL.revokeObjectURL(url);
    }
    photoUrls.clear();
  }
}

function accentFromCapturedChrome(chrome: string): string | null {
  const [color = '', borderBottom = '', boxShadow = ''] = chrome.split('|');
  for (const value of [boxShadow, borderBottom, color]) {
    const match = /rgba?\([^)]+\)|#[\da-f]{6}/i.exec(value);
    if (match?.[0] !== undefined && isChromaticColor(match[0])) {
      return match[0];
    }
  }

  return null;
}

function isChromaticColor(color: string): boolean {
  const hex = /^#([\da-f]{6})$/i.exec(color);
  const rgb = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  const hexChannels = hex?.[1];
  const channels = hexChannels !== undefined
    ? [
      Number.parseInt(hexChannels.slice(0, 2), 16),
      Number.parseInt(hexChannels.slice(2, 4), 16),
      Number.parseInt(hexChannels.slice(4, 6), 16),
    ]
    : rgb?.[1] === undefined || rgb[2] === undefined || rgb[3] === undefined
      ? null
      : [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  if (channels === null || channels.some((channel) => !Number.isFinite(channel))) {
    return false;
  }

  const max = Math.max(...channels);
  const min = Math.min(...channels);
  return max - min > 28 && max > 70;
}

function setTabActive(tab: HTMLElement, isActive: boolean): void {
  const hitTarget = tab.closest<HTMLElement>('[data-bfa-character-journal-tab-item]') ?? tab;
  tab.classList.toggle('bfa-character-journal-tab--active', isActive);
  hitTarget.classList.toggle('bfa-character-journal-tab--active', isActive);
  const nativeActiveClass = hitTarget.dataset.bfaNativeActiveClass;
  if (nativeActiveClass !== undefined && nativeActiveClass !== '') {
    hitTarget.classList.toggle(nativeActiveClass, isActive);
  }

  setJournalTabSelected(tab, isActive);
  tab.style.color = '';
  tab.style.borderBottom = '';
  tab.style.boxShadow = '';
  const chrome = hitTarget.dataset.bfaTabChrome;
  const accent = chrome === undefined ? null : accentFromCapturedChrome(chrome);
  if (isActive && accent !== null) {
    hitTarget.style.setProperty('--bfa-journal-accent', accent);
  } else {
    hitTarget.style.removeProperty('--bfa-journal-accent');
  }
  const sheetPaintsSelection = tab.hasAttribute('aria-checked')
    || (nativeActiveClass !== undefined && nativeActiveClass !== '');
  if (isActive && !sheetPaintsSelection && chrome !== undefined) {
    const [color, borderBottom, boxShadow] = chrome.split('|');
    if (color !== undefined) {
      tab.style.color = color;
    }
    if (borderBottom !== undefined) {
      tab.style.borderBottom = borderBottom;
    }
    if (boxShadow !== undefined) {
      tab.style.boxShadow = boxShadow;
    }
  }

  if (!isActive) {
    restoreNativeTabAfterJournal(tab);
  }
}
