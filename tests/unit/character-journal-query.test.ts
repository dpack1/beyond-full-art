import {describe, expect, it} from 'vitest';

import {
  filterJournalEntries,
  getJournalEmptyMessage,
  orderJournalEntries,
} from '../../src/features/character-journal/character-journal-query';
import type {CharacterJournalEntry} from '../../src/features/character-journal/character-journal-types';

describe('character journal query', () => {
  const door = createEntry({
    fileName: 'door.png',
    id: 'door',
    text: 'The chapel door was locked.',
    title: 'Locked door',
    updatedAt: '2026-10-13T00:00:00.000Z',
    withPhoto: true,
  });
  const market = createEntry({
    id: 'market',
    text: 'Bought rope.',
    title: 'Market day',
    updatedAt: '2026-10-12T00:00:00.000Z',
    withPhoto: false,
  });

  it('filters by note text, title, and photo file name', () => {
    expect(filterJournalEntries([door, market], 'rope', 'all').map((entry) => entry.id))
        .toEqual(['market']);
    expect(filterJournalEntries([door, market], 'door.png', 'all').map((entry) => entry.id))
        .toEqual(['door']);
    expect(filterJournalEntries([door, market], '', 'with-photos').map((entry) => entry.id))
        .toEqual(['door']);
  });

  it('orders newest or oldest without losing the other direction', () => {
    expect(orderJournalEntries([market, door], 'newest').map((entry) => entry.id))
        .toEqual(['door', 'market']);
    expect(orderJournalEntries([door, market], 'oldest').map((entry) => entry.id))
        .toEqual(['market', 'door']);
  });

  it('describes empty search and photo filters', () => {
    expect(getJournalEmptyMessage('', 'all', false)).toBe('No notes yet.');
    expect(getJournalEmptyMessage('dragon', 'all', true))
        .toBe('No notes match “dragon”.');
    expect(getJournalEmptyMessage('', 'with-photos', true))
        .toBe('No notes with photos yet.');
    expect(getJournalEmptyMessage('', 'all', true)).toBeNull();
  });
});

function createEntry(options: {
  fileName?: string;
  id: string;
  text: string;
  title: string;
  updatedAt: string;
  withPhoto: boolean;
}): CharacterJournalEntry {
  return {
    blocks: [
      {
        id: `${options.id}-text`,
        text: options.text,
        type: 'text',
      },
      ...(options.withPhoto
        ? [{
          blobKey: `bfa.journal.image.${options.id}`,
          byteSize: 10,
          fileName: options.fileName ?? 'photo.png',
          height: null,
          id: `${options.id}-photo`,
          mimeType: 'image/png' as const,
          type: 'image' as const,
          width: null,
        }]
        : []),
    ],
    characterId: '169418374',
    createdAt: options.updatedAt,
    id: options.id,
    schemaVersion: 1,
    title: options.title,
    updatedAt: options.updatedAt,
  };
}
