import {
  isCharacterJournalEntry,
  type CharacterJournalEntry,
} from './character-journal-types';

export function readJournalRecordArray(value: unknown): unknown[] {
  return Array.isArray(value) ? [...value] : [];
}

export function mergeJournalEntry(
    records: readonly unknown[],
    entry: CharacterJournalEntry,
): unknown[] {
  let replaced = false;
  const next = records.map((record) => {
    if (!isCharacterJournalEntry(record) || record.id !== entry.id) {
      return record;
    }

    replaced = true;
    return record.updatedAt > entry.updatedAt ? record : entry;
  });

  if (!replaced) {
    next.push(entry);
  }

  return next;
}

export function omitJournalEntry(
    records: readonly unknown[],
    entryId: string,
): unknown[] {
  return records.filter((record) => {
    return !isCharacterJournalEntry(record) || record.id !== entryId;
  });
}

export function countUnreadableJournalRecords(
    records: readonly unknown[],
): number {
  return records.filter((record) => {
    return isJournalShaped(record) && !isCharacterJournalEntry(record);
  }).length;
}

function isJournalShaped(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && typeof (value as {id?: unknown}).id === 'string';
}
