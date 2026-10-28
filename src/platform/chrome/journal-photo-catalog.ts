import {
  isJournalImage,
  type JournalImage,
} from '../../features/character-journal/character-journal-types';
import {
  readFolderPhotoCatalog,
  writeFolderPhotoCatalog,
} from './folder-library-client';
import {isFolderLibrary} from './library-mode';

export const JOURNAL_PHOTO_CATALOG_KEY_PREFIX = 'bfa.journal.library.';

export function journalPhotoCatalogKey(characterId: string): string {
  return `${JOURNAL_PHOTO_CATALOG_KEY_PREFIX}${characterId}`;
}

export async function readJournalPhotoCatalog(
    characterId: string,
): Promise<JournalImage[]> {
  const local = await readLocalCatalog(characterId);
  if (!await isFolderLibrary()) {
    return local;
  }

  try {
    const folder = await readFolderPhotoCatalog(characterId);
    if (folder === null) {
      return local;
    }
    return mergeStoredImages(folder, local);
  } catch {
    return local;
  }
}

export async function writeJournalPhotoCatalog(
    characterId: string,
    images: readonly JournalImage[],
): Promise<void> {
  const stored = images.map(storedImage);
  await writeLocalCatalog(characterId, stored);
  if (!await isFolderLibrary()) {
    return;
  }

  try {
    await writeFolderPhotoCatalog(characterId, stored);
  } catch {
    // This browser still has the catalog. The folder file is rewritten
    // the next time a photo is added, removed, or opened.
  }
}

async function readLocalCatalog(characterId: string): Promise<JournalImage[]> {
  const key = journalPhotoCatalogKey(characterId);
  const stored = await storageGet(key);
  return parseCatalog(stored[key]);
}

async function writeLocalCatalog(
    characterId: string,
    images: readonly JournalImage[],
): Promise<void> {
  await storageSet({
    [journalPhotoCatalogKey(characterId)]: {
      images,
      schemaVersion: 1,
    },
  });
}

function parseCatalog(value: unknown): JournalImage[] {
  if (typeof value !== 'object' || value === null || !('images' in value)) {
    return [];
  }
  const images = (value as {images?: unknown}).images;
  if (!Array.isArray(images)) {
    return [];
  }
  return images.filter(isJournalImage).map(storedImage);
}

function mergeStoredImages(
    folder: readonly unknown[],
    local: readonly JournalImage[],
): JournalImage[] {
  const byId = new Map<string, JournalImage>();
  for (const image of folder) {
    if (isJournalImage(image)) {
      byId.set(image.id, storedImage(image));
    }
  }
  for (const image of local) {
    if (!byId.has(image.id)) {
      byId.set(image.id, image);
    }
  }
  return [...byId.values()];
}

function storedImage(image: JournalImage): JournalImage {
  const next = {...image};
  if (next.orphanedAt === undefined || next.orphanedAt === null) {
    delete next.orphanedAt;
  }
  return next;
}

function storageArea(): chrome.storage.StorageArea {
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    throw new Error('chrome.storage.local is unavailable');
  }
  return chrome.storage.local;
}

function storageGet(key: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    storageArea().get(key, (value) => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(value as Record<string, unknown>);
    });
  });
}

function storageSet(values: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea().set(values, () => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}
