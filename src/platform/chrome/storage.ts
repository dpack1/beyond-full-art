import type {
  CharacterArtMetadata,
  CharacterId,
} from '../../features/character-art/art-types';
import {
  CHARACTER_ART_SCHEMA_VERSION,
  isCharacterArtMetadata,
} from '../../features/character-art/art-types';

const CHARACTER_ART_SCHEMA_VERSION_KEY = 'bfa.characterArt.schemaVersion';
const CHARACTER_ART_METADATA_KEY_PREFIX = 'bfa.characterArt.metadata.';

type ChromeStorageLocal = Pick<
  chrome.storage.StorageArea,
  'get' | 'remove' | 'set'
>;

export async function getStoredCharacterArtMetadata(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<CharacterArtMetadata | null> {
  const metadataKey = getCharacterArtMetadataKey(characterId);
  const storedValues = await callStorageGet(metadataKey, storageArea);
  const metadataValue = storedValues[metadataKey];
  if (!isCharacterArtMetadata(metadataValue)) {
    return null;
  }

  return metadataValue;
}

export async function setStoredCharacterArtMetadata(
    metadata: CharacterArtMetadata,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageSet({
    [CHARACTER_ART_SCHEMA_VERSION_KEY]: CHARACTER_ART_SCHEMA_VERSION,
    [getCharacterArtMetadataKey(metadata.characterId)]: metadata,
  }, storageArea);
}

export async function deleteStoredCharacterArtMetadata(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageRemove(getCharacterArtMetadataKey(characterId), storageArea);
}

export function getCharacterArtMetadataKey(characterId: CharacterId): string {
  return `${CHARACTER_ART_METADATA_KEY_PREFIX}${characterId}`;
}

function callStorageGet(
    key: string,
    storageArea: ChromeStorageLocal,
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

function callStorageRemove(
    key: string,
    storageArea: ChromeStorageLocal,
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

function callStorageSet(
    values: Record<string, unknown>,
    storageArea: ChromeStorageLocal,
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

function getStorageArea(): ChromeStorageLocal {
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    throw new Error('chrome.storage.local is unavailable');
  }

  return chrome.storage.local;
}
