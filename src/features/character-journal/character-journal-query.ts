import type {CharacterJournalEntry, JournalEntryType, JournalNote} from './character-journal-types';
import {
  getImageBlocks,
  getTextFromJournalEntry,
} from './character-journal-types';
import {journalPlainText} from './character-journal-markdown';

export type JournalPhotoFilter = 'all' | 'with-photos';
export type JournalSortOrder = 'newest' | 'oldest';

export function filterJournalEntries(
    entries: readonly CharacterJournalEntry[],
    query: string,
    photoFilter: JournalPhotoFilter,
): CharacterJournalEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    if (photoFilter === 'with-photos' && getImageBlocks(entry).length === 0) {
      return false;
    }

    if (normalizedQuery === '') {
      return true;
    }

    return getJournalSearchText(entry).includes(normalizedQuery);
  });
}

export function orderJournalEntries(
    entries: readonly CharacterJournalEntry[],
    sortOrder: JournalSortOrder,
): CharacterJournalEntry[] {
  const newestFirst = [...entries].sort(compareJournalEntriesNewestFirst);
  return sortOrder === 'oldest' ? newestFirst.reverse() : newestFirst;
}

export function getJournalEntryPreview(entry: CharacterJournalEntry): string {
  const text = getTextFromJournalEntry(entry).trim().replace(/\s+/g, ' ');
  if (text === '') {
    return 'No note text yet.';
  }

  return text.length > 90 ? `${text.slice(0, 87)}...` : text;
}

export function formatPhotoCount(count: number): string {
  if (count <= 0) {
    return '';
  }

  return count === 1 ? '1 photo' : `${count} photos`;
}

export function getJournalEmptyMessage(
    query: string,
    photoFilter: JournalPhotoFilter,
    hasEntries: boolean,
): string | null {
  const trimmedQuery = query.trim();
  if (trimmedQuery !== '') {
    return `No notes match “${trimmedQuery}”.`;
  }

  if (photoFilter === 'with-photos') {
    return hasEntries
      ? 'No notes with photos yet.'
      : 'No notes yet.';
  }

  if (!hasEntries) {
    return 'No notes yet.';
  }

  return null;
}

function getJournalSearchText(entry: CharacterJournalEntry): string {
  return [
    entry.title,
    getTextFromJournalEntry(entry),
    ...getImageBlocks(entry).map((block) => block.fileName),
  ].join('\n').toLowerCase();
}

export type JournalCategory =
  | 'all'
  | 'backstory'
  | 'item'
  | 'npc'
  | 'place'
  | 'quest'
  | 'session';

export const JOURNAL_CATEGORIES: readonly JournalCategory[] = [
  'all',
  'session',
  'npc',
  'place',
  'item',
  'quest',
  'backstory',
];

const CATEGORY_LABELS: Record<JournalCategory, string> = {
  all: 'All',
  backstory: 'Backstory',
  item: 'Items',
  npc: 'NPCs',
  place: 'Places',
  quest: 'Quests',
  session: 'Sessions',
};

const TYPE_LABELS: Record<JournalEntryType, string> = {
  backstory: 'Backstory',
  item: 'Item',
  npc: 'NPC',
  place: 'Place',
  quest: 'Quest',
  session: 'Session',
  unset: 'Unsorted',
};

const EMPTY_LABELS: Record<JournalCategory, string> = {
  all: 'No notes',
  backstory: 'No backstory',
  item: 'No items',
  npc: 'No NPCs',
  place: 'No places',
  quest: 'No quests',
  session: 'No sessions',
};

export function journalCategoryLabel(category: JournalCategory): string {
  return CATEGORY_LABELS[category];
}

export function journalTypeLabel(type: JournalEntryType): string {
  return TYPE_LABELS[type];
}

export function journalCategoryCounts(
    notes: readonly JournalNote[],
): Record<JournalCategory, number> {
  const counts: Record<JournalCategory, number> = {
    all: notes.length,
    backstory: 0,
    item: 0,
    npc: 0,
    place: 0,
    quest: 0,
    session: 0,
  };
  for (const note of notes) {
    if (note.type !== 'unset') {
      counts[note.type] += 1;
    }
  }

  return counts;
}

export function visibleJournalNotes(
    notes: readonly JournalNote[],
    filters: readonly JournalEntryType[],
    query: string,
): JournalNote[] {
  const selected = new Set<JournalEntryType>(
      filters.filter((type) => type !== 'unset'),
  );
  const needle = query.trim().toLocaleLowerCase();
  return notes
      .filter((note) => selected.size === 0 || selected.has(note.type))
      .filter((note) => needle === '' || journalSearchText(note).includes(needle))
      .sort((left, right) => compareJournalNotes(left, right, selected));
}

export function journalEmptyLabel(
    filters: readonly JournalEntryType[],
    query: string,
): string {
  if (query.trim() !== '') {
    return 'No matches';
  }

  if (filters.length === 1) {
    const only = filters[0];
    if (only !== undefined && only !== 'unset') {
      return EMPTY_LABELS[only];
    }
  }

  return EMPTY_LABELS.all;
}

export function journalRowPreview(note: JournalNote): string {
  return journalPlainText(note.body);
}

function journalSearchText(note: JournalNote): string {
  return [
    note.title,
    note.body,
    ...note.images.map((image) => image.fileName),
  ].join('\n').toLocaleLowerCase();
}

function compareJournalNotes(
    left: JournalNote,
    right: JournalNote,
    selected: ReadonlySet<JournalEntryType>,
): number {
  if (selected.size === 0 || selected.has('session')) {
    const dateComparison = compareSessionDate(left, right);
    if (selected.size === 1 && selected.has('session') && dateComparison !== 0) {
      return dateComparison;
    }
  }

  const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
  return updatedComparison === 0
    ? left.id.localeCompare(right.id)
    : updatedComparison;
}

function compareSessionDate(left: JournalNote, right: JournalNote): number {
  if (left.sessionDate === right.sessionDate) {
    return 0;
  }

  if (left.sessionDate === null) {
    return 1;
  }

  if (right.sessionDate === null) {
    return -1;
  }

  return right.sessionDate.localeCompare(left.sessionDate);
}

function compareJournalEntriesNewestFirst(
    left: CharacterJournalEntry,
    right: CharacterJournalEntry,
): number {
  const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
  return updatedComparison === 0
    ? left.id.localeCompare(right.id)
    : updatedComparison;
}
