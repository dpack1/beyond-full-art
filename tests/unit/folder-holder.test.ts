import {describe, expect, it} from 'vitest';
import {
  createRemoteFolderDirectory,
  runFolderHolderOp,
} from '../../src/platform/chrome/folder-holder';

describe('folder holder', () => {
  it('reads and writes through the setup window directory', async () => {
    const root = memoryDirectory('Campaign');
    const characters = await root.getDirectoryHandle('characters', {create: true});
    const character = await characters.getDirectoryHandle('172153137', {create: true});
    const commit = await character.getFileHandle('character.json', {create: true});
    const writer = await commit.createWritable();
    await writer.write(new TextEncoder().encode('{"ok":true}'));
    await writer.close();

    const remote = createRemoteFolderDirectory('Campaign', {
      call: (op) => runFolderHolderOp(root, op),
    });
    const opened = await remote.getDirectoryHandle('characters');
    const remoteCharacter = await opened.getDirectoryHandle('172153137');
    const listed = (opened as FileSystemDirectoryHandle & {
      entries(): AsyncIterable<[string, FileSystemHandle]>;
    }).entries();
    const names: [string, string][] = [];
    for await (const [name, handle] of listed) {
      names.push([name, handle.kind]);
    }
    expect(names).toEqual([['172153137', 'directory']]);

    const remoteCommit = await remoteCharacter.getFileHandle('character.json');
    expect(await (await remoteCommit.getFile()).text()).toBe('{"ok":true}');

    const extra = await remoteCharacter.getFileHandle('note.txt', {create: true});
    const extraWriter = await extra.createWritable();
    await extraWriter.write(new TextEncoder().encode('hello'));
    await extraWriter.close();
    expect(await (await (await character.getFileHandle('note.txt')).getFile()).text())
        .toBe('hello');
    await expect(remoteCharacter.getFileHandle('missing')).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });

  it('rejects a path that leaves the folder', async () => {
    const root = memoryDirectory('Campaign');
    const result = await runFolderHolderOp(root, {
      create: false,
      name: '..',
      op: 'getDirectoryHandle',
      path: [],
    });
    expect(result).toMatchObject({errorName: 'TypeError', ok: false});
  });

  it('reports the folder open only when characters/ can be opened', async () => {
    const root = memoryDirectory('Campaign');
    expect(await runFolderHolderOp(root, {op: 'ping'})).toMatchObject({
      ok: true,
      open: false,
    });
    await root.getDirectoryHandle('characters', {create: true});
    expect(await runFolderHolderOp(root, {op: 'ping'})).toMatchObject({
      name: 'Campaign',
      ok: true,
      open: true,
    });
  });
});

function memoryDirectory(name: string): FileSystemDirectoryHandle {
  return new MemoryDirectory(name, new Map(), new Map()) as unknown as FileSystemDirectoryHandle;
}

class MemoryDirectory {
  readonly kind = 'directory' as const;

  constructor(
      readonly name: string,
      private readonly directories: Map<string, MemoryDirectory>,
      private readonly files: Map<string, MemoryFile>,
  ) {}

  async getDirectoryHandle(entryName: string, options?: {create?: boolean}): Promise<MemoryDirectory> {
    const existing = this.directories.get(entryName);
    if (existing !== undefined) {
      return existing;
    }
    if (this.files.has(entryName)) {
      throw new DOMException('A file is in the way.', 'TypeMismatchError');
    }
    if (options?.create !== true) {
      throw new DOMException('Missing directory.', 'NotFoundError');
    }
    const created = new MemoryDirectory(entryName, new Map(), new Map());
    this.directories.set(entryName, created);
    return created;
  }

  async getFileHandle(entryName: string, options?: {create?: boolean}): Promise<MemoryFile> {
    const existing = this.files.get(entryName);
    if (existing !== undefined) {
      return existing;
    }
    if (this.directories.has(entryName)) {
      throw new DOMException('A directory is in the way.', 'TypeMismatchError');
    }
    if (options?.create !== true) {
      throw new DOMException('Missing file.', 'NotFoundError');
    }
    const created = new MemoryFile(entryName);
    this.files.set(entryName, created);
    return created;
  }

  async removeEntry(entryName: string): Promise<void> {
    if (!this.files.delete(entryName) && !this.directories.delete(entryName)) {
      throw new DOMException('Missing entry.', 'NotFoundError');
    }
  }

  entries(): AsyncIterable<[string, MemoryDirectory | MemoryFile]> {
    const directories = [...this.directories.entries()];
    const files = [...this.files.entries()];
    return (async function* () {
      yield* directories;
      yield* files;
    })();
  }

  async isSameEntry(other: unknown): Promise<boolean> {
    return other === this;
  }
}

class MemoryFile {
  readonly kind = 'file' as const;
  private bytes = new Uint8Array();

  constructor(readonly name: string) {}

  async getFile(): Promise<File> {
    const copy = new Uint8Array(this.bytes.byteLength);
    copy.set(this.bytes);
    return {
      arrayBuffer: async () => copy.slice().buffer,
      text: async () => new TextDecoder().decode(copy),
    } as unknown as File;
  }

  async createWritable(): Promise<{close(): Promise<void>; write(data: Uint8Array): Promise<void>}> {
    const chunks: Uint8Array[] = [];
    return {
      close: async () => {
        const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
        const out = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          out.set(chunk, offset);
          offset += chunk.byteLength;
        }
        this.bytes = out;
      },
      write: async (data: Uint8Array) => {
        const copy = new Uint8Array(data.byteLength);
        copy.set(data);
        chunks.push(copy);
      },
    };
  }
}

