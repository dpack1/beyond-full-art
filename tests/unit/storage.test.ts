import {beforeEach, describe, expect, it} from 'vitest';

import {
  getCampaignCardPortraitUpgradeEnabled,
  deleteStoredCharacterArtMetadata,
  deleteStoredCharacterPortraitCropMetadata,
  getAllStoredCharacterArtMetadata,
  getStoredCharacterArtMetadata,
  getStoredCharacterPortraitCropMetadata,
  setCampaignCardPortraitUpgradeEnabled,
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
