// @vitest-environment node

import {IDBFactory} from 'fake-indexeddb';
import {describe, expect, it} from 'vitest';

import {
  deleteStoredCharacterArtBlob,
  getStoredCharacterArtBlob,
  putStoredCharacterArtBlob,
} from '../../src/platform/chrome/indexed-db';

describe('character art indexed db', () => {
  it('stores, reads, and deletes blobs', async () => {
    const indexedDb = new IDBFactory();
    const blob = new Blob(['stored art'], {type: 'text/plain'});

    await putStoredCharacterArtBlob('blob-key', blob, indexedDb);

    const storedBlob = await getStoredCharacterArtBlob('blob-key', indexedDb);
    expect(storedBlob).not.toBeNull();
    expect(await storedBlob?.text()).toBe('stored art');

    await deleteStoredCharacterArtBlob('blob-key', indexedDb);
    expect(await getStoredCharacterArtBlob('blob-key', indexedDb)).toBeNull();
  });
});
