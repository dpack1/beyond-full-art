export const CLEANUP_PREFERENCE_KEY = 'bfa.preferences.characterDeletionCleanup';

export type CleanupPreference = 'ask' | 'delete' | 'keep';

export function normalizeCleanupPreference(value: unknown): CleanupPreference {
  return value === 'delete' || value === 'keep' || value === 'ask' ? value : 'ask';
}

export function describeCleanupPreference(preference: CleanupPreference): string {
  switch (preference) {
    case 'delete':
      return 'Stored full art is removed when that character is deleted.';
    case 'keep':
      return 'Stored full art is kept when that character is deleted.';
    case 'ask':
      return 'After a character is deleted, ask whether to remove its stored full art.';
  }
}

export async function getCleanupPreference(): Promise<CleanupPreference> {
  try {
    const stored = await storageGet(CLEANUP_PREFERENCE_KEY);
    return normalizeCleanupPreference(stored[CLEANUP_PREFERENCE_KEY]);
  } catch {
    return 'ask';
  }
}

export async function setCleanupPreference(preference: CleanupPreference): Promise<void> {
  await storageSet({[CLEANUP_PREFERENCE_KEY]: preference});
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
