import type {CharacterId} from '../character-art/art-types';
import {fitJournalToVisiblePane} from './character-journal-pane';
import {createWikiAutocomplete} from './character-journal-autocomplete';
import {ensureJournalStyles, removeJournalStyles} from './character-journal-elements';
import {journalSaveErrorMessage} from './character-journal-errors';
import {mentionCounts} from './character-journal-links';
import {createJournalList, type JournalRowModel} from './character-journal-list';
import {previewJournalText} from './character-journal-markdown';
import {installJournalNotes, type JournalNotes, type OpenPanel} from './character-journal-notes';
import {createJournalPhotoViewer} from './character-journal-photo-viewer';
import {
  journalCategoryCounts,
  journalEmptyLabel,
  journalTypeLabel,
  visibleJournalNotes,
  type JournalCategory,
} from './character-journal-query';
import {applyCopiedControlClasses, paintJournalSurface} from './character-journal-sheet-style';
import type {CharacterJournalService} from './character-journal-service';
import {applySheetTheme, observeSheetTheme} from './character-journal-theme';
import type {JournalNote} from './character-journal-types';
import {restoreNativeTabAfterJournal} from '../../platform/dndbeyond/character-sheet-tabs-adapter';

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

export function createCharacterJournalSection(
    service: CharacterJournalService,
    doc: Document = document,
): CharacterJournalSection {
  ensureJournalStyles(doc);
  const photoViewer = createJournalPhotoViewer(doc);
  const photoUrls = new Map<string, string>();
  let showGeneration = 0;
  let reloadSerial = 0;
  const flags = {
    hideCancel: null as (() => void) | null,
    pendingTeardown: null as (() => void) | null,
    suppressRouteAdopt: false,
  };
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
  let notes!: JournalNotes;
  const list = createJournalList(doc, {
    onCategory: (category) => {
      state.category = category;
      renderList();
    },
    onFile: (text) => {
      void notes.fileQuickNote(text);
    },
    onNew: (type) => {
      notes.openNew(type, list.root.querySelector<HTMLElement>('.bfa-journal-new-note') ?? list.root);
    },
    onOpen: (entryId, returnFocus) => {
      const note = state.notes.find((entry) => entry.id === entryId);
      if (note !== undefined) {
        notes.openNote(note, 'read', returnFocus, []);
      }
    },
    onSearch: (query) => {
      state.query = query;
      renderList();
    },
  });
  notes = installJournalNotes({
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
  });
  doc.body.append(notes.panel.root);
  doc.defaultView?.addEventListener('resize', fitOpenJournal);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      void notes.savePanel();
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
    if (!isShown()) {
      onHidden?.();
      return;
    }

    if (!notes.isDirty()) {
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

    state.panel.confirm = 'hide';
    notes.renderPanel();
  }

  function hide(): void {
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
    doc.defaultView?.removeEventListener('resize', fitOpenJournal);
    hide();
    flags.pendingTeardown = null;
    photoViewer.destroy();
    revokePhotoUrls();
    list.root.remove();
    notes.panel.root.remove();
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
    state.migration = opened.migration === 'failed' ? 'failed' : 'current';
    await hydrateImages(opened.notes);
    if (!reloadIsCurrent(request, generation, characterId)) {
      return;
    }
    renderList();
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
    if (!notes.panel.root.hidden) {
      applyCopiedControlClasses(
          notes.panel.root,
          paintJournalSurface(notes.panel.root, anchor, 'panel'),
      );
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
  if (isActive && (nativeActiveClass === undefined || nativeActiveClass === '') && chrome !== undefined) {
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

  if (tab.getAttribute('role') === 'tab') {
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  }
}
