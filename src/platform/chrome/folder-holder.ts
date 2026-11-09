// Chrome grants a picked folder to the document that called showDirectoryPicker.
// The toolbar popup is a new document and does not get a click when it opens,
// so requestPermission there stays `prompt` and shows no question. A handle
// cloned into the service worker still cannot open characters/. The setup
// window keeps the granted directory and performs the reads and writes.

export const FOLDER_HOLDER_MESSAGE = 'bfa.folder.holder';

const CHARACTERS_DIRECTORY = 'characters';
const MAX_PATH_LENGTH = 12;

export type FolderHolderKind = 'directory' | 'file';

export type FolderHolderCall =
  | {op: 'ping'}
  | {op: 'release'}
  | {create: boolean; name: string; op: 'getDirectoryHandle'; path: string[]}
  | {create: boolean; name: string; op: 'getFileHandle'; path: string[]}
  | {name: string; op: 'removeEntry'; path: string[]; recursive: boolean}
  | {op: 'entries'; path: string[]}
  | {op: 'getFile'; path: string[]}
  | {bytes: Uint8Array; op: 'writeFile'; path: string[]}
  | {kind: FolderHolderKind; op: 'isSameEntry'; other: object; path: string[]};

export type FolderHolderResult =
  | {
    bytes?: Uint8Array;
    entries?: {kind: FolderHolderKind; name: string}[];
    name?: string;
    ok: true;
    open?: boolean;
    same?: boolean;
  }
  | {errorName: string; message: string; ok: false};

export interface FolderHolderTransport {
  call(call: FolderHolderCall): Promise<FolderHolderResult>;
}

let heldDirectory: FileSystemDirectoryHandle | null = null;
let listening = false;

const remotePaths = new WeakMap<object, {kind: FolderHolderKind; path: string[]}>();

export function installFolderHolder(directory: FileSystemDirectoryHandle): void {
  heldDirectory = directory;
  const runtime = globalThis.chrome?.runtime;
  if (listening || runtime?.onMessage?.addListener === undefined) {
    return;
  }
  listening = true;
  runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isExtensionSender(sender)) {
      return;
    }
    const call = asHolderCall(message);
    if (call === null) {
      return;
    }
    if (call.op === 'release') {
      heldDirectory = null;
      sendResponse({ok: true, open: false});
      return true;
    }
    const directory = heldDirectory;
    if (directory === null) {
      return;
    }
    void runFolderHolderOp(directory, call).then((result) => {
      sendResponse(result);
    });
    return true;
  });
}

export async function releaseFolderHolder(): Promise<void> {
  await sendRaw({op: 'release'});
}

export async function folderHolderIsOpen(): Promise<boolean> {
  const response = await sendRaw({op: 'ping'});
  return isHolderResult(response) && response.ok && response.open === true;
}

export async function openHeldFolderDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const response = await sendRaw({op: 'ping'});
  if (!isHolderResult(response) || !response.ok || response.open !== true) {
    return null;
  }
  const name = typeof response.name === 'string' && response.name !== ''
    ? response.name
    : 'Backup folder';
  return createRemoteFolderDirectory(name, chromeTransport);
}

export function createRemoteFolderDirectory(
    name: string,
    transport: FolderHolderTransport,
): FileSystemDirectoryHandle {
  return remoteDirectory(name, [], transport);
}

export async function runFolderHolderOp(
    root: FileSystemDirectoryHandle,
    call: FolderHolderCall,
): Promise<FolderHolderResult> {
  try {
    if (call.op === 'ping') {
      try {
        await root.getDirectoryHandle(CHARACTERS_DIRECTORY);
        return {name: root.name, ok: true, open: true};
      } catch {
        return {name: root.name, ok: true, open: false};
      }
    }
    if (call.op === 'release') {
      return {ok: true, open: false};
    }
    if (call.op === 'entries') {
      const directory = await walkDirectory(root, call.path);
      const entries: {kind: FolderHolderKind; name: string}[] = [];
      for await (const [name, handle] of directoryEntries(directory)) {
        if (handle.kind === 'directory' || handle.kind === 'file') {
          entries.push({kind: handle.kind, name});
        }
      }
      return {entries, ok: true};
    }
    if (call.op === 'getDirectoryHandle') {
      assertName(call.name);
      const parent = await walkDirectory(root, call.path);
      await parent.getDirectoryHandle(call.name, {create: call.create});
      return {ok: true};
    }
    if (call.op === 'getFileHandle') {
      assertName(call.name);
      const parent = await walkDirectory(root, call.path);
      await parent.getFileHandle(call.name, {create: call.create});
      return {ok: true};
    }
    if (call.op === 'removeEntry') {
      assertName(call.name);
      const parent = await walkDirectory(root, call.path);
      await parent.removeEntry(call.name, {recursive: call.recursive});
      return {ok: true};
    }
    if (call.op === 'getFile') {
      const handle = await walkFile(root, call.path, false);
      return {bytes: await fileBytes(await handle.getFile()), ok: true};
    }
    if (call.op === 'writeFile') {
      const handle = await walkFile(root, call.path, true);
      const writable = await handle.createWritable();
      const bytes = new Uint8Array(call.bytes.byteLength);
      bytes.set(call.bytes);
      await writable.write(bytes);
      await writable.close();
      return {ok: true};
    }
    const current = call.kind === 'file'
      ? await walkFile(root, call.path, false)
      : await walkDirectory(root, call.path);
    const other = call.other as FileSystemHandle;
    if (typeof other.isSameEntry !== 'function') {
      return {ok: true, same: false};
    }
    return {ok: true, same: await current.isSameEntry(other)};
  } catch (error) {
    return failure(error);
  }
}

const chromeTransport: FolderHolderTransport = {
  async call(call) {
    const response = await sendRaw(call);
    if (!isHolderResult(response)) {
      return {
        errorName: 'NotAllowedError',
        message: 'The folder setup window is not open.',
        ok: false,
      };
    }
    return response;
  },
};

async function sendRaw(call: FolderHolderCall): Promise<unknown> {
  const runtime = globalThis.chrome?.runtime;
  if (runtime?.sendMessage === undefined) {
    return null;
  }
  try {
    return await runtime.sendMessage({...call, type: FOLDER_HOLDER_MESSAGE});
  } catch {
    return null;
  }
}

function remoteDirectory(
    name: string,
    path: string[],
    transport: FolderHolderTransport,
): FileSystemDirectoryHandle {
  const handle = {
    kind: 'directory' as const,
    name,
    entries() {
      return listChildren(path, transport);
    },
    async getDirectoryHandle(entryName: string, options?: {create?: boolean}) {
      await must(transport, {
        create: options?.create === true,
        name: entryName,
        op: 'getDirectoryHandle',
        path,
      });
      return remoteDirectory(entryName, [...path, entryName], transport);
    },
    async getFileHandle(entryName: string, options?: {create?: boolean}) {
      await must(transport, {
        create: options?.create === true,
        name: entryName,
        op: 'getFileHandle',
        path,
      });
      return remoteFile(entryName, [...path, entryName], transport);
    },
    async isSameEntry(other: FileSystemHandle) {
      return sameEntry(path, 'directory', other, transport);
    },
    async queryPermission() {
      return 'granted' as PermissionState;
    },
    async removeEntry(entryName: string, options?: {recursive?: boolean}) {
      await must(transport, {
        name: entryName,
        op: 'removeEntry',
        path,
        recursive: options?.recursive === true,
      });
    },
    async requestPermission() {
      return 'granted' as PermissionState;
    },
  };
  handle.entries = handle.entries.bind(handle);
  remotePaths.set(handle, {kind: 'directory', path});
  return handle as unknown as FileSystemDirectoryHandle;
}

function remoteFile(
    name: string,
    path: string[],
    transport: FolderHolderTransport,
): FileSystemFileHandle {
  let closed = false;
  const chunks: Uint8Array[] = [];
  const handle = {
    kind: 'file' as const,
    name,
    async createWritable() {
      closed = false;
      chunks.length = 0;
      return {
        async close() {
          if (closed) {
            return;
          }
          closed = true;
          await must(transport, {bytes: concatBytes(chunks), op: 'writeFile', path});
        },
        async write(data: unknown) {
          if (closed) {
            throw new DOMException('The file is already closed.', 'InvalidStateError');
          }
          chunks.push(await toBytes(data));
        },
      };
    },
    async getFile() {
      const result = await must(transport, {op: 'getFile', path});
      const bytes = result.bytes instanceof Uint8Array ? result.bytes : null;
      if (bytes === null) {
        throw new DOMException('The file could not be read.', 'NotReadableError');
      }
      const copy = new Uint8Array(bytes.byteLength);
      copy.set(bytes);
      return fileFromBytes(copy, name);
    },
    async isSameEntry(other: FileSystemHandle) {
      return sameEntry(path, 'file', other, transport);
    },
    async queryPermission() {
      return 'granted' as PermissionState;
    },
    async requestPermission() {
      return 'granted' as PermissionState;
    },
  };
  remotePaths.set(handle, {kind: 'file', path});
  return handle as unknown as FileSystemFileHandle;
}

async function* listChildren(
    path: string[],
    transport: FolderHolderTransport,
): AsyncGenerator<[string, FileSystemHandle]> {
  const result = await must(transport, {op: 'entries', path});
  for (const entry of result.entries ?? []) {
    const childPath = [...path, entry.name];
    yield [
      entry.name,
      entry.kind === 'directory'
        ? remoteDirectory(entry.name, childPath, transport)
        : remoteFile(entry.name, childPath, transport),
    ];
  }
}

async function sameEntry(
    path: string[],
    kind: FolderHolderKind,
    other: FileSystemHandle,
    transport: FolderHolderTransport,
): Promise<boolean> {
  const known = remotePaths.get(other);
  if (known !== undefined) {
    return known.kind === kind && samePath(known.path, path);
  }
  const result = await must(transport, {kind, op: 'isSameEntry', other, path});
  return result.same === true;
}

async function must(
    transport: FolderHolderTransport,
    call: FolderHolderCall,
): Promise<Extract<FolderHolderResult, {ok: true}>> {
  const result = await transport.call(call);
  if (!result.ok) {
    throw new DOMException(result.message, result.errorName);
  }
  return result;
}

async function fileBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  if (typeof file.text === 'function') {
    // jsdom's File sometimes has neither method. Chrome has arrayBuffer, so
    // image bytes stay exact there. text() is only the test fallback.
    return new TextEncoder().encode(await file.text());
  }
  throw new DOMException('The file could not be read.', 'NotReadableError');
}

function fileFromBytes(bytes: Uint8Array, name: string): File {
  // A Uint8Array view of SharedArrayBuffer is not a BlobPart. Copy into a
  // fresh ArrayBuffer-backed view before File construction.
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  if (typeof File === 'function') {
    try {
      const file = new File([copy], name);
      if (typeof file.arrayBuffer === 'function' || typeof file.text === 'function') {
        return file;
      }
    } catch {
      // jsdom can refuse to construct a File. The readable stand-in is below.
    }
  }
  return {
    arrayBuffer: async () => copy.buffer,
    name,
    size: copy.byteLength,
    text: async () => new TextDecoder().decode(copy),
  } as unknown as File;
}

async function walkDirectory(
    root: FileSystemDirectoryHandle,
    path: readonly string[],
): Promise<FileSystemDirectoryHandle> {
  let current = root;
  for (const name of path) {
    assertName(name);
    current = await current.getDirectoryHandle(name);
  }
  return current;
}

async function walkFile(
    root: FileSystemDirectoryHandle,
    path: readonly string[],
    create: boolean,
): Promise<FileSystemFileHandle> {
  if (path.length === 0) {
    throw new DOMException('The file name is missing.', 'TypeError');
  }
  const parent = await walkDirectory(root, path.slice(0, -1));
  const name = path[path.length - 1] ?? '';
  assertName(name);
  return parent.getFileHandle(name, {create});
}

async function* directoryEntries(
    directory: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle]> {
  const entries = (directory as FileSystemDirectoryHandle & {
    entries(): AsyncIterable<[string, FileSystemHandle]>;
  }).entries();
  yield* entries;
}

function assertName(name: string): void {
  if (readName(name) === null) {
    throw new DOMException('That file name cannot be used.', 'TypeError');
  }
}

function failure(error: unknown): FolderHolderResult {
  if (error instanceof DOMException) {
    return {errorName: error.name, message: error.message, ok: false};
  }
  const message = error instanceof Error && error.message.trim() !== ''
    ? error.message
    : 'The folder could not be read.';
  return {errorName: 'Error', message, ok: false};
}

function asHolderCall(message: unknown): FolderHolderCall | null {
  if (typeof message !== 'object' || message === null) {
    return null;
  }
  const record = message as {op?: unknown; type?: unknown};
  if (record.type !== FOLDER_HOLDER_MESSAGE || typeof record.op !== 'string') {
    return null;
  }
  if (record.op === 'ping' || record.op === 'release') {
    return {op: record.op};
  }
  const path = readPath((message as {path?: unknown}).path);
  if (path === null) {
    return null;
  }
  if (record.op === 'entries') {
    return {op: 'entries', path};
  }
  if (record.op === 'getFile') {
    return {op: 'getFile', path};
  }
  if (record.op === 'getDirectoryHandle' || record.op === 'getFileHandle' || record.op === 'removeEntry') {
    const name = readName((message as {name?: unknown}).name);
    if (name === null) {
      return null;
    }
    if (record.op === 'removeEntry') {
      return {
        name,
        op: 'removeEntry',
        path,
        recursive: (message as {recursive?: unknown}).recursive === true,
      };
    }
    return {
      create: (message as {create?: unknown}).create === true,
      name,
      op: record.op,
      path,
    };
  }
  if (record.op === 'writeFile') {
    const bytes = (message as {bytes?: unknown}).bytes;
    const copy = bytes instanceof Uint8Array
      ? bytes
      : bytes instanceof ArrayBuffer
        ? new Uint8Array(bytes)
        : null;
    if (copy === null) {
      return null;
    }
    return {bytes: copy, op: 'writeFile', path};
  }
  if (record.op === 'isSameEntry') {
    const other = (message as {other?: unknown}).other;
    const kind = (message as {kind?: unknown}).kind;
    if (typeof other !== 'object' || other === null || (kind !== 'file' && kind !== 'directory')) {
      return null;
    }
    return {kind, op: 'isSameEntry', other, path};
  }
  return null;
}

function readPath(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_PATH_LENGTH) {
    return null;
  }
  const path: string[] = [];
  for (const part of value) {
    const name = readName(part);
    if (name === null) {
      return null;
    }
    path.push(name);
  }
  return path;
}

function readName(value: unknown): string | null {
  if (typeof value !== 'string' || value === '' || value === '.' || value === '..') {
    return null;
  }
  if (value.includes('/') || value.includes('\\') || value.includes('\0')) {
    return null;
  }
  return value;
}

function isHolderResult(value: unknown): value is FolderHolderResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as {errorName?: unknown; message?: unknown; ok?: unknown};
  if (record.ok === true) {
    return true;
  }
  return record.ok === false
    && typeof record.errorName === 'string'
    && typeof record.message === 'string';
}

function isExtensionSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  if (sender === undefined || sender.tab !== undefined) {
    return false;
  }
  const extensionId = globalThis.chrome?.runtime?.id;
  if (extensionId === undefined || extensionId === '' || sender.id !== extensionId) {
    return false;
  }
  const url = sender.url ?? '';
  return url === '' || url.startsWith(`chrome-extension://${extensionId}/`);
}

async function toBytes(data: unknown): Promise<Uint8Array> {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    const copy = new Uint8Array(data.byteLength);
    copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return copy;
  }
  if (typeof data === 'object' && data !== null && 'data' in data) {
    return toBytes((data as {data: unknown}).data);
  }
  throw new DOMException('The folder write could not be read.', 'TypeError');
}

function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}
