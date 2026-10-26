import type {
  CharacterArtMetadata,
  CharacterPortraitCropMetadata,
  SupportedCharacterArtMimeType,
} from '../../features/character-art/art-types';
import {
  isJournalNote,
  type JournalImage,
  type JournalNote,
} from '../../features/character-journal/character-journal-types';
import {
  BACKUP_FOLDER_CHARACTERS_DIRECTORY,
  markBackupFolderCopied,
} from './backup-folder';
import {getStoredCharacterArtBlob} from './indexed-db';
import {
  getAllRawCharacterJournalRecords,
  getAllStoredCharacterArtMetadata,
  getAllStoredCharacterPortraitCropMetadata,
} from './storage';

const COMMIT_FILE_NAME = 'character.json';

export interface CopyBrowserLibraryResult {
  copiedCharacterIds: string[];
  failed: {characterId: string; message: string}[];
  notes: number;
  photos: number;
  skippedCharacterIds: string[];
}

export interface CopyBrowserLibrarySources {
  factory?: IDBFactory;
  storageArea?: Parameters<typeof getAllStoredCharacterArtMetadata>[0];
}

export async function copyBrowserLibraryIntoFolder(
    directory: FileSystemDirectoryHandle,
    now: () => string = () => new Date().toISOString(),
    sources: CopyBrowserLibrarySources = {},
): Promise<CopyBrowserLibraryResult> {
  const existing = await listCommittedCharacterIds(directory);
  const characters = await loadBrowserLibraryCharacters(sources);
  const result: CopyBrowserLibraryResult = {
    copiedCharacterIds: [],
    failed: [],
    notes: 0,
    photos: 0,
    skippedCharacterIds: [],
  };

  for (const character of characters) {
    if (existing.has(character.characterId)) {
      result.skippedCharacterIds.push(character.characterId);
      continue;
    }
    if (character.problem !== null) {
      result.failed.push({
        characterId: character.characterId,
        message: character.problem,
      });
      continue;
    }

    try {
      await writeCharacter(directory, character, now());
      result.copiedCharacterIds.push(character.characterId);
      result.notes += character.notes.length;
      result.photos += character.images.length;
    } catch (error) {
      result.failed.push({
        characterId: character.characterId,
        message: error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'The character could not be written.',
      });
    }
  }

  if (result.failed.length === 0 && result.copiedCharacterIds.length > 0) {
    await markBackupFolderCopied(directory);
  }
  return result;
}

export function copyResultMessage(folderName: string, result: CopyBrowserLibraryResult): string {
  if (result.copiedCharacterIds.length === 0) {
    const reason = result.failed[0]?.message
      ?? (result.skippedCharacterIds.length > 0
        ? 'That character is already in the folder.'
        : 'Nothing was copied.');
    return `Nothing was copied into “${folderName}”. ${reason} Nothing in this browser was removed.`;
  }
  const copied = `Copied ${result.copiedCharacterIds.length} ${result.copiedCharacterIds.length === 1 ? 'character' : 'characters'}, ${result.notes} ${result.notes === 1 ? 'note' : 'notes'}, and ${result.photos} ${result.photos === 1 ? 'photo' : 'photos'} into “${folderName}”. The files were checked. They are still in this browser, so the sheet keeps using them.`;
  if (result.failed.length === 0) {
    return copied;
  }
  return `${copied} ${result.failed.length} ${result.failed.length === 1 ? 'character was' : 'characters were'} not copied.`;
}

export async function listCommittedCharacterIds(
    directory: FileSystemDirectoryHandle,
): Promise<Set<string>> {
  const ids = new Set<string>();
  let characters: FileSystemDirectoryHandle;
  try {
    characters = await directory.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
  } catch {
    return ids;
  }
  for await (const [name, handle] of directoryEntries(characters)) {
    if (handle.kind !== 'directory') {
      continue;
    }
    try {
      await (handle as FileSystemDirectoryHandle).getFileHandle(COMMIT_FILE_NAME);
      ids.add(name);
    } catch {
      // A directory without character.json is not a finished copy.
    }
  }
  return ids;
}

export interface BrowserLibraryCharacter {
  art: {bytes: Uint8Array; metadata: CharacterArtMetadata} | null;
  characterId: string;
  crop: {bytes: Uint8Array; metadata: CharacterPortraitCropMetadata} | null;
  images: {bytes: Uint8Array; image: JournalImage}[];
  notes: JournalNote[];
  problem: string | null;
}

export async function loadBrowserLibraryCharacters(
    sources: CopyBrowserLibrarySources = {},
): Promise<BrowserLibraryCharacter[]> {
  const storageArea = sources.storageArea;
  const [artList, cropList, journals] = await Promise.all([
    storageArea === undefined
      ? getAllStoredCharacterArtMetadata()
      : getAllStoredCharacterArtMetadata(storageArea),
    storageArea === undefined
      ? getAllStoredCharacterPortraitCropMetadata()
      : getAllStoredCharacterPortraitCropMetadata(storageArea),
    storageArea === undefined
      ? getAllRawCharacterJournalRecords()
      : getAllRawCharacterJournalRecords(storageArea),
  ]);
  const byCharacter = new Map<string, BrowserLibraryCharacter>();
  const payloadFor = (characterId: string): BrowserLibraryCharacter => {
    const existing = byCharacter.get(characterId);
    if (existing !== undefined) {
      return existing;
    }
    const created: BrowserLibraryCharacter = {
      art: null,
      characterId,
      crop: null,
      images: [],
      notes: [],
      problem: null,
    };
    byCharacter.set(characterId, created);
    return created;
  };

  for (const metadata of artList) {
    const payload = payloadFor(metadata.characterId);
    const bytes = await readBlob(metadata.blobKey, sources.factory);
    if (bytes === null) {
      payload.problem = 'The full-art file is missing from this browser.';
      continue;
    }
    payload.art = {bytes, metadata};
  }
  for (const metadata of cropList) {
    const payload = payloadFor(metadata.characterId);
    const bytes = await readBlob(metadata.blobKey, sources.factory);
    if (bytes === null) {
      payload.problem = 'The portrait crop is missing from this browser.';
      continue;
    }
    payload.crop = {bytes, metadata};
  }
  for (const journal of journals) {
    const payload = payloadFor(journal.characterId);
    for (const record of journal.records) {
      if (!isJournalNote(record)) {
        payload.problem = 'A journal record could not be read.';
        continue;
      }
      payload.notes.push(record);
      for (const image of record.images) {
        const bytes = await readBlob(image.blobKey, sources.factory);
        if (bytes === null) {
          payload.problem = `The photo “${image.fileName}” is missing from this browser.`;
          continue;
        }
        payload.images.push({bytes, image});
      }
    }
  }
  return [...byCharacter.values()];
}

async function writeCharacter(
    directory: FileSystemDirectoryHandle,
    character: BrowserLibraryCharacter,
    copiedAt: string,
): Promise<void> {
  const characterDirectory = await nestedDirectory(directory, [
    BACKUP_FOLDER_CHARACTERS_DIRECTORY,
    safeId(character.characterId),
  ]);
  const notesDirectory = await nestedDirectory(characterDirectory, ['journal', 'notes']);
  const imagesDirectory = await nestedDirectory(characterDirectory, ['journal', 'images']);
  const commit = {
    characterId: character.characterId,
    copiedAt,
    crop: null as {fileName: string; metadata: CharacterPortraitCropMetadata; sha256: string} | null,
    fullArt: null as {fileName: string; metadata: CharacterArtMetadata; sha256: string} | null,
    images: [] as {fileName: string; id: string; sha256: string}[],
    kept: [],
    notes: [] as {fileName: string; id: string; sha256: string}[],
    schemaVersion: 1 as const,
    tombstones: [],
  };

  if (character.art !== null) {
    const fileName = fileNameFor('full-art', character.art.metadata.mimeType);
    const sha256 = await writeAndCheck(characterDirectory, fileName, character.art.bytes);
    commit.fullArt = {fileName, metadata: character.art.metadata, sha256};
  }
  if (character.crop !== null) {
    const fileName = fileNameFor('portrait-crop', character.crop.metadata.mimeType);
    const sha256 = await writeAndCheck(characterDirectory, fileName, character.crop.bytes);
    commit.crop = {fileName, metadata: character.crop.metadata, sha256};
  }
  for (const note of character.notes) {
    const fileName = `${safeId(note.id)}.json`;
    const bytes = utf8(`${JSON.stringify(note, null, 2)}\n`);
    const sha256 = await writeAndCheck(notesDirectory, fileName, bytes);
    commit.notes.push({fileName, id: note.id, sha256});
  }
  for (const image of character.images) {
    const fileName = fileNameFor(safeId(image.image.id), image.image.mimeType);
    const sha256 = await writeAndCheck(imagesDirectory, fileName, image.bytes);
    commit.images.push({fileName, id: image.image.id, sha256});
  }

  const commitBytes = utf8(`${JSON.stringify(commit, null, 2)}\n`);
  await writeAndCheck(characterDirectory, COMMIT_FILE_NAME, commitBytes);
}

async function writeAndCheck(
    directory: FileSystemDirectoryHandle,
    fileName: string,
    bytes: Uint8Array,
): Promise<string> {
  const expected = await sha256Hex(bytes);
  const handle = await directory.getFileHandle(fileName, {create: true});
  const writable = await handle.createWritable();
  // A fresh ArrayBuffer view satisfies FileSystemWritableFileStream.write.
  const fileBytes = new Uint8Array(bytes.byteLength);
  fileBytes.set(bytes);
  await writable.write(fileBytes);
  await writable.close();
  const stored = new Uint8Array(await (await handle.getFile()).arrayBuffer());
  const actual = await sha256Hex(stored);
  if (actual !== expected) {
    throw new Error(`“${fileName}” did not match after it was written.`);
  }
  return expected;
}

async function nestedDirectory(
    directory: FileSystemDirectoryHandle,
    names: readonly string[],
): Promise<FileSystemDirectoryHandle> {
  let current = directory;
  for (const name of names) {
    current = await current.getDirectoryHandle(name, {create: true});
  }
  return current;
}

async function readBlob(
    blobKey: string,
    factory: IDBFactory | undefined,
): Promise<Uint8Array | null> {
  const blob = factory === undefined
    ? await getStoredCharacterArtBlob(blobKey)
    : await getStoredCharacterArtBlob(blobKey, factory);
  if (blob === null) {
    return null;
  }
  return new Uint8Array(await blob.arrayBuffer());
}

function fileNameFor(stem: string, mimeType: SupportedCharacterArtMimeType): string {
  const extension = mimeType === 'image/jpeg'
    ? 'jpg'
    : mimeType === 'image/webp' ? 'webp' : 'png';
  return `${stem}.${extension}`;
}

function safeId(id: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('A saved id cannot be used as a file name.');
  }
  return id;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
}

async function* directoryEntries(
    directory: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle]> {
  const entries = (directory as FileSystemDirectoryHandle & {
    entries(): AsyncIterable<[string, FileSystemHandle]>;
  }).entries();
  yield* entries;
}
