import type {
  CharacterArtMetadata,
  CharacterPortraitCropMetadata,
  SupportedCharacterArtMimeType,
} from '../../features/character-art/art-types';
import {
  isCharacterArtMetadata,
  isCharacterPortraitCropMetadata,
} from '../../features/character-art/art-types';
import {
  isJournalImage,
  isJournalNote,
  type JournalNote,
} from '../../features/character-journal/character-journal-types';
import {
  BACKUP_FOLDER_CHARACTERS_DIRECTORY,
  backupFolderLabel,
  parseBackupFolderMarker,
  readDirectoryPermission,
  type BackupFolderPermission,
} from './backup-folder';
import {openHeldFolderDirectory} from './folder-holder';
import {ensureFolderSession, readActiveFolderDirectory, rememberActiveFolderDirectory} from './folder-session';
import {getStoredBackupFolder} from './indexed-db';
import {FOLDER_LIBRARY_BLOCKED_MESSAGE, readLibraryMode} from './library-mode';

const COMMIT_FILE_NAME = 'character.json';

export interface FolderArtFile {
  fileName: string;
  metadata: CharacterArtMetadata;
  sha256: string;
}

export interface FolderCropFile {
  fileName: string;
  metadata: CharacterPortraitCropMetadata;
  sha256: string;
}

export interface FolderNamedFile {
  fileName: string;
  id: string;
  sha256: string;
}

export type FolderKeptKind = 'crop' | 'full-art';

export interface FolderKeptFile {
  fileName: string;
  kind: FolderKeptKind;
  sha256: string;
}

export type FolderTombstoneKind = 'crop' | 'full-art' | 'image' | 'note';

export interface FolderTombstoneFile extends FolderNamedFile {
  deletedAt: string;
  kind: FolderTombstoneKind;
}

export interface FolderCommit {
  characterId: string;
  copiedAt: string;
  crop: FolderCropFile | null;
  fullArt: FolderArtFile | null;
  images: FolderNamedFile[];
  kept: FolderKeptFile[];
  notes: FolderNamedFile[];
  schemaVersion: 1;
  tombstones: FolderTombstoneFile[];
}

export type LibraryTarget =
  | {directory: FileSystemDirectoryHandle; kind: 'ready'}
  | {folderName: string; kind: 'blocked'}
  | {kind: 'local'};

export async function resolveLibrary(): Promise<LibraryTarget> {
  if (await readLibraryMode() !== 'folder') {
    return {kind: 'local'};
  }
  try {
    await ensureFolderSession();
  } catch {
    // A missing hidden page does not by itself block a folder that is already open.
  }
  const active = readActiveFolderDirectory();
  if (active !== null) {
    const activePermission = await readDirectoryPermission(active);
    if (await libraryDirectoryIsOpen(active, activePermission)) {
      return {directory: active, kind: 'ready'};
    }
    rememberActiveFolderDirectory(null);
  }
  const stored = await getStoredBackupFolder();
  if (stored === null) {
    return heldLibraryOrBlocked('Backup folder');
  }
  const folderName = backupFolderLabel(stored.handle);
  const permission = await readDirectoryPermission(stored.handle);
  if (permission === 'denied') {
    return {folderName, kind: 'blocked'};
  }
  if (!await libraryDirectoryIsOpen(stored.handle, permission)) {
    return heldLibraryOrBlocked(folderName);
  }
  return {directory: stored.handle, kind: 'ready'};
}

async function heldLibraryOrBlocked(folderName: string): Promise<LibraryTarget> {
  // The setup window still has the directory the user allowed. Use it when
  // this worker's own handle cannot open characters/.
  const held = await openHeldFolderDirectory();
  if (held !== null) {
    return {directory: held, kind: 'ready'};
  }
  return {folderName, kind: 'blocked'};
}

export async function libraryDirectoryIsOpen(
    handle: Pick<FileSystemDirectoryHandle, 'getDirectoryHandle'>,
    permission: BackupFolderPermission,
): Promise<boolean> {
  // A service worker often still reports `prompt` after the extension page
  // was allowed. Opening characters/ is the check that this handle can be read.
  if (permission === 'denied') {
    return false;
  }
  try {
    await handle.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
    return true;
  } catch {
    return false;
  }
}

export function libraryBlockedError(): Error {
  return new Error(FOLDER_LIBRARY_BLOCKED_MESSAGE);
}

export async function readFolderMarkerSchema(
    directory: FileSystemDirectoryHandle,
): Promise<1 | 2 | null> {
  try {
    const handle = await directory.getFileHandle('beyond-full-art.json');
    const parsed = parseBackupFolderMarker(JSON.parse(await (await handle.getFile()).text()));
    return parsed?.schemaVersion ?? null;
  } catch {
    return null;
  }
}

export async function listFolderArtMetadata(
    directory: FileSystemDirectoryHandle,
): Promise<CharacterArtMetadata[]> {
  const metadata: CharacterArtMetadata[] = [];
  for (const characterId of await listCharacterIds(directory)) {
    const commit = await readCommit(directory, characterId);
    if (commit?.fullArt !== null
      && commit?.fullArt !== undefined
      && !hasTombstone(commit, 'full-art', 'full-art')) {
      metadata.push(commit.fullArt.metadata);
    }
  }
  return metadata;
}

export async function readFolderArtMetadata(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<CharacterArtMetadata | null> {
  const commit = await readCommit(directory, characterId);
  if (commit !== null && hasTombstone(commit, 'full-art', 'full-art')) {
    return null;
  }
  return commit?.fullArt?.metadata ?? null;
}

export async function readFolderArtBytes(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<Uint8Array | null> {
  const commit = await readCommit(directory, characterId);
  if (commit?.fullArt == null || hasTombstone(commit, 'full-art', 'full-art')) {
    return null;
  }
  const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
  if (characterDirectory === null) {
    return null;
  }
  return readChecked(characterDirectory, commit.fullArt.fileName, commit.fullArt.sha256);
}

export async function readFolderCropMetadata(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<CharacterPortraitCropMetadata | null> {
  const commit = await readCommit(directory, characterId);
  if (commit !== null && hasTombstone(commit, 'crop', 'crop')) {
    return null;
  }
  return commit?.crop?.metadata ?? null;
}

export async function readFolderCropBytes(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<Uint8Array | null> {
  const commit = await readCommit(directory, characterId);
  if (commit?.crop == null || hasTombstone(commit, 'crop', 'crop')) {
    return null;
  }
  const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
  if (characterDirectory === null) {
    return null;
  }
  return readChecked(characterDirectory, commit.crop.fileName, commit.crop.sha256);
}

export async function keepFolderArtVersion(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    kind: FolderKeptKind,
    bytes: Uint8Array,
    mimeType: SupportedCharacterArtMimeType,
    now: string = new Date().toISOString(),
): Promise<FolderKeptFile> {
  const characterDirectory = await characterDirectoryHandle(directory, characterId, true);
  if (characterDirectory === null) {
    throw new Error('The character folder could not be created.');
  }
  const commit = await readCommit(directory, characterId) ?? emptyCommit(characterId, now);
  const stamp = keptTimestamp(now);
  const stem = kind === 'full-art' ? 'full-art-kept' : 'portrait-crop-kept';
  const extension = kind === 'crop' ? 'png' : extensionForMimeType(mimeType);
  const fileName = await unusedFileName(characterDirectory, `${stem}-${stamp}`, extension);
  const sha256 = await writeAndCheck(characterDirectory, fileName, bytes);
  const kept = {fileName, kind, sha256} as const;
  commit.kept.push(kept);
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
  return kept;
}

export async function saveFolderFullArt(
    directory: FileSystemDirectoryHandle,
    metadata: CharacterArtMetadata,
    bytes: Uint8Array,
    now: string = new Date().toISOString(),
    loadedSha256?: string | null,
): Promise<void> {
  const characterDirectory = await characterDirectoryHandle(directory, metadata.characterId, true);
  if (characterDirectory === null) {
    throw new Error('The character folder could not be created.');
  }
  const commit = await readCommit(directory, metadata.characterId) ?? emptyCommit(metadata.characterId, now);
  const currentSha256 = commit.fullArt?.sha256 ?? null;
  if (loadedSha256 !== undefined && loadedSha256 !== currentSha256) {
    throw new Error(
        'Full art changed in the folder. Check the folder and choose the portrait again.',
    );
  }
  const fileName = fileNameFor('full-art', metadata.mimeType);
  const sha256 = await writeAndCheck(characterDirectory, fileName, bytes);
  if (commit.fullArt !== null && commit.fullArt.fileName !== fileName) {
    await removeFile(characterDirectory, commit.fullArt.fileName);
  }
  if (commit.crop !== null) {
    await removeFile(characterDirectory, commit.crop.fileName);
  }
  await removeTombstone(characterDirectory, commit, 'full-art', 'full-art');
  await removeTombstone(characterDirectory, commit, 'crop', 'crop');
  commit.fullArt = {fileName, metadata, sha256};
  commit.crop = null;
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
}

export async function saveFolderCrop(
    directory: FileSystemDirectoryHandle,
    metadata: CharacterPortraitCropMetadata,
    bytes: Uint8Array,
    now: string = new Date().toISOString(),
): Promise<void> {
  const characterDirectory = await characterDirectoryHandle(directory, metadata.characterId, true);
  if (characterDirectory === null) {
    throw new Error('The character folder could not be created.');
  }
  const commit = await readCommit(directory, metadata.characterId);
  if (commit?.fullArt == null) {
    throw new Error('Stored full art is required before creating a portrait crop.');
  }
  if (commit.fullArt.metadata.blobKey !== metadata.sourceArtBlobKey) {
    throw new Error('Stored full art changed before the portrait crop could be saved.');
  }
  const fileName = fileNameFor('portrait-crop', metadata.mimeType);
  const sha256 = await writeAndCheck(characterDirectory, fileName, bytes);
  if (commit.crop !== null && commit.crop.fileName !== fileName) {
    await removeFile(characterDirectory, commit.crop.fileName);
  }
  await removeTombstone(characterDirectory, commit, 'crop', 'crop');
  commit.crop = {fileName, metadata, sha256};
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
}

/**
 * Removes characters/<characterId> after a confirmed character-deletion
 * cleanup. The numbered folder and everything inside it go away. Other
 * character folders stay.
 */
export async function eraseFolderCharacterContent(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<void> {
  let characters: FileSystemDirectoryHandle;
  try {
    characters = await directory.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
  } catch (error) {
    if (isNotFound(error)) {
      return;
    }
    throw error;
  }
  const folderName = safeId(characterId);
  try {
    await characters.getDirectoryHandle(folderName);
  } catch (error) {
    if (isNotFound(error)) {
      return;
    }
    throw error;
  }
  await (characters as FileSystemDirectoryHandle & {
    removeEntry(name: string, options?: {recursive?: boolean}): Promise<void>;
  }).removeEntry(folderName, {recursive: true});
}

export async function deleteFolderArt(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<void> {
  const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
  const commit = await readCommit(directory, characterId);
  if (characterDirectory === null || commit === null) {
    return;
  }
  const now = new Date().toISOString();
  if (commit.fullArt !== null) {
    await addTombstone(characterDirectory, commit, 'full-art', 'full-art', now);
  }
  if (commit.crop !== null) {
    await addTombstone(characterDirectory, commit, 'crop', 'crop', now);
  }
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
  if (commit.fullArt !== null) {
    await removeFile(characterDirectory, commit.fullArt.fileName);
  }
  if (commit.crop !== null) {
    await removeFile(characterDirectory, commit.crop.fileName);
  }
  commit.fullArt = null;
  commit.crop = null;
  await writeCommit(characterDirectory, commit);
}

export async function readFolderNotes(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<JournalNote[]> {
  const commit = await readCommit(directory, characterId);
  if (commit === null) {
    return [];
  }
  const notesDirectory = await nestedDirectory(directory, [
    BACKUP_FOLDER_CHARACTERS_DIRECTORY,
    safeId(characterId),
    'journal',
    'notes',
  ], false);
  if (notesDirectory === null) {
    return [];
  }
  const notes: JournalNote[] = [];
  const deletedNoteIds = tombstonedIds(commit, 'note');
  for (const file of commit.notes) {
    if (deletedNoteIds.has(file.id)) {
      continue;
    }
    const bytes = await readChecked(notesDirectory, file.fileName, file.sha256);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isJournalNote(parsed) || parsed.characterId !== characterId) {
      throw new Error(`“${file.fileName}” is not a journal note this version can read.`);
    }
    notes.push(parsed);
  }
  return notes;
}

export async function listFolderJournals(
    directory: FileSystemDirectoryHandle,
): Promise<{characterId: string; records: JournalNote[]}[]> {
  const journals = [];
  for (const characterId of await listCharacterIds(directory)) {
    const records = await readFolderNotes(directory, characterId);
    if (records.length > 0) {
      journals.push({characterId, records});
    }
  }
  return journals;
}

export async function writeFolderNotes(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    records: readonly unknown[],
    now: string = new Date().toISOString(),
): Promise<void> {
  const notes = records.filter(isJournalNote).filter((note) => note.characterId === characterId);
  const characterDirectory = await characterDirectoryHandle(directory, characterId, true);
  if (characterDirectory === null) {
    throw new Error('The character folder could not be created.');
  }
  const notesDirectory = await nestedDirectory(characterDirectory, ['journal', 'notes'], true);
  if (notesDirectory === null) {
    throw new Error('The notes folder could not be created.');
  }
  const commit = await readCommit(directory, characterId) ?? emptyCommit(characterId, now);
  const deletedNoteIds = tombstonedIds(commit, 'note');
  const refused = notes.find((note) => deletedNoteIds.has(note.id));
  if (refused !== undefined) {
    throw new Error(`“${refused.title}” was deleted in the folder. Restore it before saving.`);
  }
  const nextNoteIds = new Set(notes.map((note) => note.id));
  let addedDeletion = false;
  for (const previous of commit.notes) {
    if (nextNoteIds.has(previous.id)) {
      continue;
    }
    const bytes = await readChecked(notesDirectory, previous.fileName, previous.sha256);
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!isJournalNote(parsed) || parsed.characterId !== characterId) {
      throw new Error(`“${previous.fileName}” is not a journal note this version can read.`);
    }
    if (!hasTombstone(commit, 'note', parsed.id)) {
      addedDeletion = true;
    }
    await addTombstone(characterDirectory, commit, 'note', parsed.id, now);
    for (const image of parsed.images) {
      if (!hasTombstone(commit, 'image', image.id)) {
        addedDeletion = true;
      }
      await addTombstone(characterDirectory, commit, 'image', image.id, now);
    }
  }
  if (addedDeletion) {
    commit.copiedAt = now;
    await writeCommit(characterDirectory, commit);
  }
  const nextFiles: FolderNamedFile[] = [];
  for (const note of notes) {
    const fileName = `${safeId(note.id)}.json`;
    const sha256 = await writeAndCheck(
        notesDirectory,
        fileName,
        utf8(`${JSON.stringify(note, null, 2)}\n`),
    );
    nextFiles.push({fileName, id: note.id, sha256});
  }
  for (const previous of commit.notes) {
    if (!nextFiles.some((file) => file.fileName === previous.fileName)) {
      await removeFile(notesDirectory, previous.fileName);
    }
  }
  commit.notes = nextFiles;
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
}

export async function restoreFolderNote(
    directory: FileSystemDirectoryHandle,
    note: JournalNote,
    now: string = new Date().toISOString(),
): Promise<void> {
  const characterDirectory = await characterDirectoryHandle(directory, note.characterId, false);
  const commit = await readCommit(directory, note.characterId);
  if (characterDirectory === null || commit === null) {
    throw new Error('The deleted note could not be found in the folder.');
  }
  if (!hasTombstone(commit, 'note', note.id)) {
    throw new Error('The note is not deleted in the folder.');
  }
  const notesDirectory = await nestedDirectory(characterDirectory, ['journal', 'notes'], true);
  if (notesDirectory === null) {
    throw new Error('The notes folder could not be created.');
  }
  for (const image of note.images) {
    if (!hasTombstone(commit, 'image', image.id)) {
      continue;
    }
    const stored = commit.images.find((file) => file.id === image.id);
    if (stored === undefined) {
      throw new Error(`The photo “${image.fileName}” could not be restored from the folder.`);
    }
    const imagesDirectory = await nestedDirectory(characterDirectory, ['journal', 'images'], false);
    if (imagesDirectory === null) {
      throw new Error(`The photo “${image.fileName}” could not be restored from the folder.`);
    }
    await readChecked(imagesDirectory, stored.fileName, stored.sha256);
  }
  const fileName = `${safeId(note.id)}.json`;
  const sha256 = await writeAndCheck(
      notesDirectory,
      fileName,
      utf8(`${JSON.stringify(note, null, 2)}\n`),
  );
  commit.notes = [
    ...commit.notes.filter((file) => file.id !== note.id),
    {fileName, id: note.id, sha256},
  ];
  await removeTombstone(characterDirectory, commit, 'note', note.id);
  for (const image of note.images) {
    await removeTombstone(characterDirectory, commit, 'image', image.id);
  }
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
}

export async function readFolderJournalImage(
    directory: FileSystemDirectoryHandle,
    blobKey: string,
): Promise<{byteBuffer: ArrayBuffer; mimeType: SupportedCharacterArtMimeType} | null> {
  const imageId = imageIdFromBlobKey(blobKey);
  if (imageId === null) {
    return null;
  }
  for (const characterId of await listCharacterIds(directory)) {
    const commit = await readCommit(directory, characterId);
    const image = commit?.images.find((file) => file.id === imageId);
    if (image === undefined || commit === null) {
      continue;
    }
    if (hasTombstone(commit, 'image', imageId)) {
      continue;
    }
    const imagesDirectory = await nestedDirectory(directory, [
      BACKUP_FOLDER_CHARACTERS_DIRECTORY,
      safeId(characterId),
      'journal',
      'images',
    ], false);
    if (imagesDirectory === null) {
      continue;
    }
    const bytes = await readChecked(imagesDirectory, image.fileName, image.sha256);
    return {byteBuffer: copyBuffer(bytes), mimeType: mimeFromFileName(image.fileName)};
  }
  return null;
}

export async function writeFolderJournalImage(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    blobKey: string,
    bytes: Uint8Array,
    mimeType: SupportedCharacterArtMimeType,
    now: string = new Date().toISOString(),
): Promise<void> {
  const imageId = imageIdFromBlobKey(blobKey);
  if (imageId === null) {
    throw new Error('The photo could not be saved in the folder.');
  }
  const characterDirectory = await characterDirectoryHandle(directory, characterId, true);
  const imagesDirectory = characterDirectory === null
    ? null
    : await nestedDirectory(characterDirectory, ['journal', 'images'], true);
  if (characterDirectory === null || imagesDirectory === null) {
    throw new Error('The photo folder could not be created.');
  }
  const fileName = fileNameFor(safeId(imageId), mimeType);
  const sha256 = await writeAndCheck(imagesDirectory, fileName, bytes);
  const commit = await readCommit(directory, characterId) ?? emptyCommit(characterId, now);
  if (hasTombstone(commit, 'image', imageId)) {
    throw new Error('That photo was deleted in the folder. Restore it before saving.');
  }
  const previous = commit.images.find((file) => file.id === imageId);
  if (previous !== undefined && previous.fileName !== fileName) {
    await removeFile(imagesDirectory, previous.fileName);
  }
  commit.images = [
    ...commit.images.filter((file) => file.id !== imageId),
    {fileName, id: imageId, sha256},
  ];
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
}

export async function restoreFolderJournalImage(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    blobKey: string,
    bytes: Uint8Array,
    mimeType: SupportedCharacterArtMimeType,
    now: string = new Date().toISOString(),
): Promise<void> {
  const imageId = imageIdFromBlobKey(blobKey);
  const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
  const commit = await readCommit(directory, characterId);
  if (imageId === null || characterDirectory === null || commit === null) {
    throw new Error('The deleted photo could not be found in the folder.');
  }
  if (!hasTombstone(commit, 'image', imageId)) {
    throw new Error('The photo is not deleted in the folder.');
  }
  const imagesDirectory = await nestedDirectory(characterDirectory, ['journal', 'images'], true);
  if (imagesDirectory === null) {
    throw new Error('The photo folder could not be created.');
  }
  const fileName = fileNameFor(safeId(imageId), mimeType);
  const sha256 = await writeAndCheck(imagesDirectory, fileName, bytes);
  const previous = commit.images.find((file) => file.id === imageId);
  if (previous !== undefined && previous.fileName !== fileName) {
    await removeFile(imagesDirectory, previous.fileName);
  }
  commit.images = [
    ...commit.images.filter((file) => file.id !== imageId),
    {fileName, id: imageId, sha256},
  ];
  await removeTombstone(characterDirectory, commit, 'image', imageId);
  commit.copiedAt = now;
  await writeCommit(characterDirectory, commit);
}

export async function deleteFolderJournalImage(
    directory: FileSystemDirectoryHandle,
    blobKey: string,
): Promise<void> {
  const imageId = imageIdFromBlobKey(blobKey);
  if (imageId === null) {
    return;
  }
  for (const characterId of await listCharacterIds(directory)) {
    const commit = await readCommit(directory, characterId);
    const image = commit?.images.find((file) => file.id === imageId);
    if (image === undefined || commit === null) {
      continue;
    }
    const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
    if (characterDirectory === null) {
      return;
    }
    const now = new Date().toISOString();
    await addTombstone(characterDirectory, commit, 'image', imageId, now);
    commit.copiedAt = now;
    await writeCommit(characterDirectory, commit);
    return;
  }
}

export async function readCommit(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<FolderCommit | null> {
  const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
  if (characterDirectory === null) {
    return null;
  }
  try {
    const handle = await characterDirectory.getFileHandle(COMMIT_FILE_NAME);
    return parseCommit(JSON.parse(await (await handle.getFile()).text()));
  } catch {
    return null;
  }
}

async function listCharacterIds(directory: FileSystemDirectoryHandle): Promise<string[]> {
  let characters: FileSystemDirectoryHandle;
  try {
    characters = await directory.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for await (const [name, handle] of directoryEntries(characters)) {
    if (handle.kind !== 'directory') {
      continue;
    }
    try {
      await (handle as FileSystemDirectoryHandle).getFileHandle(COMMIT_FILE_NAME);
      ids.push(name);
    } catch {
      // A directory without character.json is not a finished character.
    }
  }
  return ids;
}

async function writeCommit(
    characterDirectory: FileSystemDirectoryHandle,
    commit: FolderCommit,
): Promise<void> {
  await writeAndCheck(
      characterDirectory,
      COMMIT_FILE_NAME,
      utf8(`${JSON.stringify(commit, null, 2)}\n`),
  );
}

function emptyCommit(characterId: string, copiedAt: string): FolderCommit {
  return {
    characterId,
    copiedAt,
    crop: null,
    fullArt: null,
    images: [],
    kept: [],
    notes: [],
    schemaVersion: 1,
    tombstones: [],
  };
}

function parseCommit(value: unknown): FolderCommit | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Partial<FolderCommit>;
  if (typeof record.characterId !== 'string' || record.schemaVersion !== 1) {
    return null;
  }
  const fullArt = parseArtFile(record.fullArt);
  const crop = parseCropFile(record.crop);
  if (record.fullArt != null && fullArt === null) {
    return null;
  }
  if (record.crop != null && crop === null) {
    return null;
  }
  return {
    characterId: record.characterId,
    copiedAt: typeof record.copiedAt === 'string' ? record.copiedAt : '',
    crop,
    fullArt,
    images: parseNamedFiles(record.images),
    kept: parseKeptFiles(record.kept),
    notes: parseNamedFiles(record.notes),
    schemaVersion: 1,
    tombstones: parseTombstoneFiles(record.tombstones),
  };
}

function parseKeptFiles(value: unknown): FolderKeptFile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isKeptFile);
}

function isKeptFile(value: unknown): value is FolderKeptFile {
  if (!isNamedSha(value)) {
    return false;
  }
  const record = value as {kind?: unknown};
  return record.kind === 'crop' || record.kind === 'full-art';
}

function parseTombstoneFiles(value: unknown): FolderTombstoneFile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isTombstoneFile);
}

function isTombstoneFile(value: unknown): value is FolderTombstoneFile {
  if (!isNamedFile(value)) {
    return false;
  }
  const record = value as {deletedAt?: unknown; kind?: unknown};
  return typeof record.deletedAt === 'string' && isTombstoneKind(record.kind);
}

function isTombstoneKind(value: unknown): value is FolderTombstoneKind {
  return value === 'crop' || value === 'full-art' || value === 'image' || value === 'note';
}

function parseArtFile(value: unknown): FolderArtFile | null {
  if (value == null) {
    return null;
  }
  if (!isNamedSha(value) || !isCharacterArtMetadata(value.metadata)) {
    return null;
  }
  return {fileName: value.fileName, metadata: value.metadata, sha256: value.sha256};
}

function parseCropFile(value: unknown): FolderCropFile | null {
  if (value == null) {
    return null;
  }
  if (!isNamedSha(value) || !isCharacterPortraitCropMetadata(value.metadata)) {
    return null;
  }
  return {fileName: value.fileName, metadata: value.metadata, sha256: value.sha256};
}

function parseNamedFiles(value: unknown): FolderNamedFile[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isNamedFile);
}

function isNamedSha(
    value: unknown,
): value is {fileName: string; metadata?: unknown; sha256: string} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as {fileName?: unknown; sha256?: unknown};
  return typeof record.fileName === 'string' && typeof record.sha256 === 'string';
}

function isNamedFile(value: unknown): value is FolderNamedFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as {fileName?: unknown; id?: unknown; sha256?: unknown};
  return typeof record.fileName === 'string'
    && typeof record.id === 'string'
    && typeof record.sha256 === 'string';
}

function tombstonedIds(
    commit: FolderCommit,
    kind: FolderTombstoneKind,
): Set<string> {
  return new Set(
      commit.tombstones.filter((entry) => entry.kind === kind).map((entry) => entry.id),
  );
}

function hasTombstone(
    commit: FolderCommit,
    kind: FolderTombstoneKind,
    id: string,
): boolean {
  return commit.tombstones.some((entry) => entry.kind === kind && entry.id === id);
}

async function addTombstone(
    characterDirectory: FileSystemDirectoryHandle,
    commit: FolderCommit,
    kind: FolderTombstoneKind,
    id: string,
    deletedAt: string,
): Promise<void> {
  if (hasTombstone(commit, kind, id)) {
    return;
  }
  const location = tombstoneLocation(kind, id);
  const tombstonesDirectory = await nestedDirectory(
      characterDirectory,
      location.directories,
      true,
  );
  if (tombstonesDirectory === null) {
    throw new Error('The deleted-item folder could not be created.');
  }
  const tombstone = {
    characterId: commit.characterId,
    deletedAt,
    id,
    kind,
    schemaVersion: 1,
  } as const;
  const sha256 = await writeAndCheck(
      tombstonesDirectory,
      location.name,
      utf8(`${JSON.stringify(tombstone, null, 2)}\n`),
  );
  commit.tombstones.push({
    deletedAt,
    fileName: [...location.directories, location.name].join('/'),
    id,
    kind,
    sha256,
  });
}

async function removeTombstone(
    characterDirectory: FileSystemDirectoryHandle,
    commit: FolderCommit,
    kind: FolderTombstoneKind,
    id: string,
): Promise<void> {
  const existing = commit.tombstones.find((entry) => entry.kind === kind && entry.id === id);
  if (existing === undefined) {
    return;
  }
  const parts = existing.fileName.split('/');
  const name = parts.pop();
  const tombstonesDirectory = await nestedDirectory(characterDirectory, parts, false);
  if (name !== undefined && tombstonesDirectory !== null) {
    await removeFile(tombstonesDirectory, name);
  }
  commit.tombstones = commit.tombstones.filter(
      (entry) => entry.kind !== kind || entry.id !== id,
  );
}

function tombstoneLocation(
    kind: FolderTombstoneKind,
    id: string,
): {directories: string[]; name: string} {
  if (kind === 'note') {
    return {directories: ['journal', 'tombstones'], name: `${safeId(id)}.json`};
  }
  if (kind === 'image') {
    return {directories: ['journal', 'tombstones'], name: `image-${safeId(id)}.json`};
  }
  return {
    directories: ['tombstones'],
    name: kind === 'full-art' ? 'full-art.json' : 'portrait-crop.json',
  };
}

const PHOTO_CATALOG_FILE_NAME = 'photos.json';

export async function readFolderPhotoCatalogFile(
    directory: FileSystemDirectoryHandle,
    characterId: string,
): Promise<{images: unknown[]; present: boolean}> {
  const characterDirectory = await characterDirectoryHandle(directory, characterId, false);
  const journal = characterDirectory === null
    ? null
    : await nestedDirectory(characterDirectory, ['journal'], false);
  if (journal === null) {
    return {images: [], present: false};
  }

  let handle: FileSystemFileHandle;
  try {
    handle = await journal.getFileHandle(PHOTO_CATALOG_FILE_NAME);
  } catch {
    return {images: [], present: false};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await (await handle.getFile()).text());
  } catch {
    throw new Error('The photo library in the folder could not be read.');
  }
  return {images: catalogImageRecords(parsed), present: true};
}

export async function writeFolderPhotoCatalogFile(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    images: readonly unknown[],
): Promise<void> {
  const characterDirectory = await characterDirectoryHandle(directory, characterId, true);
  const journal = characterDirectory === null
    ? null
    : await nestedDirectory(characterDirectory, ['journal'], true);
  if (characterDirectory === null || journal === null) {
    throw new Error('The photo library folder could not be created.');
  }
  const kept = images.filter(isJournalImage);
  await writeAndCheck(
      journal,
      PHOTO_CATALOG_FILE_NAME,
      utf8(`${JSON.stringify({images: kept, schemaVersion: 1}, null, 2)}\n`),
  );
}

function catalogImageRecords(value: unknown): unknown[] {
  if (typeof value !== 'object' || value === null || !('images' in value)) {
    return [];
  }
  const images = (value as {images?: unknown}).images;
  return Array.isArray(images) ? images : [];
}

async function characterDirectoryHandle(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    create: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  return nestedDirectory(directory, [
    BACKUP_FOLDER_CHARACTERS_DIRECTORY,
    safeId(characterId),
  ], create);
}

async function nestedDirectory(
    directory: FileSystemDirectoryHandle,
    names: readonly string[],
    create: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  let current = directory;
  for (const name of names) {
    try {
      current = create
        ? await current.getDirectoryHandle(name, {create: true})
        : await current.getDirectoryHandle(name);
    } catch {
      return null;
    }
  }
  return current;
}

async function readChecked(
    directory: FileSystemDirectoryHandle,
    fileName: string,
    sha256: string,
): Promise<Uint8Array> {
  const handle = await directory.getFileHandle(fileName);
  const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if (await sha256Hex(bytes) !== sha256) {
    throw new Error(`“${fileName}” did not match the folder check.`);
  }
  return bytes;
}

async function writeAndCheck(
    directory: FileSystemDirectoryHandle,
    fileName: string,
    bytes: Uint8Array,
): Promise<string> {
  const fileBytes = new Uint8Array(bytes.byteLength);
  fileBytes.set(bytes);
  const expected = await sha256Hex(fileBytes);
  const handle = await directory.getFileHandle(fileName, {create: true});
  const writable = await handle.createWritable();
  await writable.write(fileBytes);
  await writable.close();
  const stored = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  if (await sha256Hex(stored) !== expected) {
    throw new Error(`“${fileName}” did not match after it was written.`);
  }
  return expected;
}

function isNotFound(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

async function removeFile(
    directory: FileSystemDirectoryHandle,
    fileName: string,
): Promise<void> {
  try {
    await (directory as FileSystemDirectoryHandle & {
      removeEntry(name: string): Promise<void>;
    }).removeEntry(fileName);
  } catch {
    // The replaced file is already gone.
  }
}

function fileNameFor(stem: string, mimeType: SupportedCharacterArtMimeType): string {
  return `${stem}.${extensionForMimeType(mimeType)}`;
}

function extensionForMimeType(mimeType: SupportedCharacterArtMimeType): string {
  return mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png';
}

function keptTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('The kept image timestamp is invalid.');
  }
  return parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

async function unusedFileName(
    directory: FileSystemDirectoryHandle,
    stem: string,
    extension: string,
): Promise<string> {
  for (let copy = 1; ; copy += 1) {
    const suffix = copy === 1 ? '' : `-${copy}`;
    const candidate = `${stem}${suffix}.${extension}`;
    try {
      await directory.getFileHandle(candidate);
    } catch {
      return candidate;
    }
  }
}

function mimeFromFileName(fileName: string): SupportedCharacterArtMimeType {
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (fileName.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/png';
}

function imageIdFromBlobKey(blobKey: string): string | null {
  const prefix = 'bfa.journal.image.';
  if (!blobKey.startsWith(prefix)) {
    return null;
  }
  const imageId = blobKey.slice(prefix.length);
  return /^[A-Za-z0-9_-]+$/.test(imageId) ? imageId : null;
}

function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('A saved id cannot be used as a file name.');
  }
  return id;
}

function utf8(value: string): Uint8Array {
  const encoded = new TextEncoder().encode(value);
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return copy;
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function* directoryEntries(
    directory: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle]> {
  const entries = (directory as FileSystemDirectoryHandle & {
    entries(): AsyncIterable<[string, FileSystemHandle]>;
  }).entries();
  yield* entries;
}
