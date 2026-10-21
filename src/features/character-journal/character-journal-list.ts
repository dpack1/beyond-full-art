import {journalCategoryLabel, type JournalCategory} from './character-journal-query';
import type {JournalEntryType} from './character-journal-types';

type JournalFilterType = Exclude<JournalCategory, 'all'>;

export interface JournalRowModel {
  id: string;
  label: string;
  mention: string | null;
  needsDetails: boolean;
  preview: string;
  thumbUrl: string | null;
  title: string;
  typeLabel: string;
}

export interface JournalListHandlers {
  onFilter: (types: readonly JournalEntryType[]) => void;
  onManage: () => void;
  onOpen: (entryId: string, returnFocus: HTMLElement) => void;
  onSearch: (query: string) => void;
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
  setMessage(message: string | null, tone: 'alert' | 'muted' | 'notice'): void;
  setRows(rows: readonly JournalRowModel[]): void;
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

  const searchShell = doc.createElement('div');
  searchShell.className = 'bfa-journal-search-shell';
  const searchField = doc.createElement('input');
  searchField.className = 'bfa-journal-search';
  searchField.type = 'search';
  searchField.placeholder = 'Search';
  searchField.setAttribute('aria-label', 'Search notes');
  searchShell.append(searchField);

  const filterButton = button(doc, 'Filter', 'bfa-journal-filter-button');
  filterButton.setAttribute('aria-haspopup', 'true');
  filterButton.setAttribute('aria-expanded', 'false');
  filterButton.setAttribute('aria-controls', 'bfa-journal-filter');

  const manageButton = button(doc, 'Manage Notes', 'bfa-journal-manage');

  const filter = doc.createElement('div');
  filter.className = 'bfa-journal-filter';
  filter.id = 'bfa-journal-filter';
  filter.hidden = true;
  filter.setAttribute('role', 'group');
  filter.setAttribute('aria-label', 'Note types');
  const filterInputs = new Map<JournalFilterType, HTMLInputElement>();
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
    filter.append(option);
  }

  toolbar.append(searchShell, filterButton, manageButton, filter);

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
  };

  function selectedTypes(): JournalEntryType[] {
    return FILTER_TYPES.filter((type) => filterInputs.get(type)?.checked === true);
  }

  function closeFilter(): void {
    filter.hidden = true;
    filterButton.setAttribute('aria-expanded', 'false');
  }
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
  const tag = doc.createElement('span');
  tag.className = 'bfa-journal-tag';
  tag.textContent = row.typeLabel;
  titleLine.append(tag);
  if (row.needsDetails) {
    const needs = doc.createElement('span');
    needs.className = 'bfa-journal-tag bfa-journal-tag-needs';
    needs.textContent = 'Needs details';
    titleLine.append(needs);
  }
  const title = doc.createElement('span');
  title.className = 'bfa-journal-row-title';
  title.textContent = row.title;
  titleLine.append(title);
  text.append(titleLine);
  if (row.preview !== '') {
    const preview = doc.createElement('span');
    preview.className = 'bfa-journal-row-preview';
    preview.textContent = previewJournal(row.preview);
    text.append(preview);
  }
  if (row.mention !== null) {
    const mention = doc.createElement('span');
    mention.className = 'bfa-journal-mention';
    mention.textContent = row.mention;
    text.append(mention);
  }

  const thumb = doc.createElement('span');
  thumb.className = 'bfa-journal-thumb';
  if (row.thumbUrl !== null) {
    const image = doc.createElement('img');
    image.alt = '';
    image.src = row.thumbUrl;
    thumb.append(image);
  }

  buttonElement.append(text, thumb);
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

function button(doc: Document, label: string, className: string): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}
