import type {
  CharacterArtMetadata,
  CharacterId,
  CharacterPortraitCropMetadata,
} from '../../features/character-art/art-types';
import {
  CHARACTER_ART_SCHEMA_VERSION,
  isCharacterArtMetadata,
  CHARACTER_PORTRAIT_CROP_SCHEMA_VERSION,
  isCharacterPortraitCropMetadata,
} from '../../features/character-art/art-types';
import type {CharacterJournalEntry} from '../../features/character-journal/character-journal-types';
import {
  CHARACTER_JOURNAL_SCHEMA_VERSION,
  JOURNAL_NOTE_SCHEMA_VERSION,
  isCharacterJournalEntry,
  isJournalNote,
  type JournalNote,
} from '../../features/character-journal/character-journal-types';
import {
  countUnreadableJournalRecords,
  mergeJournalEntry,
  mergeJournalRecord,
  omitJournalEntry,
  readJournalRecordArray,
} from '../../features/character-journal/character-journal-records';

const CHARACTER_ART_SCHEMA_VERSION_KEY = 'bfa.characterArt.schemaVersion';
const CHARACTER_ART_METADATA_KEY_PREFIX = 'bfa.characterArt.metadata.';
const CHARACTER_PORTRAIT_CROP_METADATA_KEY_PREFIX = 'bfa.characterArt.cropMetadata.';
const CHARACTER_PORTRAIT_CROP_SCHEMA_VERSION_KEY =
  'bfa.characterArt.cropSchemaVersion';
const CHARACTER_JOURNAL_SCHEMA_VERSION_KEY =
  'bfa.characterJournal.schemaVersion';
const CHARACTER_JOURNAL_ENTRIES_KEY_PREFIX =
  'bfa.characterJournal.entries.';
const CHARACTER_JOURNAL_BACKUP_KEY_PREFIX =
  'bfa.characterJournal.backup.v1.';
export const CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY =
  'bfa.preferences.campaignCardPortraitUpgradeEnabled';
export const CHARACTER_JOURNAL_ENABLED_KEY =
  'bfa.preferences.characterJournalEnabled';
const DEFAULT_CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED = true;
const DEFAULT_CHARACTER_JOURNAL_ENABLED = true;
const JOURNAL_WRITE_ATTEMPTS = 4;

type ChromeStorageLocal = Pick<
  chrome.storage.StorageArea,
  'get' | 'remove' | 'set'
>;

export interface StoredCharacterJournalRecords {
  characterId: CharacterId;
  records: unknown[];
}

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

export async function getAllStoredCharacterArtMetadata(
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<CharacterArtMetadata[]> {
  const storedValues = await callStorageGetAll(storageArea);
  return Object.entries(storedValues)
      .filter(([key]) => key.startsWith(CHARACTER_ART_METADATA_KEY_PREFIX))
      .map(([, value]) => value)
      .filter(isCharacterArtMetadata)
      .sort((left, right) => {
        const updatedComparison =
          right.updatedAt.localeCompare(left.updatedAt);
        return updatedComparison === 0
          ? left.characterId.localeCompare(right.characterId)
          : updatedComparison;
      });
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

export async function getStoredCharacterPortraitCropMetadata(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<CharacterPortraitCropMetadata | null> {
  const metadataKey = getCharacterPortraitCropMetadataKey(characterId);
  const storedValues = await callStorageGet(metadataKey, storageArea);
  const metadataValue = storedValues[metadataKey];
  if (!isCharacterPortraitCropMetadata(metadataValue)) {
    return null;
  }

  return metadataValue;
}

export async function setStoredCharacterPortraitCropMetadata(
    metadata: CharacterPortraitCropMetadata,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageSet({
    [CHARACTER_PORTRAIT_CROP_SCHEMA_VERSION_KEY]:
      CHARACTER_PORTRAIT_CROP_SCHEMA_VERSION,
    [getCharacterPortraitCropMetadataKey(metadata.characterId)]: metadata,
  }, storageArea);
}

export async function deleteStoredCharacterArtMetadata(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageRemove(getCharacterArtMetadataKey(characterId), storageArea);
}

export async function deleteStoredCharacterPortraitCropMetadata(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageRemove(
      getCharacterPortraitCropMetadataKey(characterId),
      storageArea,
  );
}

export async function getCharacterJournalEntries(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<CharacterJournalEntry[]> {
  const records = await readCharacterJournalRecords(characterId, storageArea);

  return records
      .filter(isCharacterJournalEntry)
      .filter((entry) => entry.characterId === characterId)
      .sort(compareCharacterJournalEntries);
}

export async function countUnreadableCharacterJournalEntries(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<number> {
  const records = await readCharacterJournalRecords(characterId, storageArea);
  return countUnreadableJournalRecords(records);
}

export async function setCharacterJournalEntry(
    entry: CharacterJournalEntry,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await updateCharacterJournalRecords(
      entry.characterId,
      (records) => mergeJournalEntry(records, entry),
      storageArea,
  );
}

export async function deleteCharacterJournalEntry(
    characterId: CharacterId,
    entryId: string,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await updateCharacterJournalRecords(
      characterId,
      (records) => omitJournalEntry(records, entryId),
      storageArea,
  );
}

export async function getCampaignCardPortraitUpgradeEnabled(
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<boolean> {
  const storedValues = await callStorageGet(
      CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY,
      storageArea,
  );
  const storedValue = storedValues[CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY];
  return typeof storedValue === 'boolean'
    ? storedValue
    : DEFAULT_CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED;
}

export async function setCampaignCardPortraitUpgradeEnabled(
    enabled: boolean,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageSet({
    [CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY]: enabled,
  }, storageArea);
}

export async function getCharacterJournalEnabled(
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<boolean> {
  const storedValues = await callStorageGet(
      CHARACTER_JOURNAL_ENABLED_KEY,
      storageArea,
  );
  const storedValue = storedValues[CHARACTER_JOURNAL_ENABLED_KEY];
  return typeof storedValue === 'boolean'
    ? storedValue
    : DEFAULT_CHARACTER_JOURNAL_ENABLED;
}

export async function setCharacterJournalEnabled(
    enabled: boolean,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await callStorageSet({
    [CHARACTER_JOURNAL_ENABLED_KEY]: enabled,
  }, storageArea);
}

export function getCharacterArtMetadataKey(characterId: CharacterId): string {
  return `${CHARACTER_ART_METADATA_KEY_PREFIX}${characterId}`;
}

export function getCharacterPortraitCropMetadataKey(
    characterId: CharacterId,
): string {
  return `${CHARACTER_PORTRAIT_CROP_METADATA_KEY_PREFIX}${characterId}`;
}

export function getCharacterJournalEntriesKey(characterId: CharacterId): string {
  return `${CHARACTER_JOURNAL_ENTRIES_KEY_PREFIX}${characterId}`;
}

export function getCharacterJournalBackupKey(characterId: CharacterId): string {
  return `${CHARACTER_JOURNAL_BACKUP_KEY_PREFIX}${characterId}`;
}

export async function readRawCharacterJournalRecords(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<unknown[]> {
  return readCharacterJournalRecords(characterId, storageArea);
}

export async function getAllRawCharacterJournalRecords(
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<StoredCharacterJournalRecords[]> {
  const storedValues = await callStorageGetAll(storageArea);
  return Object.entries(storedValues)
      .filter(([key]) => key.startsWith(CHARACTER_JOURNAL_ENTRIES_KEY_PREFIX))
      .map(([key, value]) => ({
        characterId: key.slice(CHARACTER_JOURNAL_ENTRIES_KEY_PREFIX.length),
        records: readJournalRecordArray(value),
      }))
      .filter((journal) => journal.characterId !== '' && journal.records.length > 0)
      .sort((left, right) => left.characterId.localeCompare(right.characterId));
}


export async function mergeImportedCharacterJournalRecords(
    characterId: CharacterId,
    imported: readonly (CharacterJournalEntry | JournalNote)[],
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  const matching = imported.filter((record) => record.characterId === characterId);
  if (matching.length === 0) {
    return;
  }

  await updateCharacterJournalRecords(characterId, (records) => {
    return matching.reduce<unknown[]>((next, record) =>
      mergeJournalRecord(next, record), [...records]);
  }, storageArea, JOURNAL_NOTE_SCHEMA_VERSION);
}

export function readableImportedJournalRecords(
    records: readonly unknown[],
): (CharacterJournalEntry | JournalNote)[] {
  return records.filter((record): record is CharacterJournalEntry | JournalNote =>
    isCharacterJournalEntry(record) || isJournalNote(record));
}


export async function updateJournalNoteRecords(
    characterId: CharacterId,
    update: (records: readonly unknown[]) => unknown[],
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  await updateCharacterJournalRecords(
      characterId,
      update,
      storageArea,
      JOURNAL_NOTE_SCHEMA_VERSION,
  );
}

export async function ensureJournalV1Backup(
    characterId: CharacterId,
    records: readonly unknown[],
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<'failed' | 'ready'> {
  const backupKey = getCharacterJournalBackupKey(characterId);
  const stored = await callStorageGet(backupKey, storageArea);
  if (stored[backupKey] !== undefined) {
    return 'ready';
  }

  try {
    await callStorageSet({[backupKey]: [...records]}, storageArea);
    return 'ready';
  } catch {
    return 'failed';
  }
}

export async function restoreJournalV1Backup(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal = getStorageArea(),
): Promise<void> {
  const backupKey = getCharacterJournalBackupKey(characterId);
  const stored = await callStorageGet(backupKey, storageArea);
  const backup = stored[backupKey];
  if (backup === undefined) {
    throw new Error('Journal backup is missing.');
  }

  await callStorageSet({
    [getCharacterJournalEntriesKey(characterId)]: backup,
  }, storageArea);
}

async function readCharacterJournalRecords(
    characterId: CharacterId,
    storageArea: ChromeStorageLocal,
): Promise<unknown[]> {
  const entriesKey = getCharacterJournalEntriesKey(characterId);
  const storedValues = await callStorageGet(entriesKey, storageArea);
  return readJournalRecordArray(storedValues[entriesKey]);
}

async function updateCharacterJournalRecords(
    characterId: CharacterId,
    update: (records: readonly unknown[]) => unknown[],
    storageArea: ChromeStorageLocal,
    schemaVersion: number = CHARACTER_JOURNAL_SCHEMA_VERSION,
): Promise<void> {
  const entriesKey = getCharacterJournalEntriesKey(characterId);
  for (let attempt = 0; attempt < JOURNAL_WRITE_ATTEMPTS; attempt += 1) {
    const before = await readCharacterJournalRecords(characterId, storageArea);
    const nextRecords = update(before);
    await callStorageSet({
      [CHARACTER_JOURNAL_SCHEMA_VERSION_KEY]: schemaVersion,
      [entriesKey]: nextRecords,
    }, storageArea);
    const after = await readCharacterJournalRecords(characterId, storageArea);
    if (JSON.stringify(nextRecords) === JSON.stringify(after)) {
      return;
    }
  }

  throw new Error(
      'Journal storage changed during save. Try again. Your text is still here.',
  );
}

function compareCharacterJournalEntries(
    left: CharacterJournalEntry,
    right: CharacterJournalEntry,
): number {
  const updatedComparison = right.updatedAt.localeCompare(left.updatedAt);
  return updatedComparison === 0
    ? left.id.localeCompare(right.id)
    : updatedComparison;
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

function callStorageGetAll(
    storageArea: ChromeStorageLocal,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    storageArea.get(null, (value) => {
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
