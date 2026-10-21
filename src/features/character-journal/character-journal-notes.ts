import type {CharacterId} from '../character-art/art-types';
import {restoreFocus} from '../fullscreen-viewer/focus';
import {journalSaveErrorMessage} from './character-journal-errors';
import {mentionCounts, resolveWikiTitle, wikiLinkNames} from './character-journal-links';
import type {JournalListView} from './character-journal-list';
import {patchTaskCheckbox} from './character-journal-markdown';
import {createJournalPanel, type JournalPanelView, type PanelConfirmModel, type PanelModel} from './character-journal-panel';
import {createJournalPhotoViewer} from './character-journal-photo-viewer';
import {journalTypeLabel} from './character-journal-query';
import {applyCopiedControlClasses, paintJournalSurface} from './character-journal-sheet-style';
import type {CharacterJournalService} from './character-journal-service';
import {journalBodyNeedsStarter, starterJournalBody} from './character-journal-templates';
import type {JournalEntryType, JournalNote} from './character-journal-types';
import {normalizeJournalEntryTitle, validateJournalImageFile} from './character-journal-types';
import type {WikiAutocomplete} from './character-journal-autocomplete';

export interface OpenPanel {
  confirm: PanelConfirmModel['kind'] | 'hide' | null;
  error: string | null;
  forward: string[];
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

export interface JournalNoteState {
  characterId: CharacterId | null;
  contentHost: HTMLElement | null;
  fileError: string | null;
  notes: JournalNote[];
  panel: OpenPanel | null;
  routeId: CharacterId | null;
}

export interface JournalNoteFlags {
  hideCancel: (() => void) | null;
  pendingTeardown: (() => void) | null;
  suppressRouteAdopt: boolean;
}

export interface JournalNotes {
  cancelSave(): void;
  closePanel(): void;
  finishPendingHide(): void;
  isDirty(): boolean;
  openNew(type: JournalEntryType, returnFocus: HTMLElement): void;
  openNote(note: JournalNote, mode: 'edit' | 'read', returnFocus: HTMLElement | null, history: string[]): void;
  panel: JournalPanelView;
  renderPanel(): void;
  savePanel(): Promise<void>;
}

export interface JournalNotesDeps {
  autocomplete: WikiAutocomplete;
  doc: Document;
  flags: JournalNoteFlags;
  hide: () => void;
  hydrateImages: (notes: readonly JournalNote[]) => Promise<void>;
  list: JournalListView;
  photoUrls: Map<string, string>;
  photoViewer: ReturnType<typeof createJournalPhotoViewer>;
  reload: () => Promise<void>;
  renderList: () => void;
  service: CharacterJournalService;
  state: JournalNoteState;
}

export function installJournalNotes(deps: JournalNotesDeps): JournalNotes {
  const {
    autocomplete,
    doc,
    flags,
    hide,
    hydrateImages,
    list,
    photoUrls,
    photoViewer,
    reload,
    renderList,
    service,
    state,
  } = deps;
  let saveTimer = 0;

  const panel = createJournalPanel(doc, {
    onBack: () => {
      const previous = state.panel?.history[0];
      if (previous === undefined || state.panel === null) {
        return;
      }

      const note = state.notes.find((entry) => entry.id === previous);
      if (note !== undefined) {
        const forward = [state.panel.note.id, ...state.panel.forward];
        openNote(
            note,
            'read',
            state.panel.returnFocus,
            state.panel.history.slice(1),
            forward,
        );
      }
    },
    onNext: () => {
      const nextId = state.panel?.forward[0];
      if (nextId === undefined || state.panel === null) {
        return;
      }

      const note = state.notes.find((entry) => entry.id === nextId);
      if (note !== undefined) {
        openNote(
            note,
            'read',
            state.panel.returnFocus,
            [state.panel.note.id, ...state.panel.history],
            state.panel.forward.slice(1),
        );
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
    onClose: () => closeNote(),
    onConfirm: (accepted) => {
      const kind = state.panel?.confirm;
      if (state.panel !== null) {
        state.panel.confirm = null;
      }

      if (!accepted) {
        const cancel = flags.hideCancel;
        flags.hideCancel = null;
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

      if (kind === 'discard') {
        closePanel();
        return;
      }

      if (kind === 'hide') {
        finishPendingHide();
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
    onType: (type) => {
      if (state.panel === null || type === state.panel.note.type || type === 'unset') {
        return;
      }

      const draft = draftNote();
      const body = journalBodyNeedsStarter(state.panel.note.type, draft.body)
        ? starterJournalBody(type)
        : draft.body;
      state.panel.note = {
        ...state.panel.note,
        body,
        title: draft.title,
        type,
      };
      if (panel.textarea !== null) {
        panel.textarea.value = body;
      }
      scheduleSave();
      renderPanel();
    },
    onWiki: (name, resolution) => {
      if (state.panel === null || resolution === 'missing') {
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

      return;
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

  function openNew(type: JournalEntryType, returnFocus: HTMLElement): void {
    if (state.characterId === null) {
      return;
    }

    if (filingCharacterId() === null) {
      state.fileError = 'This sheet changed. Close the open note before adding a note.';
      list.setAlert(state.fileError);
      return;
    }

    state.fileError = null;
    list.setAlert(null);
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
      forward: string[] = [],
  ): void {
    if (state.panel !== null && state.panel.note.id !== note.id) {
      flushScheduledSave();
    }
    state.panel = {
      confirm: null,
      error: null,
      forward,
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
    const adoptRoute = state.routeId !== null && state.routeId !== state.characterId;
    state.panel = null;
    state.fileError = null;
    panel.root.hidden = true;
    list.root.inert = false;
    list.setAlert(null);
    restoreFocus(returnTarget);
    if (adoptRoute && state.routeId !== null && !flags.suppressRouteAdopt) {
      state.characterId = state.routeId;
      void reload();
    }
  }

  function renderPanel(): void {
    if (state.panel === null) {
      panel.root.hidden = true;
      list.root.inert = false;
      return;
    }

    const note = draftNote();
    const mentions = mentionCounts([...state.notes.filter((entry) => entry.id !== note.id), note]);
    panel.render({
      back: state.panel.history.length > 0,
      next: state.panel.forward.length > 0,
      body: state.panel.mode === 'edit'
        ? (panel.textarea?.value ?? state.panel.note.body)
        : note.body,
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
      type: note.type,
      typeLabel: journalTypeLabel(note.type),
    });
    const paint = paintJournalSurface(panel.root, state.contentHost ?? list.root, 'panel');
    applyCopiedControlClasses(panel.root, paint);
    panel.setDark(paint.mode === 'dark');
    panel.root.classList.add('bfa-journal-panel');
  }

  function closeNote(): void {
    if (state.panel === null) {
      finishPendingHide();
      return;
    }

    if (state.panel.mismatch || !isDirty()) {
      if (flags.pendingTeardown !== null) {
        finishPendingHide();
        return;
      }

      closePanel();
      return;
    }

    state.panel.confirm = flags.pendingTeardown === null ? 'discard' : 'hide';
    renderPanel();
  }

  function finishPendingHide(): void {
    const teardown = flags.pendingTeardown;
    flags.pendingTeardown = null;
    flags.hideCancel = null;
    hide();
    teardown?.();
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
      saveTimer = 0;
      void savePanel();
    }, 500);
  }

  function flushScheduledSave(): void {
    if (saveTimer === 0) {
      return;
    }

    window.clearTimeout(saveTimer);
    saveTimer = 0;
    void savePanel();
  }

  async function savePanel(): Promise<void> {
    if (state.panel === null || state.characterId === null || state.panel.mismatch || state.panel.stale) {
      return;
    }

    const savedFor = state.characterId;
    const entryId = state.panel.note.id;
    const loadedUpdatedAt = state.panel.loadedUpdatedAt;
    const draft = draftNote();
    state.panel.status = 'saving';
    renderPanel();
    try {
      const result = await service.save({
        ...draft,
        characterId: savedFor,
        needsDetails: false,
        title: draft.title,
      }, loadedUpdatedAt);
      if (state.routeId !== null && state.routeId !== savedFor) {
        return;
      }

      if (result.kind === 'stale') {
        if (state.panel === null || state.panel.note.id !== entryId) {
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
      if (state.panel === null || state.panel.note.id !== entryId) {
        return;
      }

      state.panel.note = result.note;
      state.panel.loadedUpdatedAt = result.note.updatedAt;
      state.panel.status = 'saved';
      state.panel.error = null;
      renderPanel();
    } catch (error) {
      if (
        state.panel === null
        || state.panel.note.id !== entryId
        || (state.routeId !== null && state.routeId !== savedFor)
      ) {
        return;
      }

      state.panel.status = 'error';
      state.panel.error = journalSaveErrorMessage(error);
      renderPanel();
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
      const characterId = filingCharacterId();
      if (characterId === null) {
        return;
      }

      void service.createPlaceholder(characterId, name).then((note) => {
        state.notes = upsert(state.notes, note);
        renderList();
      }).catch(() => undefined);
    });
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

  function filingCharacterId(): CharacterId | null {
    if (
      state.routeId !== null
      && state.characterId !== null
      && state.routeId !== state.characterId
    ) {
      return null;
    }

    return state.characterId;
  }

  return {
    cancelSave() {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    },
    closePanel,
    finishPendingHide,
    isDirty,
    openNew,
    openNote,
    panel,
    renderPanel,
    savePanel,
  };
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
  return validateJournalImageFile(file);
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
