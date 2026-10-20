import {
  JOURNAL_CATEGORIES,
  journalCategoryLabel,
  type JournalCategory,
} from './character-journal-query';
import type {JournalEntryType} from './character-journal-types';

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
  onCategory: (category: JournalCategory) => void;
  onFile: (text: string) => void;
  onNew: (type: JournalEntryType) => void;
  onOpen: (entryId: string, returnFocus: HTMLElement) => void;
  onSearch: (query: string) => void;
}

const NEW_NOTE_TYPES: readonly JournalEntryType[] = [
  'session',
  'npc',
  'place',
  'item',
  'quest',
  'backstory',
];

export interface JournalListView {
  fileField: HTMLInputElement;
  root: HTMLElement;
  searchField: HTMLInputElement;
  setCategory(category: JournalCategory): void;
  setCounts(counts: Record<JournalCategory, number> | null): void;
  setFileError(message: string | null): void;
  setMessage(message: string | null, tone: 'alert' | 'muted' | 'notice'): void;
  setQuickNote(value: string): void;
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

  const heading = doc.createElement('h2');
  heading.className = 'bfa-journal-section-label';
  heading.textContent = 'Journal';

  const quickRow = doc.createElement('div');
  quickRow.className = 'bfa-journal-quick-note';
  const fileField = doc.createElement('input');
  fileField.className = 'bfa-journal-field';
  fileField.type = 'text';
  fileField.placeholder = "Note for today's session";
  fileField.setAttribute('aria-label', "Note for today's session");
  const fileButton = button(doc, 'File note', 'bfa-journal-button bfa-journal-button-primary');
  quickRow.append(fileField, fileButton);

  const fileError = doc.createElement('p');
  fileError.className = 'bfa-journal-alert';
  fileError.setAttribute('role', 'alert');
  fileError.hidden = true;

  const searchRow = doc.createElement('div');
  searchRow.className = 'bfa-journal-search-row';
  const searchField = doc.createElement('input');
  searchField.className = 'bfa-journal-field bfa-journal-search';
  searchField.type = 'search';
  searchField.placeholder = 'Search notes';
  searchField.setAttribute('aria-label', 'Search notes');
  const newButton = button(doc, 'New note', 'bfa-journal-button');
  newButton.setAttribute('aria-haspopup', 'menu');
  newButton.setAttribute('aria-expanded', 'false');
  const menu = doc.createElement('div');
  menu.className = 'bfa-journal-new-note';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  const menuLabel = doc.createElement('p');
  menuLabel.className = 'bfa-journal-menu-label';
  menuLabel.textContent = 'New note';
  menu.append(menuLabel);
  for (const type of NEW_NOTE_TYPES) {
    const item = button(doc, labelForNew(type), 'bfa-journal-menu-item');
    item.setAttribute('role', 'menuitem');
    item.addEventListener('click', () => {
      closeMenu();
      handlers.onNew(type);
    });
    menu.append(item);
  }
  searchRow.append(searchField, newButton, menu);

  const chips = doc.createElement('div');
  chips.className = 'bfa-journal-chips';
  chips.setAttribute('role', 'radiogroup');
  chips.setAttribute('aria-label', 'Categories');
  const chipButtons = new Map<JournalCategory, HTMLButtonElement>();
  for (const category of JOURNAL_CATEGORIES) {
    const chip = button(doc, journalCategoryLabel(category), 'bfa-journal-chip');
    chip.setAttribute('role', 'radio');
    chip.setAttribute('aria-checked', category === 'all' ? 'true' : 'false');
    chip.addEventListener('click', () => {
      handlers.onCategory(category);
    });
    chipButtons.set(category, chip);
    chips.append(chip);
  }

  const message = doc.createElement('p');
  message.className = 'bfa-journal-message';
  message.hidden = true;

  const list = doc.createElement('div');
  list.className = 'bfa-journal-list';

  root.append(heading, quickRow, fileError, searchRow, chips, message, list);

  fileButton.addEventListener('click', () => {
    handlers.onFile(fileField.value);
  });
  fileField.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) {
      event.preventDefault();
      handlers.onFile(fileField.value);
    }
  });
  searchField.addEventListener('input', () => {
    handlers.onSearch(searchField.value);
  });
  newButton.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    newButton.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      menu.querySelector('button')?.focus();
    }
  });
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      newButton.focus();
    }
  });
  chips.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    const selected = JOURNAL_CATEGORIES.find((category) =>
      chipButtons.get(category)?.getAttribute('aria-checked') === 'true',
    ) ?? 'all';
    const index = JOURNAL_CATEGORIES.indexOf(selected);
    const nextIndex = event.key === 'ArrowRight'
      ? Math.min(JOURNAL_CATEGORIES.length - 1, index + 1)
      : Math.max(0, index - 1);
    const next = JOURNAL_CATEGORIES[nextIndex];
    if (next !== undefined && next !== selected) {
      event.preventDefault();
      handlers.onCategory(next);
      chipButtons.get(next)?.focus();
    }
  });

  return {
    fileField,
    root,
    searchField,
    setCategory(category) {
      for (const [key, chip] of chipButtons) {
        const selected = key === category;
        chip.setAttribute('aria-checked', selected ? 'true' : 'false');
        chip.classList.toggle('is-selected', selected);
      }
    },
    setCounts(counts) {
      for (const [key, chip] of chipButtons) {
        const label = journalCategoryLabel(key);
        chip.textContent = counts === null ? label : `${label} ${counts[key]}`;
      }
    },
    setFileError(text) {
      fileError.hidden = text === null;
      fileError.textContent = text ?? '';
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
    setQuickNote(value) {
      fileField.value = value;
    },
    setRows(rows) {
      list.replaceChildren();
      for (const row of rows) {
        list.append(renderRow(doc, row, handlers.onOpen));
      }
    },
  };

  function closeMenu(): void {
    menu.hidden = true;
    newButton.setAttribute('aria-expanded', 'false');
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

function labelForNew(type: JournalEntryType): string {
  switch (type) {
    case 'backstory':
      return 'Backstory';
    case 'item':
      return 'Item';
    case 'npc':
      return 'NPC';
    case 'place':
      return 'Place';
    case 'quest':
      return 'Quest';
    case 'session':
      return 'Session';
    case 'unset':
      return 'Note';
  }
}

function button(doc: Document, label: string, className: string): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  return element;
}
