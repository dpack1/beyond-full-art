import {characterHasJournalOrPhotos} from './cleanup-journal';
import {planJournalDuplicate} from '../features/character-copy/duplicate-journal';
import {
  isJournalImage,
  isSupportedJournalImageMimeType,
} from '../features/character-journal/character-journal-types';
import {
  getStoredCharacterArtBlob,
  putStoredCharacterArtBlob,
} from '../platform/chrome/indexed-db';
import {journalPhotoCatalogKey} from '../platform/chrome/journal-photo-catalog';
import {
  libraryBlockedError,
  readFolderJournalImage,
  readFolderNotes,
  readFolderPhotoCatalogFile,
  resolveLibrary,
  writeFolderJournalImage,
  writeFolderNotes,
  writeFolderPhotoCatalogFile,
} from '../platform/chrome/folder-library';
import {
  readRawCharacterJournalRecords,
  updateJournalNoteRecords,
} from '../platform/chrome/storage';

export async function duplicateCharacterJournal(
    sourceId: string,
    destinationId: string,
): Promise<void> {
  if (sourceId === destinationId) {
    throw new Error('The journal was left where it was.');
  }
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (await characterHasJournalOrPhotos(destinationId)) {
    throw new Error('The new character already has a journal. Nothing was copied.');
  }
  const records = library.kind === 'ready'
    ? await readFolderNotes(library.directory, sourceId)
    : await readRawCharacterJournalRecords(sourceId, chrome.storage.local);
  const catalog = library.kind === 'ready'
    ? (await readFolderPhotoCatalogFile(library.directory, sourceId)).images
    : await readLocalCatalog(sourceId);
  const planned = planJournalDuplicate(
      records,
      catalog,
      destinationId,
      () => crypto.randomUUID(),
  );
  if (planned.notes.length === 0 && planned.catalog.length === 0) {
    throw new Error('There is no journal to copy.');
  }
  const images = [];
  for (const copy of planned.imageCopies) {
    const loaded = library.kind === 'ready'
      ? await readFolderJournalImage(library.directory, copy.fromBlobKey)
      : await readLocalImage(copy.fromBlobKey);
    if (loaded === null || !isSupportedJournalImageMimeType(loaded.mimeType)) {
      throw new Error('A photo could not be copied. Nothing was saved on the new character.');
    }
    images.push({...copy, bytes: new Uint8Array(loaded.byteBuffer), mimeType: loaded.mimeType});
  }
  if (library.kind === 'ready') {
    for (const image of images) {
      await writeFolderJournalImage(
          library.directory,
          destinationId,
          image.image.blobKey,
          image.bytes,
          image.mimeType,
      );
    }
    await writeFolderNotes(library.directory, destinationId, planned.notes);
    if (planned.catalog.length > 0) {
      await writeFolderPhotoCatalogFile(library.directory, destinationId, planned.catalog);
    }
    return;
  }
  for (const image of images) {
    const buffer = image.bytes.buffer.slice(
        image.bytes.byteOffset,
        image.bytes.byteOffset + image.bytes.byteLength,
    ) as ArrayBuffer;
    await putStoredCharacterArtBlob(image.image.blobKey, new Blob([buffer], {type: image.mimeType}));
  }
  await updateJournalNoteRecords(destinationId, () => planned.notes, chrome.storage.local);
  if (planned.catalog.length > 0) {
    await storageSet({
      [journalPhotoCatalogKey(destinationId)]: {images: planned.catalog, schemaVersion: 1},
    });
  }
}

async function readLocalCatalog(characterId: string): Promise<unknown[]> {
  const key = journalPhotoCatalogKey(characterId);
  const stored = await storageGet(key);
  const value = stored[key];
  if (typeof value !== 'object' || value === null || !('images' in value)) {
    return [];
  }
  const images = (value as {images?: unknown}).images;
  return Array.isArray(images) ? images.filter(isJournalImage) : [];
}

async function readLocalImage(blobKey: string): Promise<{byteBuffer: ArrayBuffer; mimeType: string} | null> {
  const blob = await getStoredCharacterArtBlob(blobKey);
  if (blob === null) {
    return null;
  }
  return {byteBuffer: await blob.arrayBuffer(), mimeType: blob.type};
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

function storageSet(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      const message = chrome.runtime.lastError?.message;
      if (message !== undefined) {
        reject(new Error(message));
        return;
      }
      resolve();
    });
  });
}
