// @vitest-environment node

import {IDBFactory} from 'fake-indexeddb';
import {describe, expect, it} from 'vitest';

import {
  classifyBackupFolderEntries,
  connectBackupFolder,
  forgetBackupFolder,
  parseBackupFolderMarker,
  readBackupFolderConnection,
  readDirectoryPermission,
} from '../../src/platform/chrome/backup-folder';
import {
  CHARACTER_ART_DATABASE_NAME,
  getStoredCharacterArtBlob,
  putStoredCharacterArtBlob,
} from '../../src/platform/chrome/indexed-db';

describe('backup folder selection', () => {
  it('treats a blank folder as empty and ignores Finder metadata', () => {
    expect(classifyBackupFolderEntries([])).toBe('empty');
    expect(classifyBackupFolderEntries(['.DS_Store'])).toBe('empty');
  });

  it('recognizes a folder this extension already prepared', () => {
    expect(classifyBackupFolderEntries([
      'beyond-full-art.json',
      'characters',
    ])).toBe('owned');
    expect(classifyBackupFolderEntries([
      'beyond-full-art.json',
      'notes.txt',
    ])).toBe('occupied');
  });

  it('accepts version 1 and version 2 markers', () => {
    expect(parseBackupFolderMarker({
      createdAt: '2026-10-23T00:00:00.000Z',
      format: 'beyond-full-art-folder',
      schemaVersion: 1,
    })?.createdAt).toBe('2026-10-23T00:00:00.000Z');
    expect(parseBackupFolderMarker({
      createdAt: '2026-10-23T00:00:00.000Z',
      format: 'beyond-full-art-folder',
      schemaVersion: 2,
    })?.schemaVersion).toBe(2);
    expect(parseBackupFolderMarker({
      createdAt: '2026-10-23T00:00:00.000Z',
      format: 'beyond-full-art-folder',
      schemaVersion: 3,
    })).toBeNull();
  });

  it('prepares an empty folder without copying browser art', async () => {
    const indexedDb = new IDBFactory();
    const folder = memoryDirectory({entries: ['.DS_Store']});
    const blob = new Blob(['portrait'], {type: 'image/png'});
    await putStoredCharacterArtBlob('blob-key', blob, indexedDb);

    const result = await connectBackupFolder(
        folder.directory,
        () => '2026-10-23T00:00:00.000Z',
        indexedDb,
    );

    expect(result).toEqual({folderName: 'Campaign art', kind: 'initialized'});
    expect(folder.directories).toEqual(['characters']);
    expect(parseBackupFolderMarker(JSON.parse(folder.files.get('beyond-full-art.json') ?? '')))
        .toEqual({
          createdAt: '2026-10-23T00:00:00.000Z',
          format: 'beyond-full-art-folder',
          schemaVersion: 1,
        });
    expect(await getStoredCharacterArtBlob('blob-key', indexedDb)).not.toBeNull();
    expect(await readBackupFolderConnection(indexedDb)).toMatchObject({
      folderName: 'Campaign art',
      permission: 'unknown',
    });
  });

  it('refuses a folder that already has other files', async () => {
    const indexedDb = new IDBFactory();
    const folder = memoryDirectory({entries: ['photo.png']});

    await expect(connectBackupFolder(folder.directory, () => '2026-10-23T00:00:00.000Z', indexedDb))
        .resolves.toEqual({kind: 'occupied'});
    expect(folder.files.size).toBe(0);
    expect(await readBackupFolderConnection(indexedDb)).toBeNull();
  });

  it('reconnects a prepared folder without rewriting its marker', async () => {
    const indexedDb = new IDBFactory();
    const marker = `${JSON.stringify({
      createdAt: '2026-10-20T00:00:00.000Z',
      format: 'beyond-full-art-folder',
      schemaVersion: 1,
    })}\n`;
    const folder = memoryDirectory({
      entries: ['beyond-full-art.json', 'characters'],
      files: {'beyond-full-art.json': marker},
    });

    await expect(connectBackupFolder(
        folder.directory,
        () => '2026-10-23T00:00:00.000Z',
        indexedDb,
    )).resolves.toEqual({folderName: 'Campaign art', kind: 'reconnected'});
    expect(folder.files.get('beyond-full-art.json')).toBe(marker);
    expect((await readBackupFolderConnection(indexedDb))?.connectedAt)
        .toBe('2026-10-23T00:00:00.000Z');
  });

  it('forgets the browser connection and leaves the folder files in place', async () => {
    const indexedDb = new IDBFactory();
    const folder = memoryDirectory({entries: []});
    await connectBackupFolder(folder.directory, () => '2026-10-23T00:00:00.000Z', indexedDb);

    await forgetBackupFolder(indexedDb);

    expect(await readBackupFolderConnection(indexedDb)).toBeNull();
    expect(folder.files.has('beyond-full-art.json')).toBe(true);
  });

  it('keeps stored art when the backup folder store is added', async () => {
    const indexedDb = new IDBFactory();
    await seedVersion1Blob(indexedDb);

    expect(await getStoredCharacterArtBlob('blob-key', indexedDb)).not.toBeNull();
    expect(await readBackupFolderConnection(indexedDb)).toBeNull();
  });

  it('reports directory permission from the handle', async () => {
    await expect(readDirectoryPermission({
      queryPermission: async () => 'granted',
    })).resolves.toBe('granted');
    await expect(readDirectoryPermission({
      queryPermission: async () => {
        throw new Error('unavailable');
      },
    })).resolves.toBe('unknown');
  });
});

function memoryDirectory(options: {
  entries: string[];
  files?: Record<string, string>;
}): {directory: FileSystemDirectoryHandle; directories: string[]; files: Map<string, string>} {
  const files = new Map(Object.entries(options.files ?? {}));
  const directories: string[] = [];
  // Methods stay on the prototype so IndexedDB can clone the handle in tests.
  class MemoryDirectory {
    readonly name = 'Campaign art';

    async *entries(): AsyncGenerator<[string, FileSystemHandle]> {
      for (const name of options.entries) {
        yield [name, {kind: 'file'} as FileSystemHandle];
      }
    }

    async getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle> {
      directories.push(name);
      return {name} as FileSystemDirectoryHandle;
    }

    async getFileHandle(
        name: string,
        fileOptions?: {create?: boolean},
    ): Promise<FileSystemFileHandle> {
      if (!files.has(name)) {
        if (fileOptions?.create !== true) {
          throw new DOMException('Missing file', 'NotFoundError');
        }
        files.set(name, '');
      }
      return {
        async getFile() {
          return new File([files.get(name) ?? ''], name);
        },
        async createWritable() {
          let next = '';
          return {
            async close() {
              files.set(name, next);
            },
            async write(data: string) {
              next = data;
            },
          } as unknown as FileSystemWritableFileStream;
        },
      } as unknown as FileSystemFileHandle;
    }
  }

  return {
    directories,
    directory: new MemoryDirectory() as unknown as FileSystemDirectoryHandle,
    files,
  };
}

async function seedVersion1Blob(factory: IDBFactory): Promise<void> {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(CHARACTER_ART_DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('characterArtBlobs', {keyPath: 'blobKey'});
    };
    request.onerror = () => {
      reject(request.error ?? new Error('Failed to open version 1'));
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('characterArtBlobs', 'readwrite');
    transaction.objectStore('characterArtBlobs').put({
      blob: new Blob(['kept']),
      blobKey: 'blob-key',
    });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}
