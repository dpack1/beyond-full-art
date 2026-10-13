import journalStyles from './character-journal.css?raw';
import type {CharacterId} from '../character-art/art-types';
import type {CharacterJournalService} from './character-journal-service';
import type {CharacterJournalEntry} from './character-journal-types';
import {
  getTextFromJournalEntry,
  normalizeJournalEntryTitle,
} from './character-journal-types';
import {CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

type JournalStatusTone = 'error' | 'info' | 'success';

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
  bodyInput: HTMLTextAreaElement;
  deleteButton: HTMLButtonElement;
  entryList: HTMLDivElement;
  imageStrip: HTMLDivElement;
  newButton: HTMLButtonElement;
  root: HTMLElement;
  saveButton: HTMLButtonElement;
  status: HTMLParagraphElement;
  titleInput: HTMLInputElement;
}

export function createCharacterJournalSection(
    service: CharacterJournalService,
    doc: Document = document,
): CharacterJournalSection {
  ensureJournalStyles(doc);

  const elements = createJournalElements(doc);
  const hiddenElements = new Map<HTMLElement, HiddenElementState>();
  const state = {
    characterId: null as CharacterId | null,
    contentHost: null as HTMLElement | null,
    entries: [] as CharacterJournalEntry[],
    isBusy: false,
    selectedEntryId: null as string | null,
    tab: null as HTMLElement | null,
  };

  elements.newButton.addEventListener('click', () => {
    startNewEntry();
    renderStatus('');
  });
  elements.saveButton.addEventListener('click', () => {
    void saveDraft();
  });
  elements.deleteButton.addEventListener('click', () => {
    void deleteSelectedEntry();
  });

  return {
    destroy() {
      hide();
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
    mountInContentHost(options.contentHost);
    hideNativeContent(options.contentHost);
    setTabActive(options.tab, true);
    elements.root.hidden = false;
    setDraft('', '');
    state.entries = [];
    state.selectedEntryId = null;
    renderEntries();
    renderImages();
    setBusy(true);
    renderStatus('Loading journal...');

    try {
      state.entries = await service.listEntries(options.characterId);
      const firstEntry = state.entries[0];
      if (firstEntry !== undefined) {
        selectEntry(firstEntry.id);
      } else {
        startNewEntry({focus: false});
      }
      renderStatus('');
    } catch {
      renderStatus('Journal entries could not be loaded.', 'error');
    } finally {
      setBusy(false);
      renderEntries();
    }
  }

  function hide(): void {
    restoreNativeContent();
    elements.root.hidden = true;
    if (state.tab !== null) {
      setTabActive(state.tab, false);
    }
    state.contentHost = null;
    state.tab = null;
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

      hiddenElements.set(child, {
        hidden: child.hidden,
      });
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

  function renderImages(): void {
    elements.imageStrip.replaceChildren();

    const emptyTile = doc.createElement('div');
    const icon = doc.createElement('span');
    const text = doc.createElement('span');
    emptyTile.className = 'bfa-character-journal-image-tile';
    icon.className = 'bfa-character-journal-image-icon';
    icon.setAttribute('aria-hidden', 'true');
    text.className = 'bfa-character-journal-image-text';
    text.textContent = 'Images';
    emptyTile.append(icon, text);
    elements.imageStrip.append(emptyTile);
  }

  function renderEntries(): void {
    elements.entryList.replaceChildren();

    if (state.entries.length === 0) {
      const emptyState = doc.createElement('p');
      emptyState.className = 'bfa-character-journal-status';
      emptyState.textContent = 'No entries yet.';
      elements.entryList.append(emptyState);
      renderButtons();
      return;
    }

    for (const entry of state.entries) {
      const button = doc.createElement('button');
      const title = doc.createElement('span');
      const date = doc.createElement('span');

      button.className = 'bfa-character-journal-entry-button';
      button.type = 'button';
      button.setAttribute(
          'aria-current',
          state.selectedEntryId === entry.id ? 'true' : 'false',
      );
      button.addEventListener('click', () => {
        selectEntry(entry.id);
        renderStatus('');
      });

      title.className = 'bfa-character-journal-entry-title';
      title.textContent = entry.title;
      date.className = 'bfa-character-journal-entry-date';
      date.textContent = formatUpdatedAt(entry.updatedAt);
      button.append(title, date);
      elements.entryList.append(button);
    }

    renderButtons();
  }

  function selectEntry(entryId: string): void {
    const entry = state.entries.find((candidate) => candidate.id === entryId);
    if (entry === undefined) {
      return;
    }

    state.selectedEntryId = entry.id;
    setDraft(entry.title, getTextFromJournalEntry(entry));
    renderEntries();
  }

  function startNewEntry(options: {focus: boolean} = {focus: true}): void {
    state.selectedEntryId = null;
    setDraft('', '');
    renderEntries();
    if (options.focus) {
      elements.titleInput.focus();
    }
  }

  async function saveDraft(): Promise<void> {
    if (state.characterId === null || state.isBusy) {
      return;
    }

    setBusy(true);
    renderStatus('Saving...');
    try {
      const savedEntry = await service.saveTextEntry({
        characterId: state.characterId,
        ...(state.selectedEntryId === null
          ? {}
          : {entryId: state.selectedEntryId}),
        text: elements.bodyInput.value,
        title: elements.titleInput.value,
      });
      state.selectedEntryId = savedEntry.id;
      state.entries = [
        savedEntry,
        ...state.entries.filter((entry) => entry.id !== savedEntry.id),
      ].sort(compareEntries);
      setDraft(savedEntry.title, getTextFromJournalEntry(savedEntry));
      renderEntries();
      renderStatus('Saved.', 'success');
    } catch {
      renderStatus('Entry could not be saved. Your text is still here.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelectedEntry(): Promise<void> {
    if (
      state.characterId === null
      || state.selectedEntryId === null
      || state.isBusy
    ) {
      return;
    }

    const confirmationView = doc.defaultView;
    if (
      confirmationView === null
      || !confirmationView.confirm('Delete this journal entry?')
    ) {
      return;
    }

    const entryId = state.selectedEntryId;
    setBusy(true);
    renderStatus('Deleting...');
    try {
      await service.deleteEntry(state.characterId, entryId);
      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      const nextEntry = state.entries[0];
      if (nextEntry === undefined) {
        startNewEntry({focus: false});
      } else {
        selectEntry(nextEntry.id);
      }
      renderStatus('Deleted.', 'success');
    } catch {
      renderStatus('Entry could not be deleted.', 'error');
    } finally {
      setBusy(false);
      renderEntries();
    }
  }

  function renderButtons(): void {
    elements.saveButton.disabled = state.isBusy;
    elements.newButton.disabled = state.isBusy;
    elements.deleteButton.disabled =
      state.isBusy || state.selectedEntryId === null;
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
}

function createJournalElements(doc: Document): JournalSectionElements {
  const root = doc.createElement('section');
  root.className = 'bfa-character-journal-section';
  root.hidden = true;
  root.setAttribute('aria-label', 'Character journal');

  const imagesPanel = doc.createElement('section');
  imagesPanel.className = 'bfa-character-journal-images';

  const imagesTitle = doc.createElement('h2');
  imagesTitle.className = 'bfa-character-journal-section-title';
  imagesTitle.textContent = 'Images';

  const imageStrip = doc.createElement('div');
  imageStrip.className = 'bfa-character-journal-image-strip';
  imagesPanel.append(imagesTitle, imageStrip);

  const notesPanel = doc.createElement('section');
  notesPanel.className = 'bfa-character-journal-notes';

  const notesHeader = doc.createElement('div');
  notesHeader.className = 'bfa-character-journal-notes-header';

  const notesTitle = doc.createElement('h2');
  notesTitle.className = 'bfa-character-journal-section-title';
  notesTitle.textContent = 'Notes';

  const newButton = doc.createElement('button');
  newButton.className =
    'bfa-character-journal-button bfa-character-journal-button--primary';
  newButton.textContent = 'New entry';
  newButton.type = 'button';

  const body = doc.createElement('div');
  body.className = 'bfa-character-journal-body';

  const entryList = doc.createElement('div');
  entryList.className = 'bfa-character-journal-list';

  const editor = doc.createElement('div');
  editor.className = 'bfa-character-journal-editor';

  const titleInput = doc.createElement('input');
  titleInput.className = 'bfa-character-journal-title-input';
  titleInput.placeholder = normalizeJournalEntryTitle('');
  titleInput.type = 'text';
  titleInput.setAttribute('aria-label', 'Journal entry title');

  const bodyInput = doc.createElement('textarea');
  bodyInput.className = 'bfa-character-journal-body-input';
  bodyInput.setAttribute('aria-label', 'Journal entry body');

  const status = doc.createElement('p');
  status.className = 'bfa-character-journal-status';
  status.setAttribute('aria-live', 'polite');

  const actions = doc.createElement('div');
  actions.className = 'bfa-character-journal-actions';

  const deleteButton = doc.createElement('button');
  deleteButton.className =
    'bfa-character-journal-button bfa-character-journal-button--danger';
  deleteButton.textContent = 'Delete';
  deleteButton.type = 'button';

  const saveButton = doc.createElement('button');
  saveButton.className =
    'bfa-character-journal-button bfa-character-journal-button--primary';
  saveButton.textContent = 'Save';
  saveButton.type = 'button';

  notesHeader.append(notesTitle, newButton);
  actions.append(deleteButton, saveButton);
  editor.append(titleInput, bodyInput, status, actions);
  body.append(entryList, editor);
  notesPanel.append(notesHeader, body);
  root.append(imagesPanel, notesPanel);

  return {
    bodyInput,
    deleteButton,
    entryList,
    imageStrip,
    newButton,
    root,
    saveButton,
    status,
    titleInput,
  };
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

function compareEntries(
    left: CharacterJournalEntry,
    right: CharacterJournalEntry,
): number {
  const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
  return updatedComparison === 0
    ? left.id.localeCompare(right.id)
    : updatedComparison;
}

function formatUpdatedAt(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return updatedAt;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
