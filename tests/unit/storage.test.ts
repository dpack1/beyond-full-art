import {beforeEach, describe, expect, it} from 'vitest';

import {
  deleteStoredCharacterArtMetadata,
  getStoredCharacterArtMetadata,
  setStoredCharacterArtMetadata,
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
});

function createFakeStorageArea() {
  const values: Record<string, unknown> = {};

  return {
    get(key: string, callback: (value: Record<string, unknown>) => void) {
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
