import {describe, expect, it} from 'vitest';

import {
  countUnreadableJournalRecords,
  mergeJournalEntry,
  omitJournalEntry,
} from '../../src/features/character-journal/character-journal-records';
import type {CharacterJournalEntry} from '../../src/features/character-journal/character-journal-types';

describe('character journal records', () => {
  it('merges by id and keeps a newer stored copy', () => {
    const older = createEntry('entry-1', '2026-10-12T00:00:00.000Z');
    const newer = createEntry('entry-1', '2026-10-13T00:00:00.000Z');
    const other = createEntry('entry-2', '2026-10-11T00:00:00.000Z');

    expect(mergeJournalEntry([other, newer], older).map(readId)).toEqual([
      'entry-2',
      'entry-1',
    ]);
    expect(mergeJournalEntry([other, older], newer)[1]).toMatchObject({
      updatedAt: '2026-10-13T00:00:00.000Z',
    });
  });

  it('keeps unrecognized records while removing one valid entry', () => {
    const kept = {id: 'broken', title: 'Missing blocks'};
    const records = [createEntry('entry-1', '2026-10-12T00:00:00.000Z'), kept];

    expect(omitJournalEntry(records, 'entry-1')).toEqual([kept]);
    expect(countUnreadableJournalRecords(records)).toBe(1);
  });
});

function createEntry(id: string, updatedAt: string): CharacterJournalEntry {
  return {
    blocks: [{id: `${id}-text`, text: 'Note', type: 'text'}],
    characterId: '169418374',
    createdAt: '2026-10-10T00:00:00.000Z',
    id,
    schemaVersion: 1,
    title: id,
    updatedAt,
  };
}

function readId(record: unknown): string {
  return typeof record === 'object' && record !== null && 'id' in record
    ? String(record.id)
    : '';
}
