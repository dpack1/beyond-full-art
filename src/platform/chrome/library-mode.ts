export const LIBRARY_MODE_KEY = 'bfa.library.mode';
export const FOLDER_LIBRARY_BLOCKED_MESSAGE =
  'Choose the backup folder again and allow access. Art and notes stay in that folder, and nothing new was saved on this browser.';

type StorageGetSet = {
  get: chrome.storage.StorageArea['get'];
  set: chrome.storage.StorageArea['set'];
};

export async function readLibraryMode(
    storageArea?: StorageGetSet,
): Promise<'folder' | 'local'> {
  try {
    const area = storageArea ?? chromeStorage();
    if (area === null) {
      return 'local';
    }
    const stored = await storageGet(area, LIBRARY_MODE_KEY);
    return stored[LIBRARY_MODE_KEY] === 'folder' ? 'folder' : 'local';
  } catch {
    return 'local';
  }
}

export async function writeLibraryMode(
    mode: 'folder' | 'local',
    storageArea?: StorageGetSet,
): Promise<void> {
  const area = storageArea ?? chromeStorage();
  if (area === null) {
    throw new Error('chrome.storage.local is unavailable');
  }
  await storageSet(area, {[LIBRARY_MODE_KEY]: mode});
}

export async function isFolderLibrary(storageArea?: StorageGetSet): Promise<boolean> {
  return await readLibraryMode(storageArea) === 'folder';
}

function chromeStorage(): StorageGetSet | null {
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    return null;
  }
  return chrome.storage.local;
}

function storageGet(
    area: StorageGetSet,
    key: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    area.get(key, (value) => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(value as Record<string, unknown>);
    });
  });
}

function storageSet(
    area: StorageGetSet,
    values: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    area.set(values, () => {
      const runtimeError = chrome.runtime?.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}
