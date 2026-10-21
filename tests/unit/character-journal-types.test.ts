import {describe, expect, it} from 'vitest';

import {
  CHARACTER_JOURNAL_SCHEMA_VERSION,
  getTextFromJournalEntry,
  isCharacterJournalEntry,
  normalizeJournalEntryTitle,
} from '../../src/features/character-journal/character-journal-types';

describe('character journal types', () => {
  it('accepts a valid text journal entry', () => {
    expect(isCharacterJournalEntry({
      blocks: [
        {
          id: 'block-1',
          text: 'Found a strange key.',
          type: 'text',
        },
      ],
      characterId: '169418374',
      createdAt: '2026-10-12T00:00:00.000Z',
      id: 'entry-1',
      schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
      title: 'Session 1',
      updatedAt: '2026-10-12T00:00:00.000Z',
    })).toBe(true);
  });

  it('rejects malformed entries', () => {
    expect(isCharacterJournalEntry({
      blocks: [
        {
          id: 'block-1',
          text: 'Missing type.',
        },
      ],
      characterId: '169418374',
      createdAt: '2026-10-12T00:00:00.000Z',
      id: 'entry-1',
      schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
      title: 'Session 1',
      updatedAt: '2026-10-12T00:00:00.000Z',
    })).toBe(false);
  });

  it('keeps character IDs as strings', () => {
    expect(isCharacterJournalEntry({
      blocks: [],
      characterId: 169418374,
      createdAt: '2026-10-12T00:00:00.000Z',
      id: 'entry-1',
      schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
      title: 'Session 1',
      updatedAt: '2026-10-12T00:00:00.000Z',
    })).toBe(false);
  });

  it('accepts an image block and rejects a photo stored outside the journal prefix', () => {
    expect(isCharacterJournalEntry({
      blocks: [
        {
          id: 'block-text',
          text: 'The door was warm.',
          type: 'text',
        },
        {
          blobKey: 'bfa.journal.image.photo-1',
          byteSize: 128,
          fileName: 'door.png',
          height: 32,
          id: 'photo-1',
          mimeType: 'image/png',
          type: 'image',
          width: 32,
        },
      ],
      characterId: '169418374',
      createdAt: '2026-10-12T00:00:00.000Z',
      id: 'entry-1',
      schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
      title: 'Session 1',
      updatedAt: '2026-10-12T00:00:00.000Z',
    })).toBe(true);

    expect(isCharacterJournalEntry({
      blocks: [
        {
          blobKey: 'character-art-blob',
          byteSize: 128,
          fileName: 'door.png',
          height: null,
          id: 'photo-1',
          mimeType: 'image/png',
          type: 'image',
          width: null,
        },
      ],
      characterId: '169418374',
      createdAt: '2026-10-12T00:00:00.000Z',
      id: 'entry-1',
      schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
      title: 'Session 1',
      updatedAt: '2026-10-12T00:00:00.000Z',
    })).toBe(false);
  });

  it('normalizes blank titles without changing written text', () => {
    expect(normalizeJournalEntryTitle('   ')).toBe('Untitled entry');
    expect(getTextFromJournalEntry({
      blocks: [
        {
          id: 'block-1',
          text: 'First paragraph.',
          type: 'text',
        },
        {
          id: 'block-2',
          text: 'Second paragraph.',
          type: 'text',
        },
      ],
      characterId: '169418374',
      createdAt: '2026-10-12T00:00:00.000Z',
      id: 'entry-1',
      schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
      title: 'Session 1',
      updatedAt: '2026-10-12T00:00:00.000Z',
    })).toBe('First paragraph.\n\nSecond paragraph.');
  });
});
