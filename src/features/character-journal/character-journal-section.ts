import type {CharacterId} from '../character-art/art-types';
import {restoreFocus} from '../fullscreen-viewer/focus';
import {fitJournalToVisiblePane} from './character-journal-pane';
import {createWikiAutocomplete} from './character-journal-autocomplete';
import {ensureJournalStyles, removeJournalStyles} from './character-journal-elements';
import {journalSaveErrorMessage} from './character-journal-errors';
import {mentionCounts, resolveWikiTitle, wikiLinkNames} from './character-journal-links';
import {createJournalList, type JournalRowModel} from './character-journal-list';
import {patchTaskCheckbox, previewJournalText} from './character-journal-markdown';
import {createJournalPhotoViewer} from './character-journal-photo-viewer';
import {createJournalPanel, type PanelConfirmModel, type PanelModel} from './character-journal-panel';
import {
  journalCategoryCounts,
  journalEmptyLabel,
  journalTypeLabel,
  visibleJournalNotes,
  type JournalCategory,
} from './character-journal-query';
import {applyCopiedControlClasses, paintJournalSurface} from './character-journal-sheet-style';
import type {CharacterJournalService} from './character-journal-service';
import {starterJournalBody} from './character-journal-templates';
import {applySheetTheme, observeSheetTheme} from './character-journal-theme';
import type {JournalEntryType, JournalNote} from './character-journal-types';
import {normalizeJournalEntryTitle, validateJournalImageFile} from './character-journal-types';
import {restoreNativeTabAfterJournal} from '../../platform/dndbeyond/character-sheet-tabs-adapter';
import {
  JOURNAL_SIDEBAR_CLASS,
  JOURNAL_SIDEBAR_PORTAL_CLASS,
} from '../../ddb/selectors';

export interface CharacterJournalSection {
  destroy(): void;
  hide(): void;
  isShown(): boolean;
  requestHide(onHidden?: () => void, onCancel?: () => void): void;
  show(options: CharacterJournalSectionShowOptions): Promise<void>;
  syncRoute(characterId: CharacterId | null): void;
}

export interface CharacterJournalSectionShowOptions {
  characterId: CharacterId;
  contentHost: HTMLElement;
  tab: HTMLElement;
}

interface OpenPanel {
  confirm: PanelConfirmModel['kind'] | 'hide' | null;
  error: string | null;
  history: string[];
  imageError: string | null;
  loadedUpdatedAt: string | null;
  mismatch: boolean;
  mode: 'edit' | 'read';
  note: JournalNote;
  picker: {id: string; label: string}[] | null;
  pickerTitle: string | null;
  returnFocus: HTMLElement | null;
  stale: boolean;
  status: PanelModel['status'];
}

export function createCharacterJournalSection(
    service: CharacterJournalService,
    doc: Document = document,
): CharacterJournalSection {
  ensureJournalStyles(doc);
  const photoViewer = createJournalPhotoViewer(doc);
  const photoUrls = new Map<string, string>();
  let showGeneration = 0;
  let saveTimer = 0;
  let pendingTeardown: (() => void) | null = null;
  let hideCancel: (() => void) | null = null;
  const state = {
    category: 'all' as JournalCategory,
    characterId: null as CharacterId | null,
    contentHost: null as HTMLElement | null,
    migration: 'current' as 'current' | 'failed' | 'loading' | 'migrated',
    notes: [] as JournalNote[],
    panel: null as OpenPanel | null,
    query: '',
    quickNote: '',
    fileError: null as string | null,
    routeId: null as CharacterId | null,
    stopTheme: null as (() => void) | null,
    tab: null as HTMLElement | null,
  };

  const autocomplete = createWikiAutocomplete(doc, () => state.notes);
  const list = createJournalList(doc, {
    onCategory: (category) => {
      state.category = category;
      renderList();
    },
    onFile: (text) => {
      void fileQuickNote(text);
    },
    onNew: (type) => {
      openNew(type, list.root.querySelector<HTMLElement>('.bfa-journal-new-note') ?? list.root);
    },
    onOpen: (entryId, returnFocus) => {
      const note = state.notes.find((entry) => entry.id === entryId);
      if (note !== undefined) {
        openNote(note, 'read', returnFocus, []);
      }
    },
    onSearch: (query) => {
      state.query = query;
      renderList();
    },
  });
  const panel = createJournalPanel(doc, {
    onBack: () => {
      const previous = state.panel?.history[0];
      if (previous === undefined || state.panel === null) {
        return;
      }

      const note = state.notes.find((entry) => entry.id === previous);
      if (note !== undefined) {
        openNote(note, 'read', state.panel.returnFocus, state.panel.history.slice(1));
      }
    },
    onCheckbox: (index, checked) => {
      if (state.panel === null) {
        return;
      }

      const next = patchTaskCheckbox(state.panel.note.body, index, checked);
      if (next === null) {
        return;
      }

      state.panel.note = {...state.panel.note, body: next};
      scheduleSave();
    },
    onClose: () => requestHide(),
    onConfirm: (accepted) => {
      const kind = state.panel?.confirm;
      if (state.panel !== null) {
        state.panel.confirm = null;
      }

      if (!accepted) {
        const cancel = hideCancel;
        hideCancel = null;
        cancel?.();
        renderPanel();
        return;
      }

      if (kind === 'delete' && state.panel !== null && state.characterId !== null) {
        const entryId = state.panel.note.id;
        const characterId = state.characterId;
        closePanel();
        void service.deleteEntry(characterId, entryId).then(() => reload());
        return;
      }

      if (kind === 'replace') {
        void reloadOpenNote();
        return;
      }

      if (kind === 'discard' || kind === 'hide') {
        const teardown = pendingTeardown;
        pendingTeardown = null;
        hideCancel = null;
        hide();
        teardown?.();
      }
    },
    onDelete: () => {
      if (state.panel === null) {
        return;
      }

      state.panel.confirm = 'delete';
      renderPanel();
    },
    onEdit: () => {
      if (state.panel === null) {
        return;
      }

      if (state.panel.mode === 'edit') {
        void savePanel().then(() => {
          if (state.panel !== null && state.panel.status !== 'error') {
            state.panel.mode = 'read';
            renderPanel();
          }
        });
        return;
      }

      state.panel.mode = 'edit';
      renderPanel();
      watchEditorAutocomplete();
    },
    onImage: (file) => {
      void addImage(file);
    },
    onInput: () => {
      if (state.panel !== null) {
        state.panel.note = {
          ...state.panel.note,
          needsDetails: false,
        };
      }
      scheduleSave();
    },
    onMention: (entryId) => {
      followEntry(entryId);
    },
    onPick: (entryId) => {
      followEntry(entryId);
    },
    onReload: () => {
      if (state.panel !== null) {
        state.panel.confirm = 'replace';
        renderPanel();
      }
    },
    onRemoveImage: (imageId) => {
      void removeImage(imageId);
    },
    onViewImage: (imageId, returnFocus) => {
      openPhoto(imageId, returnFocus);
    },
    onWiki: (name, resolution) => {
      if (state.panel === null) {
        return;
      }

      const resolved = resolveWikiTitle(name, state.notes);
      if (resolution === 'many' || resolved.kind === 'many') {
        const count = resolved.kind === 'many' ? resolved.notes.length : 2;
        state.panel.pickerTitle = count === 2
          ? `Two notes are named ${name}`
          : `${count} notes are named ${name}`;
        state.panel.picker = resolved.kind === 'many'
          ? resolved.notes.map((note) => ({
            id: note.id,
            label: `${journalTypeLabel(note.type)} ${note.title} ${shortDate(note.updatedAt)}`,
          }))
          : [];
        renderPanel();
        return;
      }

      if (resolved.kind === 'one') {
        followEntry(resolved.note.id);
        return;
      }

      void service.createPlaceholder(state.characterId ?? '', name).then((note) => {
        state.notes = [...state.notes, note];
        followEntry(note.id);
      }).catch(() => undefined);
    },
    resolveWiki: (name) => {
      const resolved = resolveWikiTitle(name, state.notes);
      return resolved.kind === 'one' ? 'one' : resolved.kind === 'many' ? 'many' : 'missing';
    },
  }, (imageId) => {
    const note = state.panel?.note;
    const image = note?.images.find((item) => item.id === imageId);
    return image === undefined ? null : photoUrls.get(image.blobKey) ?? null;
  }, () => state.panel?.note.images ?? []);

  autocomplete.watch(list.fileField, (name) => {
    if (state.characterId === null) {
      return;
    }

    void service.createPlaceholder(state.characterId, name).then(() => {
      void fileQuickNote(list.fileField.value);
    }).catch(() => {
      list.setFileError('That note could not be filed. It is still in the field.');
    });
  });
  doc.body.append(panel.scrim, panel.root);
  doc.defaultView?.addEventListener('resize', fitOpenJournal);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      void savePanel();
    }
  });

  return {destroy, hide, isShown, requestHide, show, syncRoute};

  async function show(options: CharacterJournalSectionShowOptions): Promise<void> {
    const generation = ++showGeneration;
    state.characterId = options.characterId;
    state.routeId = options.characterId;
    state.contentHost = options.contentHost;
    state.tab = options.tab;
    mount(options.contentHost);
    setTabActive(options.tab, true);
    list.root.hidden = false;
    paint();
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
      state.migration = opened.migration === 'failed' ? 'failed' : 'current';
      await hydrateImages(opened.notes);
    } catch (error) {
      if (generation !== showGeneration) {
        return;
      }

      state.migration = 'current';
      list.setFileError(journalSaveErrorMessage(error));
    }

    renderList();
    fitOpenJournal();
  }

  function syncRoute(characterId: CharacterId | null): void {
    state.routeId = characterId;
    if (!isShown()) {
      return;
    }

    if (characterId === null) {
      requestHide();
      return;
    }

    if (state.panel !== null && characterId !== state.characterId) {
      state.panel.mismatch = true;
      state.panel.status = 'error';
      renderPanel();
      return;
    }

    if (state.panel === null && characterId !== state.characterId) {
      state.characterId = characterId;
      void reload();
    }
  }

  function requestHide(onHidden?: () => void, onCancel?: () => void): void {
    if (!isShown()) {
      onHidden?.();
      return;
    }

    if (!isDirty()) {
      const teardown = onHidden ?? pendingTeardown;
      pendingTeardown = null;
      hideCancel = null;
      hide();
      teardown?.();
      return;
    }

    if (onHidden !== undefined) {
      pendingTeardown = onHidden;
    }
    hideCancel = onCancel ?? null;

    if (state.panel === null) {
      hide();
      pendingTeardown?.();
      pendingTeardown = null;
      return;
    }

    state.panel.confirm = 'hide';
    renderPanel();
  }

  function hide(): void {
    showGeneration += 1;
    window.clearTimeout(saveTimer);
    photoViewer.close();
    closePanel();
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
    doc.defaultView?.removeEventListener('resize', fitOpenJournal);
    hide();
    pendingTeardown = null;
    photoViewer.destroy();
    revokePhotoUrls();
    list.root.remove();
    panel.root.remove();
    panel.scrim.remove();
    removeJournalStyles(doc);
  }

  function isShown(): boolean {
    return !list.root.hidden;
  }

  function mount(host: HTMLElement): void {
    for (const child of [...host.children]) {
      if (child !== list.root && child instanceof HTMLElement) {
        child.dataset.bfaJournalHidden = child.hidden ? 'true' : 'false';
        child.hidden = true;
      }
    }

    if (list.root.parentElement !== host) {
      host.append(list.root);
    }
  }

  function restoreNativeContent(): void {
    const host = state.contentHost;
    if (host === null) {
      return;
    }

    for (const child of host.children) {
      if (child instanceof HTMLElement && child.dataset.bfaJournalHidden !== undefined) {
        child.hidden = child.dataset.bfaJournalHidden === 'true';
        delete child.dataset.bfaJournalHidden;
      }
    }
  }

  async function reload(): Promise<void> {
    if (state.characterId === null) {
      return;
    }

    const opened = await service.open(state.characterId);
    if (state.routeId !== null && state.routeId !== state.characterId && state.panel !== null) {
      return;
    }

    state.notes = opened.notes;
    state.migration = opened.migration === 'failed' ? 'failed' : 'current';
    await hydrateImages(opened.notes);
    renderList();
  }

  function renderList(): void {
    const loading = state.migration === 'loading';
    const failed = state.migration === 'failed';
    list.setCategory(state.category);
    list.setCounts(loading || failed ? null : journalCategoryCounts(state.notes));
    list.setFileError(state.fileError);
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

    const visible = visibleJournalNotes(state.notes, state.category, state.query);
    const counts = mentionCounts(state.notes);
    list.setRows(visible.map((note) => rowModel(note, counts.get(note.id) ?? 0)));
    const notice = state.category === 'all'
      && state.query.trim() === ''
      && state.notes.some((note) => note.type === 'unset' && !note.needsDetails);
    if (notice) {
      list.setMessage('Earlier notes are uncategorized.', 'notice');
    } else if (visible.length === 0) {
      list.setMessage(journalEmptyLabel(state.category, state.query), 'muted');
    } else {
      list.setMessage(null, 'muted');
    }
  }

  function rowModel(note: JournalNote, mentions: number): JournalRowModel {
    const typeLabel = journalTypeLabel(note.type);
    return {
      id: note.id,
      label: `${typeLabel}, ${note.title}${note.needsDetails ? ', needs details' : ''}`,
      mention: mentions > 0 ? `Mentioned in ${mentions}` : null,
      needsDetails: note.needsDetails,
      preview: previewJournalText(note.body),
      thumbUrl: thumbUrl(note),
      title: note.title,
      typeLabel,
    };
  }

  function openNew(type: JournalEntryType, returnFocus: HTMLElement): void {
    if (state.characterId === null) {
      return;
    }

    const timestamp = new Date().toISOString();
    openNote({
      body: starterJournalBody(type),
      characterId: state.characterId,
      createdAt: timestamp,
      featuredImageId: null,
      id: createId(),
      images: [],
      needsDetails: false,
      questStatus: null,
      schemaVersion: 2,
      sessionDate: null,
      title: '',
      type,
      updatedAt: timestamp,
    }, 'edit', returnFocus, []);
    panel.titleField?.focus();
  }

  function openNote(
      note: JournalNote,
      mode: 'edit' | 'read',
      returnFocus: HTMLElement | null,
      history: string[],
  ): void {
    state.panel = {
      confirm: null,
      error: null,
      history,
      imageError: null,
      loadedUpdatedAt: state.notes.some((entry) => entry.id === note.id) ? note.updatedAt : null,
      mismatch: state.routeId !== null && state.routeId !== state.characterId,
      mode,
      note,
      picker: null,
      pickerTitle: null,
      returnFocus,
      stale: false,
      status: null,
    };
    list.root.inert = true;
    renderPanel();
    watchEditorAutocomplete();
    if (mode === 'read') {
      panel.root.focus();
    }
  }

  function followEntry(entryId: string): void {
    const note = state.notes.find((entry) => entry.id === entryId);
    if (note === undefined || state.panel === null) {
      return;
    }

    const history = [state.panel.note.id, ...state.panel.history];
    openNote(note, 'read', state.panel.returnFocus, history);
  }

  function closePanel(): void {
    const returnTarget = state.panel?.returnFocus ?? null;
    state.panel = null;
    panel.root.hidden = true;
    panel.scrim.hidden = true;
    list.root.inert = false;
    restoreFocus(returnTarget);
    autocomplete.watch(list.fileField, (name) => {
      if (state.characterId === null) {
        return;
      }

      void service.createPlaceholder(state.characterId, name).then(() => {
        void fileQuickNote(list.fileField.value);
      }).catch(() => {
        list.setFileError('That note could not be filed. It is still in the field.');
      });
    });
  }

  function renderPanel(): void {
    if (state.panel === null) {
      panel.root.hidden = true;
      panel.scrim.hidden = true;
      list.root.inert = false;
      return;
    }

    const note = draftNote();
    const mentions = mentionCounts([...state.notes.filter((entry) => entry.id !== note.id), note]);
    panel.render({
      back: state.panel.history.length > 0,
      body: state.panel.mode === 'edit' ? (panel.textarea?.value || note.body) : note.body,
      confirm: confirmModel(state.panel.confirm),
      entryId: note.id,
      error: state.panel.error,
      imageError: state.panel.imageError,
      images: note.images.map((image) => ({
        fileName: image.fileName,
        id: image.id,
        url: photoUrls.get(image.blobKey) ?? null,
      })),
      mentions: state.notes
          .filter((entry) => entry.id !== note.id && linksTo(entry, note, state.notes))
          .map((entry) => ({
            id: entry.id,
            label: `${journalTypeLabel(entry.type)} ${entry.title}`,
            title: entry.title,
          })),
      mismatch: state.panel.mismatch,
      mode: state.panel.mode,
      needsDetails: note.needsDetails,
      picker: state.panel.picker,
      pickerTitle: state.panel.pickerTitle,
      stale: state.panel.stale,
      status: state.panel.mismatch || state.panel.stale || state.panel.error !== null
        ? 'error'
        : state.panel.status,
      title: note.title === '' ? 'Untitled entry' : note.title,
      typeLabel: journalTypeLabel(note.type),
    });
    const paint = paintJournalSurface(panel.root, state.contentHost ?? list.root);
    applyCopiedControlClasses(panel.root, paint);
    panel.root.classList.add(
        'bfa-journal-panel',
        JOURNAL_SIDEBAR_CLASS,
        JOURNAL_SIDEBAR_PORTAL_CLASS,
    );
    for (const name of paint.sidebarClass.split(/\s+/)) {
      if (name !== '') {
        panel.root.classList.add(name);
      }
    }
  }

  function confirmModel(kind: OpenPanel['confirm']): PanelConfirmModel | null {
    if (kind === 'delete') {
      return {
        danger: 'Delete note',
        kind: 'delete',
        question: 'Delete this note?',
        safe: 'Keep note',
      };
    }

    if (kind === 'replace') {
      return {
        danger: 'Replace draft',
        kind: 'replace',
        question: 'Replace this draft with the saved note?',
        safe: 'Keep draft',
      };
    }

    if (kind === 'discard' || kind === 'hide') {
      return {
        danger: 'Discard',
        kind: 'discard',
        question: 'This note is not saved yet.',
        safe: 'Keep editing',
      };
    }

    return null;
  }

  function draftNote(): JournalNote {
    if (state.panel === null) {
      throw new Error('Journal panel is closed.');
    }

    if (state.panel.mode !== 'edit') {
      return state.panel.note;
    }

    const draft = panel.readDraft();
    return {
      ...state.panel.note,
      body: draft.body,
      title: draft.title,
    };
  }

  function isDirty(): boolean {
    if (state.panel === null) {
      return false;
    }

    if (state.panel.status === 'saving' || state.panel.status === 'error' || state.panel.mismatch) {
      return true;
    }

    const draft = state.panel.mode === 'edit' ? panel.readDraft() : {
      body: state.panel.note.body,
      title: state.panel.note.title,
    };
    if (state.panel.loadedUpdatedAt === null) {
      return draft.title.trim() !== '' || draft.body.trim() !== '';
    }

    return normalizeJournalEntryTitle(draft.title) !== state.panel.note.title
      || draft.body !== state.panel.note.body;
  }

  function scheduleSave(): void {
    window.clearTimeout(saveTimer);
    if (state.panel?.mismatch || state.panel?.stale) {
      return;
    }

    saveTimer = window.setTimeout(() => {
      void savePanel();
    }, 500);
  }

  async function savePanel(): Promise<void> {
    if (state.panel === null || state.characterId === null || state.panel.mismatch || state.panel.stale) {
      return;
    }

    const savedFor = state.characterId;
    const draft = draftNote();
    state.panel.status = 'saving';
    renderPanel();
    try {
      const result = await service.save({
        ...draft,
        characterId: savedFor,
        needsDetails: false,
        title: draft.title,
      }, state.panel.loadedUpdatedAt);
      if (state.routeId !== null && state.routeId !== savedFor) {
        return;
      }

      if (result.kind === 'stale') {
        if (state.panel === null) {
          return;
        }

        state.panel.stale = true;
        state.panel.status = 'error';
        state.panel.error = 'This note was updated in another window. Your draft is still here.';
        renderPanel();
        return;
      }

      state.notes = upsert(state.notes, result.note);
      renderList();
      if (state.panel === null) {
        return;
      }

      state.panel.note = result.note;
      state.panel.loadedUpdatedAt = result.note.updatedAt;
      state.panel.status = 'saved';
      state.panel.error = null;
      renderPanel();
    } catch (error) {
      if (state.panel === null || (state.routeId !== null && state.routeId !== savedFor)) {
        return;
      }

      state.panel.status = 'error';
      state.panel.error = journalSaveErrorMessage(error);
      renderPanel();
    }
  }

  async function fileQuickNote(text: string): Promise<void> {
    if (state.characterId === null || text.trim() === '') {
      return;
    }

    try {
      await service.fileQuickNote(state.characterId, text);
      state.fileError = null;
      list.setQuickNote('');
      await reload();
    } catch {
      state.fileError = 'That note could not be filed. It is still in the field.';
      renderList();
    }
  }

  async function addImage(file: File): Promise<void> {
    if (state.panel === null) {
      return;
    }

    const validation = imageError(file);
    if (validation !== null) {
      state.panel.imageError = validation;
      renderPanel();
      return;
    }

    try {
      const saved = await service.attachImage(draftNote(), file);
      state.panel.note = saved;
      state.panel.loadedUpdatedAt = saved.updatedAt;
      state.panel.imageError = null;
      state.notes = upsert(state.notes, saved);
      await hydrateImages([saved]);
      state.panel.mode = 'edit';
      renderPanel();
      renderList();
    } catch (error) {
      if (state.panel !== null) {
        state.panel.imageError = error instanceof Error
          ? error.message
          : 'This note could not be saved. Your text is still here.';
        renderPanel();
      }
    }
  }

  async function removeImage(imageId: string): Promise<void> {
    if (state.panel === null) {
      return;
    }

    const saved = await service.removeImage(draftNote(), imageId);
    state.panel.note = saved;
    state.panel.loadedUpdatedAt = saved.updatedAt;
    state.notes = upsert(state.notes, saved);
    renderPanel();
    renderList();
  }

  async function reloadOpenNote(): Promise<void> {
    if (state.panel === null || state.characterId === null) {
      return;
    }

    await reload();
    const note = state.notes.find((entry) => entry.id === state.panel?.note.id);
    if (note !== undefined && state.panel !== null) {
      state.panel.note = note;
      state.panel.loadedUpdatedAt = note.updatedAt;
      state.panel.stale = false;
      state.panel.error = null;
      state.panel.confirm = null;
      state.panel.status = null;
      renderPanel();
    }
  }

  function watchEditorAutocomplete(): void {
    if (panel.textarea === null) {
      return;
    }

    autocomplete.watch(panel.textarea, (name) => {
      if (state.characterId === null) {
        return;
      }

      void service.createPlaceholder(state.characterId, name).then((note) => {
        state.notes = upsert(state.notes, note);
        renderList();
      }).catch(() => undefined);
    });
  }

  async function hydrateImages(notes: readonly JournalNote[]): Promise<void> {
    await Promise.all(notes.flatMap((note) => note.images.map(async (image) => {
      if (photoUrls.has(image.blobKey)) {
        return;
      }

      const stored = await service.getImage(image.blobKey);
      if (stored === null) {
        return;
      }

      const url = URL.createObjectURL(new Blob([stored.byteBuffer], {type: stored.mimeType}));
      photoUrls.set(image.blobKey, url);
    })));
  }

  function thumbUrl(note: JournalNote): string | null {
    const image = note.images[0];
    return image === undefined ? null : photoUrls.get(image.blobKey) ?? null;
  }

  function paint(): void {
    const anchor = state.contentHost ?? list.root;
    applySheetTheme(list.root, anchor);
    applyCopiedControlClasses(list.root, paintJournalSurface(list.root, anchor));
    if (!panel.root.hidden) {
      applyCopiedControlClasses(panel.root, paintJournalSurface(panel.root, anchor));
    }
    fitOpenJournal();
  }

  function fitOpenJournal(): void {
    if (state.contentHost !== null && isShown()) {
      fitJournalToVisiblePane(list.root, state.contentHost);
    }
  }

  function revokePhotoUrls(): void {
    for (const url of photoUrls.values()) {
      URL.revokeObjectURL(url);
    }
    photoUrls.clear();
  }

  function openPhoto(imageId: string, returnFocus: HTMLElement): void {
    const note = state.panel?.note;
    const image = note?.images.find((item) => item.id === imageId);
    if (image === undefined || state.panel === null) {
      return;
    }

    const url = photoUrls.get(image.blobKey);
    if (url === undefined) {
      return;
    }

    const editable = state.panel.mode === 'edit';
    photoViewer.open({
      allowRemove: editable,
      fallbackFocus: panel.root,
      imageUrl: url,
      label: image.fileName,
      onRemove: async () => {
        await removeImage(imageId);
      },
      returnFocus,
    });
  }
}

function linksTo(
    entry: JournalNote,
    target: JournalNote,
    notes: readonly JournalNote[],
): boolean {
  return wikiLinkNames(entry.body).some((name) => {
    const resolved = resolveWikiTitle(name, notes);
    return resolved.kind === 'one' && resolved.note.id === target.id;
  });
}

function upsert(notes: readonly JournalNote[], note: JournalNote): JournalNote[] {
  const next = notes.filter((entry) => entry.id !== note.id);
  next.push(note);
  return next;
}

function imageError(file: File): string | null {
  const validation = validateJournalImageFile(file);
  if (validation === null) {
    return null;
  }

  if (file.size > 3 * 1024 * 1024) {
    return 'That image is over 3 MB. The note was not changed.';
  }

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return 'Use a PNG, JPEG, or WebP image.';
  }

  return validation;
}

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {dateStyle: 'medium'}).format(date);
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `journal-${Date.now()}`;
}

function setTabActive(tab: HTMLElement, isActive: boolean): void {
  const hitTarget = tab.closest<HTMLElement>('[data-bfa-character-journal-tab-item]') ?? tab;
  tab.classList.toggle('bfa-character-journal-tab--active', isActive);
  hitTarget.classList.toggle('bfa-character-journal-tab--active', isActive);
  const nativeActiveClass = hitTarget.dataset.bfaNativeActiveClass;
  if (nativeActiveClass !== undefined && nativeActiveClass !== '') {
    hitTarget.classList.toggle(nativeActiveClass, isActive);
  }

  tab.style.color = '';
  tab.style.borderBottom = '';
  tab.style.boxShadow = '';
  if (isActive && (nativeActiveClass === undefined || nativeActiveClass === '')) {
    const chrome = hitTarget.dataset.bfaTabChrome;
    if (chrome !== undefined) {
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
  }

  if (!isActive) {
    restoreNativeTabAfterJournal(tab);
  }

  if (tab.getAttribute('role') === 'tab') {
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}
