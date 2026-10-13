import {beforeEach, describe, expect, it} from 'vitest';

import {createCharacterJournalService} from '../../src/features/character-journal/character-journal-service';
import type {JournalImageStore} from '../../src/features/character-journal/character-journal-service';
import {getImageBlocks} from '../../src/features/character-journal/character-journal-types';
import type {StoredJournalImage} from '../../src/platform/chrome/journal-messages';

describe('character journal service', () => {
  beforeEach(() => {
    const values: Record<string, unknown> = {};
    (globalThis as {chrome?: unknown}).chrome = {
      runtime: {lastError: undefined},
      storage: {
        local: {
          get(
              key: string | null,
              callback: (value: Record<string, unknown>) => void,
          ) {
            if (key === null) {
              callback({...values});
              return;
            }

            callback({[key]: values[key]});
          },
          remove(key: string, callback: () => void) {
            delete values[key];
            callback();
          },
          set(nextValues: Record<string, unknown>, callback: () => void) {
            Object.assign(values, nextValues);
            callback();
          },
        },
      },
    };
  });

  it('saves text, keeps that text when a photo is attached, and removes the photo blob', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const imageStore = createMemoryImageStore(blobs);
    let nextId = 0;
    const service = createCharacterJournalService({
      createId: () => `id-${nextId += 1}`,
      imageStore,
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });

    const saved = await service.saveTextEntry({
      characterId: '169418374',
      text: 'Rain on the tent.',
      title: 'Camp',
    });
    const withPhoto = await service.attachImage({
      characterId: '169418374',
      entryId: saved.id,
      imageBlocks: [],
      text: 'Rain on the tent.',
      title: 'Camp',
    }, new File(['photo-bytes'], 'camp.png', {type: 'image/png'}));

    expect(withPhoto.title).toBe('Camp');
    expect(withPhoto.blocks[0]).toMatchObject({
      text: 'Rain on the tent.',
      type: 'text',
    });
    expect(getImageBlocks(withPhoto)).toHaveLength(1);
    expect(blobs.size).toBe(1);

    const withoutPhoto = await service.removeImage({
      characterId: '169418374',
      entryId: withPhoto.id,
      imageBlocks: getImageBlocks(withPhoto),
      text: 'Rain on the tent.',
      title: 'Camp',
    }, getImageBlocks(withPhoto)[0]?.id ?? '');

    expect(getImageBlocks(withoutPhoto)).toEqual([]);
    expect(blobs.size).toBe(0);
    expect(await service.getImage('missing')).toBeNull();
  });

  it('does not keep a photo blob when saving the note fails', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: () => 'id-1',
      imageStore: {
        ...createMemoryImageStore(blobs),
        async putImage(input) {
          blobs.set(input.blobKey, {
            byteBuffer: input.byteBuffer,
            mimeType: input.mimeType,
          });
        },
      },
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });
    (globalThis as unknown as {
      chrome: {storage: {local: {set: () => void}}};
    }).chrome.storage.local.set = () => {
      throw new Error('storage failed');
    };

    await expect(service.attachImage({
      characterId: '169418374',
      text: 'Still here.',
      title: 'Camp',
    }, new File(['photo-bytes'], 'camp.png', {type: 'image/png'}))).rejects.toThrow(
        'storage failed',
    );
    expect(blobs.size).toBe(0);
  });
});

function createMemoryImageStore(
    blobs: Map<string, StoredJournalImage>,
): JournalImageStore {
  return {
    async deleteImage(blobKey) {
      blobs.delete(blobKey);
    },
    async getImage(blobKey) {
      return blobs.get(blobKey) ?? null;
    },
    async putImage(input) {
      blobs.set(input.blobKey, {
        byteBuffer: input.byteBuffer,
        mimeType: input.mimeType,
      });
    },
  };
}
