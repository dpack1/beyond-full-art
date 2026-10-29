import {beforeEach, describe, expect, it, vi} from 'vitest';

const mocks = vi.hoisted(() => ({
  readFolderNotes: vi.fn(),
  readRawCharacterJournalRecords: vi.fn(),
  writeFolderNotes: vi.fn(),
}));

vi.mock('../../src/background/cleanup-journal', () => ({
  characterHasJournalOrPhotos: vi.fn(async (characterId: string) => characterId === 'source'),
}));

vi.mock('../../src/platform/chrome/folder-library', () => ({
  libraryBlockedError: vi.fn(() => new Error('blocked')),
  readFolderJournalImage: vi.fn(),
  readFolderNotes: mocks.readFolderNotes,
  readFolderPhotoCatalogFile: vi.fn(async () => ({images: [], present: false})),
  resolveLibrary: vi.fn(async () => ({directory: {}, kind: 'ready'})),
  writeFolderJournalImage: vi.fn(),
  writeFolderNotes: mocks.writeFolderNotes,
  writeFolderPhotoCatalogFile: vi.fn(),
}));

vi.mock('../../src/platform/chrome/storage', () => ({
  readRawCharacterJournalRecords: mocks.readRawCharacterJournalRecords,
  updateJournalNoteRecords: vi.fn(),
}));

vi.mock('../../src/platform/chrome/indexed-db', () => ({
  getStoredCharacterArtBlob: vi.fn(),
  putStoredCharacterArtBlob: vi.fn(),
}));

import {duplicateCharacterJournal} from '../../src/background/duplicate-character-journal';

describe('folder-backed character copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFolderNotes.mockResolvedValue([note()]);
  });

  it('reads notes directly from the resolved folder instead of messaging the worker', async () => {
    await duplicateCharacterJournal('source', 'destination');

    expect(mocks.readFolderNotes).toHaveBeenCalledWith({}, 'source');
    expect(mocks.readRawCharacterJournalRecords).not.toHaveBeenCalled();
    expect(mocks.writeFolderNotes).toHaveBeenCalledWith(
        {},
        'destination',
        expect.arrayContaining([expect.objectContaining({characterId: 'destination'})]),
    );
  });
});

function note() {
  return {
    body: 'The copied journal entry.',
    characterId: 'source',
    createdAt: '2026-10-29T00:00:00.000Z',
    featuredImageId: null,
    id: 'note-1',
    images: [],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2 as const,
    sessionDate: null,
    title: 'Session',
    type: 'session' as const,
    updatedAt: '2026-10-29T00:00:00.000Z',
  };
}
