import {beforeEach, describe, expect, it} from 'vitest';

import {JOURNAL_IMAGE_ORPHAN_GRACE_MS} from '../../src/features/character-journal/character-journal-embeds';
import {createCharacterJournalService} from '../../src/features/character-journal/character-journal-service';
import type {JournalImageStore} from '../../src/features/character-journal/character-journal-service';
import type {JournalImage, JournalNote} from '../../src/features/character-journal/character-journal-types';
import type {StoredJournalImage} from '../../src/platform/chrome/journal-messages';

describe('character journal service', () => {
  beforeEach(() => {
    installChrome();
  });

  it('saves text, keeps that text when a photo is attached, and removes the photo blob', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: sequence(['image-1']),
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
    expect(withPhoto.body).toBe('Rain on the tent.\n\n![[img:image-1|camp.png]]');
    expect(withPhoto.images).toHaveLength(1);
    expect(blobs.size).toBe(1);

    const withoutPhoto = await service.removeImage(withPhoto, withPhoto.images[0]?.id ?? '');
    expect(withoutPhoto.images).toEqual([]);
    expect(blobs.size).toBe(0);
    expect(await service.getImage('missing')).toBeNull();
  });

  it('inserts a photo embed at the cursor', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: sequence(['image-1']),
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });
    const saved = await service.save(note({
      body: 'Hello world',
      id: 'note-1',
      title: 'Camp',
    }), null);
    if (saved.kind !== 'saved') {
      throw new Error('expected a saved note');
    }

    const withPhoto = await service.attachImage(
        saved.note,
        new File(['photo-bytes'], 'camp.png', {type: 'image/png'}),
        {end: 6, start: 6},
    );
    expect(withPhoto.body).toBe('Hello ![[img:image-1|camp.png]]world');
    expect(blobs.size).toBe(1);
  });

  it('keeps an orphaned photo until a later save, then deletes it', async () => {
    let clock = new Date('2026-10-13T12:00:00.000Z');
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: sequence(['image-1']),
      imageStore: memoryStore(blobs),
      now: () => clock,
    });
    const saved = await service.save(note({
      body: 'Rain on the tent.',
      id: 'note-1',
      title: 'Camp',
    }), null);
    if (saved.kind !== 'saved') {
      throw new Error('expected a saved note');
    }

    const withPhoto = await service.attachImage(
        saved.note,
        new File(['photo-bytes'], 'camp.png', {type: 'image/png'}),
    );
    const stripped = await service.save({
      ...withPhoto,
      body: 'Rain on the tent.',
    }, withPhoto.updatedAt);
    if (stripped.kind !== 'saved') {
      throw new Error('expected the orphan mark to save');
    }

    expect(stripped.note.images).toHaveLength(1);
    expect(stripped.note.images[0]?.orphanedAt).toBe('2026-10-13T12:00:00.000Z');
    expect(blobs.size).toBe(1);

    clock = new Date(clock.getTime() + JOURNAL_IMAGE_ORPHAN_GRACE_MS - 1);
    const held = await service.save(stripped.note, stripped.note.updatedAt);
    if (held.kind !== 'saved') {
      throw new Error('expected the grace save');
    }
    expect(held.note.images).toHaveLength(1);
    expect(blobs.size).toBe(1);

    const restored = await service.save({
      ...held.note,
      body: withPhoto.body,
    }, held.note.updatedAt);
    if (restored.kind !== 'saved') {
      throw new Error('expected the undo save');
    }
    expect(restored.note.images[0]?.orphanedAt).toBeUndefined();
    expect(blobs.size).toBe(1);

    const marked = await service.save({
      ...restored.note,
      body: 'Rain on the tent.',
    }, restored.note.updatedAt);
    if (marked.kind !== 'saved') {
      throw new Error('expected a new orphan mark');
    }
    clock = new Date(Date.parse(marked.note.images[0]?.orphanedAt ?? '') + JOURNAL_IMAGE_ORPHAN_GRACE_MS);
    const gone = await service.save(marked.note, marked.note.updatedAt);
    if (gone.kind !== 'saved') {
      throw new Error('expected the cleanup save');
    }
    expect(gone.note.images).toEqual([]);
    expect(blobs.size).toBe(0);
  });

  it('deletes an orphaned photo immediately when the note is deleted', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: sequence(['image-1']),
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });
    const saved = await service.save(note({
      body: 'Rain on the tent.',
      id: 'note-1',
      title: 'Camp',
    }), null);
    if (saved.kind !== 'saved') {
      throw new Error('expected a saved note');
    }

    const withPhoto = await service.attachImage(
        saved.note,
        new File(['photo-bytes'], 'camp.png', {type: 'image/png'}),
    );
    await service.save({...withPhoto, body: 'Rain on the tent.'}, withPhoto.updatedAt);
    expect(blobs.size).toBe(1);
    await service.deleteEntry('169418374', withPhoto.id);
    expect(blobs.size).toBe(0);
  });

  it('appends embeds for photos that were stored outside the text', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });
    const loose = note({
      body: 'The door was warm.',
      featuredImageId: 'photo-2',
      id: 'loose',
      images: [storedImage('photo-2')],
      title: 'Loose',
    });
    const legacy = note({
      body: '![door.png](bfa-journal-image:photo-1)',
      featuredImageId: 'photo-1',
      id: 'legacy',
      images: [storedImage('photo-1')],
      title: 'Legacy',
    });
    const orphan = note({
      body: 'Gone.',
      featuredImageId: 'photo-3',
      id: 'orphan',
      images: [{
        ...storedImage('photo-3'),
        orphanedAt: '2026-10-13T11:00:00.000Z',
      }],
      title: 'Orphan',
    });
    blobs.set('bfa.journal.image.photo-3', {
      byteBuffer: new ArrayBuffer(4),
      mimeType: 'image/png',
    });
    await new Promise<void>((resolve) => {
      (globalThis as {chrome: {
        storage: {local: {set: (values: Record<string, unknown>, callback: () => void) => void}};
      }}).chrome.storage.local.set({
        'bfa.characterJournal.entries.169418374': [loose, legacy, orphan],
      }, () => resolve());
    });

    const opened = await service.open('169418374');
    const byId = new Map(opened.notes.map((entry) => [entry.id, entry]));
    expect(byId.get('loose')?.body).toBe('The door was warm.\n\n![[img:photo-2]]');
    expect(byId.get('legacy')?.body).toBe('![door.png](bfa-journal-image:photo-1)');
    expect(byId.get('orphan')?.images).toEqual([]);
    expect(blobs.has('bfa.journal.image.photo-3')).toBe(false);

    const again = await service.open('169418374');
    expect(again.notes.find((entry) => entry.id === 'loose')?.body)
        .toBe('The door was warm.\n\n![[img:photo-2]]');
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

  it('keeps a photo stored before resizing and stores a resized file over 3 MB', async () => {
    const original = new Uint8Array([9, 8, 7]).buffer;
    const blobs = new Map<string, StoredJournalImage>([
      ['bfa.journal.image.old', {byteBuffer: original, mimeType: 'image/png'}],
    ]);
    const service = createCharacterJournalService({
      createId: () => 'image-2',
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
      prepareImage: async (file) => ({
        byteBuffer: new Uint8Array([1, 2]).buffer,
        byteSize: 2,
        height: 2048,
        mimeType: 'image/jpeg',
        width: file.size > 3 * 1024 * 1024 ? 1024 : 8,
      }),
    });

    const stored = await service.getImage('bfa.journal.image.old');
    expect(stored?.mimeType).toBe('image/png');
    expect(new Uint8Array(stored?.byteBuffer ?? new ArrayBuffer(0)))
        .toEqual(new Uint8Array([9, 8, 7]));

    const withPhoto = await service.attachImage(
        note({body: 'The scan stays in the note.', id: 'note-1', title: 'Camp'}),
        fileOfSize(4 * 1024 * 1024, 'scan.png'),
    );
    expect(withPhoto.body).toContain('The scan stays in the note.');
    expect(withPhoto.images[0]).toMatchObject({
      byteSize: 2,
      height: 2048,
      mimeType: 'image/jpeg',
      width: 1024,
    });
    expect(blobs.get('bfa.journal.image.old')?.mimeType).toBe('image/png');
  });

  it('names the size and the limit when a resized photo is still over 3 MB', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      createId: () => 'image-3',
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
      prepareImage: async () => ({
        byteBuffer: new Uint8Array(4 * 1024 * 1024).buffer,
        byteSize: 4 * 1024 * 1024,
        height: 2048,
        mimeType: 'image/jpeg',
        width: 2048,
      }),
    });

    await expect(service.attachImage(
        note({body: 'Unchanged.', id: 'note-1', title: 'Camp'}),
        fileOfSize(4 * 1024 * 1024, 'scan.png'),
    )).rejects.toThrow('That image is 4.0 MB after resizing. The limit is 3.0 MB. The note was not changed.');
    expect(blobs.size).toBe(0);
  });

  it('names the size and the 25 MB limit before writing a blob', async () => {
    const blobs = new Map<string, StoredJournalImage>();
    const service = createCharacterJournalService({
      imageStore: memoryStore(blobs),
      now: () => new Date('2026-10-13T12:00:00.000Z'),
    });

    await expect(service.attachImage(
        note({body: 'Unchanged.', id: 'note-1', title: 'Camp'}),
        fileOfSize(26 * 1024 * 1024, 'scan.png'),
    )).rejects.toThrow('That image is 26 MB. The limit is 25 MB. The note was not changed.');
    expect(blobs.size).toBe(0);
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
    body: '',
    characterId: '169418374',
    createdAt: '2026-10-13T12:00:00.000Z',
    featuredImageId: null,
    images: [],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    type: 'session',
    updatedAt: '2026-10-13T12:00:00.000Z',
    ...overrides,
  };
}

function storedImage(id: string): JournalImage {
  return {
    altText: `${id}.png`,
    blobKey: `bfa.journal.image.${id}`,
    byteSize: 4,
    fileName: `${id}.png`,
    height: null,
    id,
    mimeType: 'image/png',
    width: null,
  };
}

function fileOfSize(size: number, name: string): File {
  const file = new File([new Uint8Array([1])], name, {type: 'image/png'});
  Object.defineProperty(file, 'size', {value: size});
  return file;
}

function sequence(ids: readonly string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? `id-${index}`;
}
