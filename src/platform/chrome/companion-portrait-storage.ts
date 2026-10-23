import type {CharacterId} from '../../features/character-art/art-types';

export const COMPANION_PORTRAIT_ENABLED_KEY =
  'bfa.preferences.companionPortraitEnabled';
export const COMPANION_PORTRAIT_SELECTION_KEY_PREFIX =
  'bfa.companionPortrait.selection.';

const DEFAULT_COMPANION_PORTRAIT_ENABLED = true;
export const COMPANION_PORTRAIT_SELECTION_SCHEMA_VERSION = 1;

export interface CompanionPortraitSelection {
  characterId: CharacterId;
  companionId: string;
  group: string;
  imageUrl: string;
  name: string;
  schemaVersion: typeof COMPANION_PORTRAIT_SELECTION_SCHEMA_VERSION;
  type: string | null;
  updatedAt: string;
}

export type CompanionPortraitStorageArea = Pick<
  chrome.storage.StorageArea,
  'get' | 'remove' | 'set'
>;

export async function getCompanionPortraitEnabled(
    storageArea: CompanionPortraitStorageArea = getStorageArea(),
): Promise<boolean> {
  const values = await callStorageGet(COMPANION_PORTRAIT_ENABLED_KEY, storageArea);
  const value = values[COMPANION_PORTRAIT_ENABLED_KEY];
  return typeof value === 'boolean'
    ? value
    : DEFAULT_COMPANION_PORTRAIT_ENABLED;
}

export async function setCompanionPortraitEnabled(
    enabled: boolean,
    storageArea: CompanionPortraitStorageArea = getStorageArea(),
): Promise<void> {
  await callStorageSet({[COMPANION_PORTRAIT_ENABLED_KEY]: enabled}, storageArea);
}

export async function getCompanionPortraitSelection(
    characterId: CharacterId,
    storageArea: CompanionPortraitStorageArea = getStorageArea(),
): Promise<CompanionPortraitSelection | null> {
  const key = getCompanionPortraitSelectionKey(characterId);
  const values = await callStorageGet(key, storageArea);
  const value = values[key];
  return isCompanionPortraitSelection(value) && value.characterId === characterId
    ? value
    : null;
}

export async function setCompanionPortraitSelection(
    selection: CompanionPortraitSelection,
    storageArea: CompanionPortraitStorageArea = getStorageArea(),
): Promise<void> {
  if (!isCompanionPortraitSelection(selection)) {
    throw new Error('Companion portrait selection is invalid.');
  }
  await callStorageSet({
    [getCompanionPortraitSelectionKey(selection.characterId)]: selection,
  }, storageArea);
}

export async function deleteCompanionPortraitSelection(
    characterId: CharacterId,
    storageArea: CompanionPortraitStorageArea = getStorageArea(),
): Promise<void> {
  await callStorageRemove(getCompanionPortraitSelectionKey(characterId), storageArea);
}

export function getCompanionPortraitSelectionKey(
    characterId: CharacterId,
): string {
  return `${COMPANION_PORTRAIT_SELECTION_KEY_PREFIX}${characterId}`;
}

export function isCompanionPortraitSelection(
    value: unknown,
): value is CompanionPortraitSelection {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<CompanionPortraitSelection>;
  return candidate.schemaVersion === COMPANION_PORTRAIT_SELECTION_SCHEMA_VERSION
    && isNonEmptyString(candidate.characterId)
    && isNonEmptyString(candidate.companionId)
    && isNonEmptyString(candidate.group)
    && isNonEmptyString(candidate.name)
    && (candidate.type === null || isNonEmptyString(candidate.type))
    && isSafeImageUrl(candidate.imageUrl)
    && isValidDate(candidate.updatedAt);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function isSafeImageUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDate(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

function callStorageGet(
    key: string,
    storageArea: CompanionPortraitStorageArea,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    storageArea.get(key, (value) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(value as Record<string, unknown>);
    });
  });
}

function callStorageSet(
    values: Record<string, unknown>,
    storageArea: CompanionPortraitStorageArea,
): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea.set(values, () => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}

function callStorageRemove(
    key: string,
    storageArea: CompanionPortraitStorageArea,
): Promise<void> {
  return new Promise((resolve, reject) => {
    storageArea.remove(key, () => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}

function getStorageArea(): CompanionPortraitStorageArea {
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    throw new Error('chrome.storage.local is unavailable');
  }
  return chrome.storage.local;
}
