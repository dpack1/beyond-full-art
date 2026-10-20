import {
  isCharacterJournalEntry,
  isJournalNote,
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
  return records.filter((record) => recordId(record) !== entryId);
}

export function mergeJournalRecord(
    records: readonly unknown[],
    entry: {id: string; updatedAt: string},
): unknown[] {
  let replaced = false;
  const next = records.map((record) => {
    if (recordId(record) !== entry.id) {
      return record;
    }

    replaced = true;
    const storedUpdatedAt = recordUpdatedAt(record);
    return storedUpdatedAt !== null && storedUpdatedAt > entry.updatedAt
      ? record
      : entry;
  });

  if (!replaced) {
    next.push(entry);
  }

  return next;
}

export function countUnreadableJournalRecords(
    records: readonly unknown[],
): number {
  return records.filter((record) => {
    return isJournalShaped(record)
      && !isCharacterJournalEntry(record)
      && !isJournalNote(record);
  }).length;
}

function isJournalShaped(value: unknown): boolean {
  return recordId(value) !== null;
}

function recordId(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('id' in value)) {
    return null;
  }

  return typeof value.id === 'string' ? value.id : null;
}

function recordUpdatedAt(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('updatedAt' in value)) {
    return null;
  }

  return typeof value.updatedAt === 'string' ? value.updatedAt : null;
}
