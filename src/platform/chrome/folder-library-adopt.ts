import type {JournalNote} from '../../features/character-journal/character-journal-types';
import {markBackupFolderCopied} from './backup-folder';
import {
  loadBrowserLibraryCharacters,
  type BrowserLibraryCharacter,
  type CopyBrowserLibrarySources,
} from './backup-folder-copy';
import {
  listFolderArtMetadata,
  readFolderArtBytes,
  readFolderCropBytes,
  readFolderJournalImage,
  readFolderMarkerSchema,
  readFolderNotes,
} from './folder-library';
import {journalNoteFingerprint} from './folder-library-compare';
import {deleteStoredCharacterArtBlob} from './indexed-db';
import {writeLibraryMode} from './library-mode';
import {deleteStoredArtAndJournal} from './storage';

export type AdoptFolderLibraryResult =
  | {characters: number; kind: 'removed'}
  | {characters: number; kind: 'saving-in-folder'}
  | {kind: 'mismatch'; message: string}
  | {kind: 'unavailable'; message: string};

export function describeAdoptResult(
    folderName: string,
    result: AdoptFolderLibraryResult,
): string {
  switch (result.kind) {
    case 'removed':
      return result.characters === 0
        ? `“${folderName}” is where art and notes are saved. This browser had nothing else to remove.`
        : `Removed this browser's copies of ${result.characters} ${result.characters === 1 ? 'character' : 'characters'}. New art and notes save in “${folderName}”.`;
    case 'saving-in-folder':
      return `New art and notes save in “${folderName}”. This browser is not keeping a second copy.`;
    case 'mismatch':
      return `${result.message} Nothing was removed from this browser.`;
    case 'unavailable':
      return `${result.message} Nothing was removed from this browser.`;
  }
}

export async function adoptFolderLibrary(
    directory: FileSystemDirectoryHandle,
    sources: CopyBrowserLibrarySources = {},
): Promise<AdoptFolderLibraryResult> {
  const schema = await readFolderMarkerSchema(directory);
  if (schema !== 1 && schema !== 2) {
    return {
      kind: 'unavailable',
      message: 'That folder is not ready to replace this browser.',
    };
  }

  const localSources = browserSources(sources);
  let characters: BrowserLibraryCharacter[];
  try {
    characters = await loadBrowserLibraryCharacters(localSources);
  } catch {
    return {
      kind: 'unavailable',
      message: 'This browser\'s art could not be checked.',
    };
  }

  const problem = characters.find((character) => character.problem !== null);
  if (problem?.problem != null) {
    return {kind: 'unavailable', message: problem.problem};
  }

  for (const character of characters) {
    const mismatch = await matchCharacter(directory, character);
    if (mismatch !== null) {
      return {kind: 'mismatch', message: mismatch};
    }
  }

  return finishAdoption(directory, schema, localSources, characters.length);
}

export async function adoptResolvedFolderLibrary(
    directory: FileSystemDirectoryHandle,
    sources: CopyBrowserLibrarySources = {},
): Promise<AdoptFolderLibraryResult> {
  const schema = await readFolderMarkerSchema(directory);
  if (schema !== 1 && schema !== 2) {
    return {kind: 'unavailable', message: 'That folder is not ready to replace this browser.'};
  }
  const localSources = browserSources(sources);
  let characters: BrowserLibraryCharacter[];
  try {
    characters = await loadBrowserLibraryCharacters(localSources);
  } catch {
    return {kind: 'unavailable', message: 'This browser\'s art could not be checked.'};
  }
  const problem = characters.find((character) => character.problem !== null)?.problem;
  if (problem != null) {
    return {kind: 'unavailable', message: problem};
  }
  return finishAdoption(directory, schema, localSources, characters.length);
}

async function finishAdoption(
    directory: FileSystemDirectoryHandle,
    schema: 1 | 2,
    localSources: CopyBrowserLibrarySources,
    characterCount: number,
): Promise<AdoptFolderLibraryResult> {
  if (schema === 1 && !await markBackupFolderCopied(directory)) {
    return {kind: 'unavailable', message: 'That folder is not ready to replace this browser.'};
  }
  await writeMode(localSources);
  let blobKeys: string[] = [];
  try {
    blobKeys = await removeBrowserRecords(localSources);
  } catch {
    // The folder is already the copy the sheet reads. A leftover record is unused.
  }
  for (const blobKey of blobKeys) {
    try {
      await removeBrowserBlob(blobKey, localSources);
    } catch {
      // The folder is already the copy the sheet reads. A leftover blob is unused.
    }
  }

  if (characterCount === 0) {
    const saved = await listFolderArtMetadata(directory);
    return {characters: saved.length, kind: 'saving-in-folder'};
  }
  return {characters: characterCount, kind: 'removed'};
}

function browserSources(sources: CopyBrowserLibrarySources): CopyBrowserLibrarySources {
  if (sources.storageArea !== undefined) {
    return sources;
  }
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    return sources;
  }
  const next: CopyBrowserLibrarySources = {storageArea: chrome.storage.local};
  if (sources.factory !== undefined) {
    next.factory = sources.factory;
  }
  return next;
}

async function writeMode(sources: CopyBrowserLibrarySources): Promise<void> {
  if (sources.storageArea === undefined) {
    await writeLibraryMode('folder');
    return;
  }
  await writeLibraryMode('folder', sources.storageArea);
}

async function removeBrowserRecords(sources: CopyBrowserLibrarySources): Promise<string[]> {
  if (sources.storageArea === undefined) {
    return deleteStoredArtAndJournal();
  }
  return deleteStoredArtAndJournal(sources.storageArea);
}

async function removeBrowserBlob(
    blobKey: string,
    sources: CopyBrowserLibrarySources,
): Promise<void> {
  if (sources.factory === undefined) {
    await deleteStoredCharacterArtBlob(blobKey);
    return;
  }
  await deleteStoredCharacterArtBlob(blobKey, sources.factory);
}

async function matchCharacter(
    directory: FileSystemDirectoryHandle,
    character: BrowserLibraryCharacter,
): Promise<string | null> {
  try {
    if (character.art !== null) {
      const folderBytes = await readFolderArtBytes(directory, character.characterId);
      if (folderBytes === null || !sameBytes(folderBytes, character.art.bytes)) {
        return `Full art for ${character.characterId} does not match the folder.`;
      }
    }
    if (character.crop !== null) {
      const folderBytes = await readFolderCropBytes(directory, character.characterId);
      if (folderBytes === null || !sameBytes(folderBytes, character.crop.bytes)) {
        return `The portrait crop for ${character.characterId} does not match the folder.`;
      }
    }
    const folderNotes = await readFolderNotes(directory, character.characterId);
    for (const note of character.notes) {
      const folderNote = folderNotes.find((candidate) => candidate.id === note.id);
      if (folderNote === undefined || !sameNote(note, folderNote)) {
        return `A note for ${character.characterId} does not match the folder.`;
      }
    }
    for (const image of character.images) {
      const folderImage = await readFolderJournalImage(directory, image.image.blobKey);
      if (folderImage === null || !sameBytes(new Uint8Array(folderImage.byteBuffer), image.bytes)) {
        return `The photo “${image.image.fileName}” does not match the folder.`;
      }
    }
    return null;
  } catch (error) {
    return error instanceof Error && error.message.trim() !== ''
      ? error.message
      : `Character ${character.characterId} could not be checked.`;
  }
}

function sameNote(local: JournalNote, folder: JournalNote): boolean {
  return journalNoteFingerprint(local) === journalNoteFingerprint(folder);
}

function sameBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}
