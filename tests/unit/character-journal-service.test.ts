import {beforeEach, describe, expect, it} from 'vitest';

import {createCharacterJournalService} from '../../src/features/character-journal/character-journal-service';
import type {JournalImageStore} from '../../src/features/character-journal/character-journal-service';
import type {JournalNote} from '../../src/features/character-journal/character-journal-types';
import type {StoredJournalImage} from '../../src/platform/chrome/journal-messages';

describe('character journal service', () => {
  beforeEach(() => {
    installChrome();
  });

  it('saves text, keeps that text when a photo is attached, and removes the photo blob', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: sequence(['note-1', 'image-1']),
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });

    const saved = await service.save(note({
      body: 'Rain on the tent.',
      id: 'note-1',
      title: 'Camp',
    }), null);
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') {
      return;
    }

    const withPhoto = await service.attachImage(
        saved.note,
        new File(['photo-bytes'], 'camp.png', {type: 'image/png'}),
    );

    expect(withPhoto.title).toBe('Camp');
    expect(withPhoto.body).toContain('Rain on the tent.');
    expect(withPhoto.images).toHaveLength(1);
    expect(blobs.size).toBe(1);

    const withoutPhoto = await service.removeImage(withPhoto, withPhoto.images[0]?.id ?? '');
    expect(withoutPhoto.images).toEqual([]);
    expect(blobs.size).toBe(0);
    expect(await service.getImage('missing')).toBeNull();
  });

  it('does not keep a photo blob when saving the note fails', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: () => 'image-1',
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });
    (globalThis as unknown as {
      chrome: {storage: {local: {set: () => void}}};
    }).chrome.storage.local.set = () => {
      throw new Error('storage failed');
    };

    await expect(service.attachImage(note({
      body: 'Still here.',
      id: 'note-1',
      title: 'Camp',
    }), new File(['photo-bytes'], 'camp.png', {type: 'image/png'}))).rejects.toThrow(
        'storage failed',
    );
    expect(blobs.size).toBe(0);
  });

  it('keeps two different notes when storage set is delayed', async () => {
    const values: Record<string, unknown> = {};
    (globalThis as {chrome?: unknown}).chrome = {
      runtime: {lastError: undefined},
      storage: {
        local: {
          get(key: string, callback: (value: Record<string, unknown>) => void) {
            queueMicrotask(() => {
              callback({[key]: values[key]});
            });
          },
          remove(key: string, callback: () => void) {
            delete values[key];
            callback();
          },
          set(nextValues: Record<string, unknown>, callback: () => void) {
            queueMicrotask(() => {
              Object.assign(values, nextValues);
              callback();
            });
          },
        },
      },
    };
    const service = createCharacterJournalService({
      createId: sequence(['note-a', 'note-b']),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });

    const done = Promise.all([
      service.save(note({id: 'note-a', title: 'Map'}), null),
      service.save(note({id: 'note-b', title: 'Gate'}), null),
    ]);
    for (let turn = 0; turn < 40; turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await done;

    const opened = await service.open('169418374');
    expect(opened.notes.map((entry) => entry.id).sort()).toEqual(['note-a', 'note-b']);
  });
});

function installChrome(): void {
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
}

function memoryStore(blobs: Map<string, StoredJournalImage>): JournalImageStore {
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

function note(overrides: Partial<JournalNote> & Pick<JournalNote, 'id' | 'title'>): JournalNote {
  return {
    body: overrides.body ?? '',
    characterId: '169418374',
    createdAt: '2026-10-13T12:00:00.000Z',
    featuredImageId: null,
    id: overrides.id,
    images: [],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title: overrides.title,
    type: 'session',
    updatedAt: '2026-10-13T12:00:00.000Z',
  };
}

function sequence(ids: readonly string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? `id-${index}`;
}
