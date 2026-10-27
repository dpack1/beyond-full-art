export const JOURNAL_LIST_PREFERENCES_KEY =
  'bfa.preferences.characterJournalListDetails';

export interface JournalListPreferences {
  showPreview: boolean;
  showThumbnail: boolean;
  showUpdatedDate: boolean;
}

export const DEFAULT_JOURNAL_LIST_PREFERENCES: JournalListPreferences = {
  showPreview: false,
  showThumbnail: false,
  showUpdatedDate: false,
};

type StorageGetSet = Pick<chrome.storage.StorageArea, 'get' | 'set'>;

export async function getJournalListPreferences(
    storageArea: StorageGetSet = getStorageArea(),
): Promise<JournalListPreferences> {
  const stored = await storageGet(storageArea, JOURNAL_LIST_PREFERENCES_KEY);
  return normalizePreferences(stored[JOURNAL_LIST_PREFERENCES_KEY]);
}

export async function setJournalListPreferences(
    preferences: JournalListPreferences,
    storageArea: StorageGetSet = getStorageArea(),
): Promise<void> {
  await storageSet(storageArea, {
    [JOURNAL_LIST_PREFERENCES_KEY]: normalizePreferences(preferences),
  });
}

export function normalizeJournalListPreferences(
    value: unknown,
): JournalListPreferences {
  return normalizePreferences(value);
}

function normalizePreferences(value: unknown): JournalListPreferences {
  if (typeof value !== 'object' || value === null) {
    return {...DEFAULT_JOURNAL_LIST_PREFERENCES};
  }

  const stored = value as Record<string, unknown>;
  return {
    showPreview: stored.showPreview === true,
    showThumbnail: stored.showThumbnail === true,
    showUpdatedDate: stored.showUpdatedDate === true,
  };
}

function getStorageArea(): StorageGetSet {
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    throw new Error('chrome.storage.local is unavailable');
  }
  return chrome.storage.local;
}

function storageGet(
    storageArea: StorageGetSet,
    key: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    storageArea.get(key, (result) => {
      const error = typeof chrome === 'undefined'
        ? undefined
        : chrome.runtime?.lastError;
      if (error !== undefined) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

function storageSet(
    storageArea: StorageGetSet,
    values: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea.set(values, () => {
      const error = typeof chrome === 'undefined'
        ? undefined
        : chrome.runtime?.lastError;
      if (error !== undefined) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}
