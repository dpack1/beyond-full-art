import {beforeEach, describe, expect, it} from 'vitest';

import {
  deleteCharacterJournalEntry,
  getCampaignCardPortraitUpgradeEnabled,
  getCharacterJournalEnabled,
  deleteStoredCharacterArtMetadata,
  deleteStoredCharacterPortraitCropMetadata,
  getAllStoredCharacterArtMetadata,
  getCharacterJournalEntries,
  getStoredCharacterArtMetadata,
  getStoredCharacterPortraitCropMetadata,
  setCharacterJournalEntry,
  setCampaignCardPortraitUpgradeEnabled,
  setCharacterJournalEnabled,
  setStoredCharacterArtMetadata,
  setStoredCharacterPortraitCropMetadata,
} from '../../src/platform/chrome/storage';

describe('character art storage metadata', () => {
  beforeEach(() => {
    (globalThis as {chrome?: unknown}).chrome = {
      runtime: {
        lastError: undefined,
      },
    };
  });

  it('round-trips metadata through the storage wrapper', async () => {
    const storageArea = createFakeStorageArea();
    const metadata = {
      blobKey: 'blob-1',
      byteSize: 2048,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      fileName: 'zurelda.png',
      height: 1024,
      mimeType: 'image/png' as const,
      schemaVersion: 1 as const,
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 1024,
    };

    await setStoredCharacterArtMetadata(metadata, storageArea as never);
    expect(
        await getStoredCharacterArtMetadata('169418374', storageArea as never),
    ).toEqual(metadata);

    await deleteStoredCharacterArtMetadata('169418374', storageArea as never);
    expect(
        await getStoredCharacterArtMetadata('169418374', storageArea as never),
    ).toBeNull();
  });

  it('lists valid full-art metadata sorted by most recent update', async () => {
    const storageArea = createFakeStorageArea();
    const olderMetadata = {
      blobKey: 'blob-1',
      byteSize: 2048,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      fileName: 'older.png',
      height: 1024,
      mimeType: 'image/png' as const,
      schemaVersion: 1 as const,
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 1024,
    };
    const newerMetadata = {
      ...olderMetadata,
      blobKey: 'blob-2',
      characterId: '169418375',
      fileName: 'newer.webp',
      mimeType: 'image/webp' as const,
      updatedAt: '2026-08-07T00:00:00.000Z',
    };

    await setStoredCharacterArtMetadata(olderMetadata, storageArea as never);
    await setStoredCharacterArtMetadata(newerMetadata, storageArea as never);
    await setStoredCharacterPortraitCropMetadata({
      blobKey: 'blob-crop-1',
      byteSize: 1024,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      cropRect: {
        height: 450,
        width: 450,
        x: 100,
        y: 25,
      },
      fileName: 'older-portrait-crop.png',
      height: 512,
      mimeType: 'image/png' as const,
      schemaVersion: 1 as const,
      sourceArtBlobKey: 'blob-1',
      updatedAt: '2026-08-07T00:00:00.000Z',
      width: 512,
    }, storageArea as never);

    expect(await getAllStoredCharacterArtMetadata(storageArea as never)).toEqual([
      newerMetadata,
      olderMetadata,
    ]);
  });

  it('round-trips portrait crop metadata through the storage wrapper', async () => {
    const storageArea = createFakeStorageArea();
    const metadata = {
      blobKey: 'blob-crop-1',
      byteSize: 1024,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      cropRect: {
        height: 450,
        width: 450,
        x: 100,
        y: 25,
      },
      fileName: 'zurelda-portrait-crop.png',
      height: 512,
      mimeType: 'image/png' as const,
      schemaVersion: 1 as const,
      sourceArtBlobKey: 'blob-full-1',
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 512,
    };

    await setStoredCharacterPortraitCropMetadata(metadata, storageArea as never);
    expect(
        await getStoredCharacterPortraitCropMetadata('169418374', storageArea as never),
    ).toEqual(metadata);

    await deleteStoredCharacterPortraitCropMetadata('169418374', storageArea as never);
    expect(
        await getStoredCharacterPortraitCropMetadata('169418374', storageArea as never),
    ).toBeNull();
  });

  it('defaults the campaign portrait enhancement setting to enabled', async () => {
    const storageArea = createFakeStorageArea();

    expect(
        await getCampaignCardPortraitUpgradeEnabled(storageArea as never),
    ).toBe(true);
  });

  it('round-trips the campaign portrait enhancement setting', async () => {
    const storageArea = createFakeStorageArea();

    await setCampaignCardPortraitUpgradeEnabled(false, storageArea as never);
    expect(
        await getCampaignCardPortraitUpgradeEnabled(storageArea as never),
    ).toBe(false);
  });

  it('round-trips the character journal setting', async () => {
    const storageArea = createFakeStorageArea();

    expect(await getCharacterJournalEnabled(storageArea as never)).toBe(true);

    await setCharacterJournalEnabled(false, storageArea as never);
    expect(await getCharacterJournalEnabled(storageArea as never)).toBe(false);
  });

  it('round-trips journal entries sorted by most recent update', async () => {
    const storageArea = createFakeStorageArea();
    const olderEntry = createJournalEntry({
      id: 'entry-1',
      title: 'Older',
      updatedAt: '2026-10-11T00:00:00.000Z',
    });
    const newerEntry = createJournalEntry({
      id: 'entry-2',
      title: 'Newer',
      updatedAt: '2026-10-12T00:00:00.000Z',
    });

    expect(
        await getCharacterJournalEntries('169418374', storageArea as never),
    ).toEqual([]);

    await setCharacterJournalEntry(olderEntry, storageArea as never);
    await setCharacterJournalEntry(newerEntry, storageArea as never);

    expect(
        await getCharacterJournalEntries('169418374', storageArea as never),
    ).toEqual([newerEntry, olderEntry]);
  });

  it('updates and deletes one journal entry without deleting others', async () => {
    const storageArea = createFakeStorageArea();
    const firstEntry = createJournalEntry({
      id: 'entry-1',
      title: 'First',
      updatedAt: '2026-10-11T00:00:00.000Z',
    });
    const secondEntry = createJournalEntry({
      id: 'entry-2',
      title: 'Second',
      updatedAt: '2026-10-12T00:00:00.000Z',
    });
    const updatedFirstEntry = {
      ...firstEntry,
      title: 'Updated first',
      updatedAt: '2026-10-13T00:00:00.000Z',
    };

    await setCharacterJournalEntry(firstEntry, storageArea as never);
    await setCharacterJournalEntry(secondEntry, storageArea as never);
    await setCharacterJournalEntry(updatedFirstEntry, storageArea as never);

    expect(
        await getCharacterJournalEntries('169418374', storageArea as never),
    ).toEqual([updatedFirstEntry, secondEntry]);

    await deleteCharacterJournalEntry(
        '169418374',
        'entry-1',
        storageArea as never,
    );

    expect(
        await getCharacterJournalEntries('169418374', storageArea as never),
    ).toEqual([secondEntry]);
  });

  it('ignores corrupt journal storage values', async () => {
    const storageArea = createFakeStorageArea();
    storageArea.set({
      'bfa.characterJournal.entries.169418374': [
        createJournalEntry({
          id: 'entry-1',
          title: 'Valid',
          updatedAt: '2026-10-12T00:00:00.000Z',
        }),
        {
          id: 'entry-2',
          title: 'Missing blocks',
        },
      ],
    }, () => {});

    expect(
        await getCharacterJournalEntries('169418374', storageArea as never),
    ).toEqual([
      createJournalEntry({
        id: 'entry-1',
        title: 'Valid',
        updatedAt: '2026-10-12T00:00:00.000Z',
      }),
    ]);
  });
});

function createFakeStorageArea() {
  const values: Record<string, unknown> = {};

  return {
    get(
        key: string | null,
        callback: (value: Record<string, unknown>) => void,
    ) {
      if (key === null) {
        callback({...values});
        return;
      }

      callback({
        [key]: values[key],
      });
    },
    remove(key: string, callback: () => void) {
      delete values[key];
      callback();
    },
    set(nextValues: Record<string, unknown>, callback: () => void) {
      Object.assign(values, nextValues);
      callback();
    },
  };
}

function createJournalEntry(overrides: {
  id: string;
  title: string;
  updatedAt: string;
}) {
  return {
    blocks: [
      {
        id: `${overrides.id}-block`,
        text: `${overrides.title} text`,
        type: 'text' as const,
      },
    ],
    characterId: '169418374',
    createdAt: '2026-10-10T00:00:00.000Z',
    id: overrides.id,
    schemaVersion: 1 as const,
    title: overrides.title,
    updatedAt: overrides.updatedAt,
  };
}
