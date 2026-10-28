import {
  deleteStoredBackupFolder,
  getStoredBackupFolder,
  setStoredBackupFolder,
} from './indexed-db';

export const BACKUP_FOLDER_MARKER_NAME = 'beyond-full-art.json';
export const BACKUP_FOLDER_CHARACTERS_DIRECTORY = 'characters';
export const BACKUP_FOLDER_FORMAT = 'beyond-full-art-folder';
export const BACKUP_FOLDER_PICKER_ID = 'beyond-full-art-backup';

const IGNORED_FOLDER_ENTRY_NAMES = new Set([
  '.DS_Store',
  'Thumbs.db',
  'desktop.ini',
]);

export interface BackupFolderMarker {
  createdAt: string;
  format: typeof BACKUP_FOLDER_FORMAT;
  schemaVersion: 1 | 2;
}

export type BackupFolderEntryClassification = 'empty' | 'occupied' | 'owned';

export type BackupFolderPermission = 'denied' | 'granted' | 'prompt' | 'unknown';

export interface BackupFolderConnection {
  connectedAt: string;
  folderName: string;
  permission: BackupFolderPermission;
}

export type ConnectBackupFolderResult =
  | {folderName: string; kind: 'initialized'}
  | {folderName: string; kind: 'reconnected'}
  | {kind: 'failed'}
  | {kind: 'occupied'}
  | {kind: 'unreadable'};

export function classifyBackupFolderEntries(
    names: readonly string[],
): BackupFolderEntryClassification {
  const meaningful = names.filter((name) => !IGNORED_FOLDER_ENTRY_NAMES.has(name));
  if (meaningful.length === 0) {
    return 'empty';
  }

  const hasMarker = meaningful.includes(BACKUP_FOLDER_MARKER_NAME);
  const onlyExtensionEntries = meaningful.every((name) =>
    name === BACKUP_FOLDER_MARKER_NAME || name === BACKUP_FOLDER_CHARACTERS_DIRECTORY);
  return hasMarker && onlyExtensionEntries ? 'owned' : 'occupied';
}

export function parseBackupFolderMarker(value: unknown): BackupFolderMarker | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const record = value as {createdAt?: unknown; format?: unknown; schemaVersion?: unknown};
  if (record.format !== BACKUP_FOLDER_FORMAT) {
    return null;
  }
  if (record.schemaVersion !== 1 && record.schemaVersion !== 2) {
    return null;
  }
  if (typeof record.createdAt !== 'string' || record.createdAt.trim() === '') {
    return null;
  }

  return {
    createdAt: record.createdAt,
    format: BACKUP_FOLDER_FORMAT,
    schemaVersion: record.schemaVersion,
  };
}

export function backupFolderLabel(handle: {name?: string} | null): string {
  const name = typeof handle?.name === 'string' ? handle.name.trim() : '';
  return name === '' ? 'Backup folder' : name;
}

export async function readDirectoryPermission(
    handle: object,
): Promise<BackupFolderPermission> {
  return readPermission(handle, 'queryPermission');
}

export async function ensureDirectoryPermission(
    handle: object,
): Promise<BackupFolderPermission> {
  const current = await readDirectoryPermission(handle);
  if (current !== 'prompt') {
    return current;
  }

  // A handle restored from IndexedDB stays `prompt` until this runs inside
  // the Choose folder click. The directory picker is a later step.
  return readPermission(handle, 'requestPermission');
}

async function readPermission(
    handle: object,
    methodName: 'queryPermission' | 'requestPermission',
): Promise<BackupFolderPermission> {
  // The DOM lib used here does not declare these File System Access methods.
  const method = (handle as {
    queryPermission?: (descriptor: {mode: 'readwrite'}) => Promise<PermissionState>;
    requestPermission?: (descriptor: {mode: 'readwrite'}) => Promise<PermissionState>;
  })[methodName];
  if (typeof method !== 'function') {
    return methodName === 'queryPermission' ? 'unknown' : 'prompt';
  }

  try {
    const state = await method.call(handle, {mode: 'readwrite'});
    if (state === 'granted' || state === 'prompt' || state === 'denied') {
      return state;
    }
    return 'unknown';
  } catch {
    return methodName === 'queryPermission' ? 'unknown' : 'prompt';
  }
}

export async function readBackupFolderConnection(
    factory?: IDBFactory,
): Promise<BackupFolderConnection | null> {
  const stored = await getStoredBackupFolder(factory);
  if (stored === null) {
    return null;
  }

  return {
    connectedAt: stored.connectedAt,
    folderName: backupFolderLabel(stored.handle),
    permission: await readDirectoryPermission(stored.handle),
  };
}

export async function forgetBackupFolder(factory?: IDBFactory): Promise<void> {
  await deleteStoredBackupFolder(factory);
}

export async function markBackupFolderCopied(
    directory: FileSystemDirectoryHandle,
): Promise<boolean> {
  const marker = await readMarker(directory);
  if (marker === null) {
    return false;
  }
  if (marker.schemaVersion === 2) {
    return true;
  }
  try {
    await writeMarker(directory, {...marker, schemaVersion: 2});
    return true;
  } catch {
    return false;
  }
}

export async function connectBackupFolder(
    directory: FileSystemDirectoryHandle,
    now: () => string = () => new Date().toISOString(),
    factory?: IDBFactory,
): Promise<ConnectBackupFolderResult> {
  let names: string[];
  try {
    names = await listEntryNames(directory);
  } catch {
    return {kind: 'failed'};
  }

  const classification = classifyBackupFolderEntries(names);
  if (classification === 'occupied') {
    return {kind: 'occupied'};
  }

  if (classification === 'owned') {
    const marker = await readMarker(directory);
    if (marker === null) {
      return {kind: 'unreadable'};
    }
  } else {
    const marker: BackupFolderMarker = {
      createdAt: now(),
      format: BACKUP_FOLDER_FORMAT,
      schemaVersion: 1,
    };
    try {
      await writeMarker(directory, marker);
    } catch {
      return {kind: 'failed'};
    }
  }

  try {
    await directory.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY, {create: true});
    await setStoredBackupFolder(directory, now(), factory);
  } catch {
    return {kind: 'failed'};
  }

  return {
    folderName: backupFolderLabel(directory),
    kind: classification === 'owned' ? 'reconnected' : 'initialized',
  };
}

async function listEntryNames(directory: FileSystemDirectoryHandle): Promise<string[]> {
  // entries() is in the async-iterable DOM lib, which this tsconfig does not load.
  const names: string[] = [];
  const entries = (directory as FileSystemDirectoryHandle & {
    entries(): AsyncIterable<[string, unknown]>;
  }).entries();
  for await (const [name] of entries) {
    names.push(name);
  }
  return names;
}

async function readMarker(
    directory: FileSystemDirectoryHandle,
): Promise<BackupFolderMarker | null> {
  try {
    const handle = await directory.getFileHandle(BACKUP_FOLDER_MARKER_NAME);
    const text = await (await handle.getFile()).text();
    return parseBackupFolderMarker(JSON.parse(text) as unknown);
  } catch {
    return null;
  }
}

async function writeMarker(
    directory: FileSystemDirectoryHandle,
    marker: BackupFolderMarker,
): Promise<void> {
  const handle = await directory.getFileHandle(BACKUP_FOLDER_MARKER_NAME, {create: true});
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(marker, null, 2)}\n`);
  await writable.close();
}
