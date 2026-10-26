// @vitest-environment node

import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, describe, expect, it} from 'vitest';

import {parseBackupFolderMarker} from '../../src/platform/chrome/backup-folder';
import {
  copyBrowserLibraryIntoFolder,
  copyResultMessage,
} from '../../src/platform/chrome/backup-folder-copy';
import {adoptFolderLibrary} from '../../src/platform/chrome/folder-library-adopt';
import {
  readFolderArtBytes,
  readFolderNotes,
  saveFolderFullArt,
  writeFolderNotes,
} from '../../src/platform/chrome/folder-library';
import {LIBRARY_MODE_KEY} from '../../src/platform/chrome/library-mode';
import {
  getStoredCharacterArtBlob,
  putStoredCharacterArtBlob,
} from '../../src/platform/chrome/indexed-db';
import {
  getCharacterArtMetadataKey,
  getCharacterJournalEntriesKey,
} from '../../src/platform/chrome/storage';
import type {JournalNote} from '../../src/features/character-journal/character-journal-types';

describe('copy browser library into a folder', () => {
  beforeEach(() => {
    (globalThis as {chrome?: unknown}).chrome = {
      runtime: {lastError: undefined},
    };
  });

  it('writes a checked character and leaves the browser copy in place', async () => {
    const indexedDb = new IDBFactory();
    const storage = createFakeStorageArea();
    const folder = preparedFolder();
    const artBytes = Uint8Array.from([9, 8, 7, 6]);
    const photoBytes = Uint8Array.from([1, 2, 3, 4]);
    await putStoredCharacterArtBlob('blob-art', new Blob([artBytes], {type: 'image/png'}), indexedDb);
    await putStoredCharacterArtBlob(
        'bfa.journal.image.photo-1',
        new Blob([photoBytes], {type: 'image/png'}),
        indexedDb,
    );
    storage.values[getCharacterArtMetadataKey('172153137')] = artMetadata('172153137', 'blob-art');
    storage.values[getCharacterJournalEntriesKey('172153137')] = [sessionNote()];

    const result = await copyBrowserLibraryIntoFolder(
        folder.root.asHandle(),
        () => '2026-10-23T12:00:00.000Z',
        {factory: indexedDb, storageArea: storage as never},
    );

    expect(result.copiedCharacterIds).toEqual(['172153137']);
    expect(result.failed).toEqual([]);
    expect(result.notes).toBe(1);
    expect(result.photos).toBe(1);
    const character = folder.root.find(['characters', '172153137']);
    const commit = JSON.parse(text(character.files.get('character.json'))) as {
      copiedAt: string;
      fullArt: {sha256: string};
      images: {sha256: string}[];
      notes: {sha256: string}[];
    };
    expect(commit.copiedAt).toBe('2026-10-23T12:00:00.000Z');
    expect(commit.fullArt.sha256).toBe(await sha256Hex(character.files.get('full-art.png')));
    const noteFile = character.find(['journal', 'notes']).files.get('note-1.json');
    const photoFile = character.find(['journal', 'images']).files.get('photo-1.png');
    expect(text(noteFile)).toContain('Met Voss.');
    expect(commit.notes[0]?.sha256).toBe(await sha256Hex(noteFile));
    expect([...(photoFile ?? new Uint8Array())]).toEqual([1, 2, 3, 4]);
    expect(commit.images[0]?.sha256).toBe(await sha256Hex(photoFile));
    const characterWrites = folder.writes.filter((path) => path.startsWith('characters/172153137/'));
    expect(characterWrites.at(-1)).toBe('characters/172153137/character.json');
    expect(folder.writes.at(-1)).toBe('beyond-full-art.json');
    expect(parseBackupFolderMarker(JSON.parse(text(folder.root.files.get('beyond-full-art.json')))))
        .toMatchObject({
          createdAt: '2026-10-20T00:00:00.000Z',
          schemaVersion: 2,
        });
    expect(await getStoredCharacterArtBlob('blob-art', indexedDb)).not.toBeNull();
    expect(await getStoredCharacterArtBlob('bfa.journal.image.photo-1', indexedDb)).not.toBeNull();
  });

  it('does not overwrite a character that already has character.json', async () => {
    const indexedDb = new IDBFactory();
    const storage = createFakeStorageArea();
    const folder = preparedFolder();
    const characters = folder.root.find(['characters']);
    const existing = new MemoryDirectory('172153137', 'characters/172153137', folder.book);
    existing.files.set('character.json', utf8('keep\n'));
    characters.directories.set('172153137', existing);
    await putStoredCharacterArtBlob('blob-art', new Blob([Uint8Array.from([1])]), indexedDb);
    storage.values[getCharacterArtMetadataKey('172153137')] = artMetadata('172153137', 'blob-art');

    const result = await copyBrowserLibraryIntoFolder(
        folder.root.asHandle(),
        () => '2026-10-23T12:00:00.000Z',
        {factory: indexedDb, storageArea: storage as never},
    );

    expect(result.copiedCharacterIds).toEqual([]);
    expect(result.skippedCharacterIds).toEqual(['172153137']);
    expect(text(existing.files.get('character.json'))).toBe('keep\n');
    expect(existing.files.has('full-art.png')).toBe(false);
    expect(parseBackupFolderMarker(JSON.parse(text(folder.root.files.get('beyond-full-art.json'))))
        ?.schemaVersion).toBe(1);
    expect(await getStoredCharacterArtBlob('blob-art', indexedDb)).not.toBeNull();
  });

  it('keeps the marker at version 1 when one character cannot be copied', async () => {
    const indexedDb = new IDBFactory();
    const storage = createFakeStorageArea();
    const folder = preparedFolder();
    await putStoredCharacterArtBlob('blob-art', new Blob([Uint8Array.from([9])]), indexedDb);
    storage.values[getCharacterArtMetadataKey('172153137')] = artMetadata('172153137', 'blob-art');
    storage.values[getCharacterArtMetadataKey('172153138')] = artMetadata('172153138', 'blob-missing');

    const result = await copyBrowserLibraryIntoFolder(
        folder.root.asHandle(),
        () => '2026-10-23T12:00:00.000Z',
        {factory: indexedDb, storageArea: storage as never},
    );

    expect(result.copiedCharacterIds).toEqual(['172153137']);
    expect(result.failed.map((failure) => failure.characterId)).toEqual(['172153138']);
    expect(folder.root.find(['characters', '172153137']).files.has('character.json')).toBe(true);
    expect(folder.root.find(['characters']).directories.has('172153138')).toBe(false);
    expect(parseBackupFolderMarker(JSON.parse(text(folder.root.files.get('beyond-full-art.json'))))
        ?.schemaVersion).toBe(1);
    expect(await getStoredCharacterArtBlob('blob-art', indexedDb)).not.toBeNull();
  });

  it('does not commit a character when the written file does not match', async () => {
    const indexedDb = new IDBFactory();
    const storage = createFakeStorageArea();
    const folder = preparedFolder();
    folder.book.corruptPaths.add('characters/172153137/full-art.png');
    await putStoredCharacterArtBlob('blob-art', new Blob([Uint8Array.from([9, 8])]), indexedDb);
    storage.values[getCharacterArtMetadataKey('172153137')] = artMetadata('172153137', 'blob-art');

    const result = await copyBrowserLibraryIntoFolder(
        folder.root.asHandle(),
        () => '2026-10-23T12:00:00.000Z',
        {factory: indexedDb, storageArea: storage as never},
    );

    expect(result.copiedCharacterIds).toEqual([]);
    expect(result.failed[0]?.message).toContain('did not match');
    expect(folder.root.find(['characters', '172153137']).files.has('character.json')).toBe(false);
    expect(parseBackupFolderMarker(JSON.parse(text(folder.root.files.get('beyond-full-art.json'))))
        ?.schemaVersion).toBe(1);
    expect(await getStoredCharacterArtBlob('blob-art', indexedDb)).not.toBeNull();
  });

  it('removes the browser copy only after the folder matches', async () => {
    const indexedDb = new IDBFactory();
    const storage = createFakeStorageArea();
    const folder = preparedFolder();
    const artBytes = Uint8Array.from([9, 8, 7, 6]);
    const photoBytes = Uint8Array.from([1, 2, 3, 4]);
    await putStoredCharacterArtBlob('blob-art', new Blob([artBytes], {type: 'image/png'}), indexedDb);
    await putStoredCharacterArtBlob(
        'bfa.journal.image.photo-1',
        new Blob([photoBytes], {type: 'image/png'}),
        indexedDb,
    );
    storage.values[getCharacterArtMetadataKey('172153137')] = artMetadata('172153137', 'blob-art');
    storage.values[getCharacterJournalEntriesKey('172153137')] = [sessionNote()];
    storage.values['bfa.preferences.characterJournalEnabled'] = true;
    await copyBrowserLibraryIntoFolder(
        folder.root.asHandle(),
        () => '2026-10-23T12:00:00.000Z',
        {factory: indexedDb, storageArea: storage as never},
    );

    const result = await adoptFolderLibrary(folder.root.asHandle(), {
      factory: indexedDb,
      storageArea: storage as never,
    });

    expect(result).toEqual({characters: 1, kind: 'removed'});
    expect(storage.values[LIBRARY_MODE_KEY]).toBe('folder');
    expect(storage.values[getCharacterArtMetadataKey('172153137')]).toBeUndefined();
    expect(storage.values[getCharacterJournalEntriesKey('172153137')]).toBeUndefined();
    expect(storage.values['bfa.preferences.characterJournalEnabled']).toBe(true);
    expect(await getStoredCharacterArtBlob('blob-art', indexedDb)).toBeNull();
    expect(await getStoredCharacterArtBlob('bfa.journal.image.photo-1', indexedDb)).toBeNull();
    expect([...(await readFolderArtBytes(folder.root.asHandle(), '172153137') ?? new Uint8Array())])
        .toEqual([9, 8, 7, 6]);
  });

  it('does not remove the browser copy when a note no longer matches', async () => {
    const indexedDb = new IDBFactory();
    const storage = createFakeStorageArea();
    const folder = preparedFolder();
    await putStoredCharacterArtBlob('blob-art', new Blob([Uint8Array.from([9, 8, 7, 6])]), indexedDb);
    storage.values[getCharacterArtMetadataKey('172153137')] = artMetadata('172153137', 'blob-art');
    const note: JournalNote = {...sessionNote(), featuredImageId: null, images: []};
    storage.values[getCharacterJournalEntriesKey('172153137')] = [note];
    await copyBrowserLibraryIntoFolder(
        folder.root.asHandle(),
        () => '2026-10-23T12:00:00.000Z',
        {factory: indexedDb, storageArea: storage as never},
    );
    const edited: JournalNote = {
      ...note,
      body: 'Edited after the copy.',
      updatedAt: '2026-10-23T13:00:00.000Z',
    };
    storage.values[getCharacterJournalEntriesKey('172153137')] = [edited];

    const result = await adoptFolderLibrary(folder.root.asHandle(), {
      factory: indexedDb,
      storageArea: storage as never,
    });

    expect(result.kind).toBe('mismatch');
    expect(storage.values[LIBRARY_MODE_KEY]).toBeUndefined();
    expect(storage.values[getCharacterJournalEntriesKey('172153137')]).toEqual([edited]);
    expect(await getStoredCharacterArtBlob('blob-art', indexedDb)).not.toBeNull();
  });

  it('saves an empty browser into a prepared folder', async () => {
    const storage = createFakeStorageArea();
    const folder = preparedFolder();

    const result = await adoptFolderLibrary(folder.root.asHandle(), {
      storageArea: storage as never,
    });

    expect(result).toEqual({characters: 0, kind: 'saving-in-folder'});
    expect(storage.values[LIBRARY_MODE_KEY]).toBe('folder');
    expect(parseBackupFolderMarker(JSON.parse(text(folder.root.files.get('beyond-full-art.json'))))
        ?.schemaVersion).toBe(2);
  });

  it('reads art and notes back from the folder without browser storage', async () => {
    const folder = preparedFolder();
    const metadata = artMetadata('172153137', 'blob-art');
    await saveFolderFullArt(
        folder.root.asHandle(),
        metadata,
        Uint8Array.from([4, 5, 6]),
        '2026-10-23T12:00:00.000Z',
    );
    await writeFolderNotes(
        folder.root.asHandle(),
        '172153137',
        [{...sessionNote(), featuredImageId: null, images: []}],
        '2026-10-23T12:00:00.000Z',
    );

    expect([...(await readFolderArtBytes(folder.root.asHandle(), '172153137') ?? new Uint8Array())])
        .toEqual([4, 5, 6]);
    const notes = await readFolderNotes(folder.root.asHandle(), '172153137');
    expect(notes.map((note) => note.body)).toEqual(['Met Voss.']);
  });

  it('says the sheet still uses the browser copy', () => {
    expect(copyResultMessage('Beyond-Full-Art', {
      copiedCharacterIds: ['172153137'],
      failed: [],
      notes: 2,
      photos: 1,
      skippedCharacterIds: [],
    })).toContain('They are still in this browser, so the sheet keeps using them.');
  });
});

interface MemoryBook {
  corruptPaths: Set<string>;
  writes: string[];
}

class MemoryDirectory {
  readonly kind = 'directory' as const;
  readonly directories = new Map<string, MemoryDirectory>();
  readonly files = new Map<string, Uint8Array<ArrayBuffer>>();

  constructor(
      readonly name: string,
      readonly path: string,
      readonly book: MemoryBook,
  ) {}

  asHandle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle;
  }

  find(names: readonly string[]): MemoryDirectory {
    let current: MemoryDirectory = this;
    for (const name of names) {
      const next = current.directories.get(name);
      if (next === undefined) {
        throw new Error(`Missing directory ${name}`);
      }
      current = next;
    }
    return current;
  }

  async *entries(): AsyncGenerator<[string, FileSystemHandle]> {
    for (const [name, directory] of this.directories) {
      yield [name, directory.asHandle()];
    }
    for (const name of this.files.keys()) {
      yield [name, {kind: 'file'} as FileSystemHandle];
    }
  }

  async getDirectoryHandle(
      name: string,
      options?: {create?: boolean},
  ): Promise<FileSystemDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing !== undefined) {
      return existing.asHandle();
    }
    if (options?.create !== true) {
      throw new DOMException('Missing directory', 'NotFoundError');
    }
    const created = new MemoryDirectory(name, childPath(this.path, name), this.book);
    this.directories.set(name, created);
    return created.asHandle();
  }

  async getFileHandle(
      name: string,
      options?: {create?: boolean},
  ): Promise<FileSystemFileHandle> {
    if (!this.files.has(name)) {
      if (options?.create !== true) {
        throw new DOMException('Missing file', 'NotFoundError');
      }
      this.files.set(name, new Uint8Array());
    }
    const directory = this;
    const filePath = childPath(this.path, name);
    return {
      async getFile() {
        const stored = directory.files.get(name) ?? new Uint8Array();
        const bytes = directory.book.corruptPaths.has(filePath)
          ? concatBytes(stored, Uint8Array.from([255]))
          : stored;
        return new File([bytes], name);
      },
      async createWritable() {
        let next: Uint8Array<ArrayBuffer> = new Uint8Array();
        return {
          async close() {
            directory.files.set(name, next);
            directory.book.writes.push(filePath);
          },
          async write(data: ArrayBuffer | string | Uint8Array) {
            next = toBytes(data);
          },
        } as unknown as FileSystemWritableFileStream;
      },
    } as unknown as FileSystemFileHandle;
  }
}

function preparedFolder(): {book: MemoryBook; root: MemoryDirectory; writes: string[]} {
  const book: MemoryBook = {corruptPaths: new Set(), writes: []};
  const root = new MemoryDirectory('Beyond-Full-Art', '', book);
  root.files.set('beyond-full-art.json', utf8(`${JSON.stringify({
    createdAt: '2026-10-20T00:00:00.000Z',
    format: 'beyond-full-art-folder',
    schemaVersion: 1,
  }, null, 2)}\n`));
  root.directories.set('characters', new MemoryDirectory('characters', 'characters', book));
  return {book, root, writes: book.writes};
}

function artMetadata(characterId: string, blobKey: string) {
  return {
    blobKey,
    byteSize: 4,
    characterId,
    createdAt: '2026-10-23T00:00:00.000Z',
    fileName: 'portrait.png',
    height: 32,
    mimeType: 'image/png' as const,
    schemaVersion: 1 as const,
    updatedAt: '2026-10-23T00:00:00.000Z',
    width: 32,
  };
}

function sessionNote(): JournalNote {
  return {
    body: 'Met Voss.',
    characterId: '172153137',
    createdAt: '2026-10-23T00:00:00.000Z',
    featuredImageId: null,
    id: 'note-1',
    images: [{
      altText: 'Camp',
      blobKey: 'bfa.journal.image.photo-1',
      byteSize: 4,
      fileName: 'camp.png',
      height: null,
      id: 'photo-1',
      mimeType: 'image/png',
      width: null,
    }],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title: 'Session',
    type: 'session',
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

function createFakeStorageArea() {
  const values: Record<string, unknown> = {};
  return {
    values,
    get(key: string | null, callback: (value: Record<string, unknown>) => void) {
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
  };
}

function childPath(parent: string, name: string): string {
  return parent === '' ? name : `${parent}/${name}`;
}

function text(bytes: Uint8Array | undefined): string {
  return new TextDecoder().decode(bytes ?? new Uint8Array());
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(value);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy;
}

function toBytes(data: ArrayBuffer | string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof data === 'string') {
    return utf8(data);
  }
  const copy = new Uint8Array(data.byteLength);
  copy.set(data instanceof Uint8Array ? data : new Uint8Array(data));
  return copy;
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array<ArrayBuffer> {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left);
  combined.set(right, left.length);
  return combined;
}

async function sha256Hex(bytes: Uint8Array | undefined): Promise<string> {
  const view = bytes ?? new Uint8Array();
  const copy = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
