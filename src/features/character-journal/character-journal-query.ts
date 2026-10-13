import type {CharacterJournalEntry} from './character-journal-types';
import {
  getImageBlocks,
  getTextFromJournalEntry,
} from './character-journal-types';

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

function compareJournalEntriesNewestFirst(
    left: CharacterJournalEntry,
    right: CharacterJournalEntry,
): number {
  const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
  return updatedComparison === 0
    ? left.id.localeCompare(right.id)
    : updatedComparison;
}
