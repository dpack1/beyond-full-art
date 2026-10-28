import type {JournalPhotoUse} from './character-journal-library';
import {journalCategoryLabel, type JournalCategory} from './character-journal-query';
import {createSectionToolbar} from './character-journal-toolbar';
import {syncIcon} from './character-journal-icons';
import type {JournalEntryType} from './character-journal-types';

type JournalFilterType = Exclude<JournalCategory, 'all'>;

export interface JournalRowModel {
  createdAt: string;
  createdDate: string;
  id: string;
  label: string;
  needsDetails: boolean;
  preview: string | null;
  thumbUrl: string | null;
  title: string;
  updatedAt: string | null;
  updatedDate: string | null;
}

export interface JournalListHandlers {
  onFilter: (types: readonly JournalEntryType[]) => void;
  onManage: () => void;
  onOpen: (entryId: string, returnFocus: HTMLElement) => void;
  onPhotoFilter: (use: JournalPhotoUse) => void;
  onSearch: (query: string) => void;
  onSync: () => void;
}

const FILTER_TYPES: readonly JournalFilterType[] = [
  'session',
  'npc',
  'place',
  'item',
  'quest',
  'backstory',
];

export interface JournalListView {
  disconnect(): void;
  root: HTMLElement;
  searchField: HTMLInputElement;
  setAlert(message: string | null): void;
  setFilters(types: readonly JournalEntryType[]): void;
  setManageLabel(label: string): void;
  setMessage(message: string | null, tone: 'alert' | 'muted' | 'notice'): void;
  setMode(mode: 'notes' | 'photos'): void;
  setPhotoUse(use: JournalPhotoUse): void;
  setRows(rows: readonly JournalRowModel[]): void;
  setSearchValue(value: string): void;
  setSyncBusy(busy: boolean): void;
  setSyncVisible(visible: boolean): void;
}

export function createJournalList(
    doc: Document,
    handlers: JournalListHandlers,
): JournalListView {
  const root = doc.createElement('section');
  root.className = 'bfa-character-journal-section';
  root.hidden = true;
  root.setAttribute('aria-label', 'Journal');

  const toolbar = doc.createElement('div');
  toolbar.className = 'bfa-journal-section-toolbar';
  const chrome = createSectionToolbar(doc);
  const {filterButton, manageButton, row, searchField} = chrome;
  const syncButton = doc.createElement('button');
  syncButton.className = 'bfa-journal-icon-button bfa-journal-sync-folder';
  syncButton.hidden = true;
  syncButton.type = 'button';
  syncButton.title = 'Sync folder';
  syncButton.setAttribute('aria-label', 'Sync folder');
  syncButton.append(syncIcon(doc));
  placeSyncButton(doc, row, manageButton, syncButton);

  const filter = doc.createElement('div');
  filter.className = 'bfa-journal-filter';
  filter.id = 'bfa-journal-filter';
  filter.hidden = true;
  filter.setAttribute('role', 'group');
  filter.setAttribute('aria-label', 'Note types');
  const filterInputs = new Map<JournalFilterType, HTMLInputElement>();
  const noteFilterOptions: HTMLElement[] = [];
  for (const type of FILTER_TYPES) {
    const option = doc.createElement('label');
    option.className = 'bfa-journal-filter-option';
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.value = type;
    box.addEventListener('change', () => {
      handlers.onFilter(selectedTypes());
    });
    filterInputs.set(type, box);
    option.append(box, doc.createTextNode(journalCategoryLabel(type)));
    noteFilterOptions.push(option);
    filter.append(option);
  }
  const photoUses: readonly [JournalPhotoUse, string][] = [
    ['in-note', 'In a note'],
    ['not-in-note', 'Not in a note'],
  ];
  const photoFilterOptions: HTMLElement[] = [];
  const photoInputs = new Map<JournalPhotoUse, HTMLInputElement>();
  for (const [use, label] of photoUses) {
    const option = doc.createElement('label');
    option.className = 'bfa-journal-filter-option';
    option.hidden = true;
    const box = doc.createElement('input');
    box.type = 'checkbox';
    box.value = use;
    box.addEventListener('change', () => {
      handlers.onPhotoFilter(selectedPhotoUse());
    });
    photoInputs.set(use, box);
    option.append(box, doc.createTextNode(label));
    photoFilterOptions.push(option);
    filter.append(option);
  }

  toolbar.append(row, filter);

  const alert = doc.createElement('p');
  alert.className = 'bfa-journal-alert';
  alert.setAttribute('role', 'alert');
  alert.hidden = true;

  const message = doc.createElement('p');
  message.className = 'bfa-journal-message';
  message.hidden = true;

  const list = doc.createElement('div');
  list.className = 'bfa-journal-list';

  root.append(toolbar, alert, message, list);

  const onDocPointer = (event: Event): void => {
    if (filter.hidden) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && toolbar.contains(target)) {
      return;
    }
    closeFilter();
  };
  doc.addEventListener('pointerdown', onDocPointer);

  searchField.addEventListener('input', () => {
    handlers.onSearch(searchField.value);
  });
  filterButton.addEventListener('click', () => {
    const open = filter.hidden;
    filter.hidden = !open;
    filterButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      filter.querySelector('input')?.focus();
    }
  });
  filterButton.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    filterButton.click();
  });
  filter.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeFilter();
      filterButton.focus();
    }
  });
  manageButton.addEventListener('click', () => {
    closeFilter();
    handlers.onManage();
  });
  syncButton.addEventListener('click', handlers.onSync);

  return {
    disconnect() {
      doc.removeEventListener('pointerdown', onDocPointer);
    },
    root,
    searchField,
    setAlert(text) {
      alert.hidden = text === null;
      alert.textContent = text ?? '';
    },
    setFilters(types) {
      const selected = new Set(types);
      for (const [type, box] of filterInputs) {
        box.checked = selected.has(type);
      }
    },
    setManageLabel(label) {
      const content = manageButton.querySelector('span');
      if (content === null) {
        manageButton.textContent = label;
      } else {
        content.textContent = label;
      }
      manageButton.setAttribute('aria-label', label);
    },
    setMode(mode) {
      const photos = mode === 'photos';
      for (const option of noteFilterOptions) {
        option.hidden = photos;
      }
      for (const option of photoFilterOptions) {
        option.hidden = !photos;
      }
      list.hidden = photos;
      filter.setAttribute('aria-label', photos ? 'Photos' : 'Note types');
      searchField.setAttribute('aria-label', photos ? 'Search photos' : 'Search notes');
    },
    setPhotoUse(use) {
      const inNote = photoInputs.get('in-note');
      const unused = photoInputs.get('not-in-note');
      if (inNote !== undefined) {
        inNote.checked = use === 'in-note';
      }
      if (unused !== undefined) {
        unused.checked = use === 'not-in-note';
      }
    },
    setMessage(text, tone) {
      message.hidden = text === null;
      message.dataset.tone = tone;
      message.textContent = text ?? '';
      message.className = `bfa-journal-message bfa-journal-message--${tone}`;
      if (tone === 'alert') {
        message.setAttribute('role', 'alert');
      } else {
        message.removeAttribute('role');
      }
    },
    setRows(rows) {
      list.replaceChildren();
      for (const row of rows) {
        list.append(renderRow(doc, row, handlers.onOpen));
      }
    },
    setSyncBusy(busy) {
      syncButton.disabled = busy;
      syncButton.dataset.busy = busy ? 'true' : 'false';
      const label = busy ? 'Syncing folder' : 'Sync folder';
      syncButton.title = label;
      syncButton.setAttribute('aria-label', label);
    },
    setSyncVisible(visible) {
      syncButton.hidden = !visible;
    },
    setSearchValue(value) {
      searchField.value = value;
    },
  };

  function selectedTypes(): JournalEntryType[] {
    return FILTER_TYPES.filter((type) => filterInputs.get(type)?.checked === true);
  }

  function selectedPhotoUse(): JournalPhotoUse {
    const inNote = photoInputs.get('in-note')?.checked === true;
    const unused = photoInputs.get('not-in-note')?.checked === true;
    if (inNote === unused) {
      return 'all';
    }
    return inNote ? 'in-note' : 'not-in-note';
  }

  function closeFilter(): void {
    filter.hidden = true;
    filterButton.setAttribute('aria-expanded', 'false');
  }
}

function placeSyncButton(
    doc: Document,
    row: HTMLElement,
    manageButton: HTMLButtonElement,
    syncButton: HTMLButtonElement,
): void {
  const parent = manageButton.parentElement;
  if (parent !== null && parent !== row) {
    parent.classList.add('bfa-journal-toolbar-actions');
    parent.insertBefore(syncButton, manageButton);
    return;
  }

  const actions = doc.createElement('div');
  actions.className = 'bfa-journal-toolbar-actions';
  row.insertBefore(actions, manageButton);
  actions.append(syncButton, manageButton);
}

function renderRow(
    doc: Document,
    row: JournalRowModel,
    onOpen: JournalListHandlers['onOpen'],
): HTMLButtonElement {
  const buttonElement = doc.createElement('button');
  buttonElement.type = 'button';
  buttonElement.className = 'bfa-journal-row';
  buttonElement.dataset.entryId = row.id;
  buttonElement.setAttribute('aria-label', row.label);

  const text = doc.createElement('span');
  text.className = 'bfa-journal-row-text';
  const titleLine = doc.createElement('span');
  titleLine.className = 'bfa-journal-row-title-line';
  const title = doc.createElement('span');
  title.className = 'bfa-journal-row-title';
  title.textContent = row.title;
  titleLine.append(title);
  if (row.needsDetails) {
    const needs = doc.createElement('span');
    needs.className = 'bfa-journal-tag bfa-journal-tag-needs';
    needs.textContent = 'Needs details';
    titleLine.append(needs);
  }

  const dates = doc.createElement('span');
  dates.className = 'bfa-journal-row-dates';
  const created = doc.createElement('time');
  created.className = 'bfa-journal-row-created';
  created.dateTime = row.createdAt;
  created.textContent = row.createdDate;
  dates.append(created);
  if (row.updatedDate !== null && row.updatedAt !== null) {
    const updated = doc.createElement('time');
    updated.className = 'bfa-journal-row-updated';
    updated.dateTime = row.updatedAt;
    updated.textContent = `Updated ${row.updatedDate}`;
    dates.append(updated);
  }

  text.append(titleLine);
  if (row.preview !== null && row.preview !== '') {
    const preview = doc.createElement('span');
    preview.className = 'bfa-journal-row-preview';
    preview.textContent = previewJournal(row.preview);
    text.append(preview);
  }
  text.append(dates);

  if (row.thumbUrl !== null) {
    const thumb = doc.createElement('span');
    thumb.className = 'bfa-journal-thumb';
    const image = doc.createElement('img');
    image.alt = '';
    image.src = row.thumbUrl;
    thumb.append(image);
    buttonElement.classList.add('bfa-journal-row--with-thumb');
    buttonElement.append(text, thumb);
  } else {
    buttonElement.append(text);
  }
  buttonElement.addEventListener('click', () => {
    onOpen(row.id, buttonElement);
  });
  return buttonElement;
}

function previewJournal(preview: string): string {
  const clusters = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(preview), (part) => part.segment)
    : Array.from(preview);
  return clusters.length <= 90 ? preview : `${clusters.slice(0, 89).join('')}…`;
}
