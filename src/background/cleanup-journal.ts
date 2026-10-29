import {isJournalImage, isJournalNote} from '../features/character-journal/character-journal-types';
import {deleteStoredCharacterArtBlob} from '../platform/chrome/indexed-db';
import {
  eraseFolderCharacterContent,
  libraryBlockedError,
  readFolderNotes,
  readFolderPhotoCatalogFile,
  resolveLibrary,
} from '../platform/chrome/folder-library';
import {journalPhotoCatalogKey} from '../platform/chrome/journal-photo-catalog';
import {
  deleteStoredCharacterArtMetadata,
  deleteStoredCharacterPortraitCropMetadata,
  getCharacterJournalBackupKey,
  getCharacterJournalEntriesKey,
  getStoredCharacterArtMetadata,
  getStoredCharacterPortraitCropMetadata,
  readRawCharacterJournalRecords,
} from '../platform/chrome/storage';

export async function characterHasJournalOrPhotos(characterId: string): Promise<boolean> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    return false;
  }
  if (library.kind === 'ready') {
    if ((await readFolderNotes(library.directory, characterId)).length > 0) {
      return true;
    }
    const catalog = await readFolderPhotoCatalogFile(library.directory, characterId);
    return catalog.images.length > 0;
  }
  const records = await readRawCharacterJournalRecords(characterId, chrome.storage.local);
  if (records.length > 0) {
    return true;
  }
  return (await readLocalCatalog(characterId)).length > 0;
}

export async function deleteCharacterJournalAndPhotos(characterId: string): Promise<void> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    await eraseFolderCharacterContent(library.directory, characterId);
  }
  await deleteLocalJournalAndPhotos(characterId);
  await deleteLocalCharacterArt(characterId);
}

async function deleteLocalCharacterArt(characterId: string): Promise<void> {
  const metadata = await getStoredCharacterArtMetadata(characterId, chrome.storage.local);
  const crop = await getStoredCharacterPortraitCropMetadata(characterId, chrome.storage.local);
  const blobKeys = [
    ...(metadata === null ? [] : [metadata.blobKey]),
    ...(crop === null ? [] : [crop.blobKey]),
  ];
  for (const blobKey of blobKeys) {
    await deleteStoredCharacterArtBlob(blobKey);
  }
  await deleteStoredCharacterArtMetadata(characterId, chrome.storage.local);
  await deleteStoredCharacterPortraitCropMetadata(characterId, chrome.storage.local);
}

async function deleteLocalJournalAndPhotos(characterId: string): Promise<void> {
  const records = await readRawCharacterJournalRecords(characterId, chrome.storage.local);
  const catalog = await readLocalCatalog(characterId);
  const blobKeys = new Set<string>();
  for (const record of records) {
    if (!isJournalNote(record)) {
      continue;
    }
    for (const image of record.images) {
      blobKeys.add(image.blobKey);
    }
  }
  for (const image of catalog) {
    if (isJournalImage(image)) {
      blobKeys.add(image.blobKey);
    }
  }
  for (const blobKey of blobKeys) {
    await deleteStoredCharacterArtBlob(blobKey);
  }
  await storageRemove([
    getCharacterJournalEntriesKey(characterId),
    getCharacterJournalBackupKey(characterId),
    journalPhotoCatalogKey(characterId),
  ]);
}

async function readLocalCatalog(characterId: string): Promise<unknown[]> {
  const key = journalPhotoCatalogKey(characterId);
  const stored = await storageGet(key);
  const value = stored[key];
  if (typeof value !== 'object' || value === null || !('images' in value)) {
    return [];
  }
  const images = (value as {images?: unknown}).images;
  return Array.isArray(images) ? images : [];
}

function storageGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      const message = chrome.runtime.lastError?.message;
      if (message !== undefined) {
        reject(new Error(message));
        return;
      }
      resolve(result);
    });
  });
}

function storageRemove(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      const message = chrome.runtime.lastError?.message;
      if (message !== undefined) {
        reject(new Error(message));
        return;
      }
      resolve();
    });
  });
}
