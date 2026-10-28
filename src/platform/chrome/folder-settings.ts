import {
  COMPANION_PORTRAIT_ENABLED_KEY,
  COMPANION_PORTRAIT_SELECTION_KEY_PREFIX,
  isCompanionPortraitSelection,
  type CompanionPortraitSelection,
} from './companion-portrait-storage';
import {BACKUP_FOLDER_SETTINGS_NAME} from './backup-folder';
import {resolveLibrary} from './folder-library';
import {
  JOURNAL_LIST_PREFERENCES_KEY,
  normalizeJournalListPreferences,
  type JournalListPreferences,
} from './journal-list-preferences';
import {
  CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY,
  CHARACTER_JOURNAL_ENABLED_KEY,
} from './storage';

export const FOLDER_SETTINGS_SYNCED_AT_KEY = 'bfa.preferences.syncedAt';

export interface FolderSettings {
  campaignCardPortraitUpgradeEnabled: boolean;
  characterJournalEnabled: boolean;
  companionPortraitEnabled: boolean;
  companions: Record<string, CompanionPortraitSelection>;
  journalList: JournalListPreferences;
  schemaVersion: 1;
  updatedAt: string;
}

type SettingsStorage = Pick<chrome.storage.StorageArea, 'get' | 'remove' | 'set'>;

export function parseFolderSettings(value: unknown): FolderSettings | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== 1 || !isTimestamp(record.updatedAt)) {
    return null;
  }
  if (!isBoolean(record.campaignCardPortraitUpgradeEnabled)
    || !isBoolean(record.characterJournalEnabled)
    || !isBoolean(record.companionPortraitEnabled)
    || typeof record.journalList !== 'object'
    || record.journalList === null) {
    return null;
  }
  const companions = parseCompanions(record.companions);
  if (companions === null) {
    return null;
  }
  return {
    campaignCardPortraitUpgradeEnabled: record.campaignCardPortraitUpgradeEnabled,
    characterJournalEnabled: record.characterJournalEnabled,
    companionPortraitEnabled: record.companionPortraitEnabled,
    companions,
    journalList: normalizeJournalListPreferences(record.journalList),
    schemaVersion: 1,
    updatedAt: record.updatedAt,
  };
}

export async function syncFolderSettings(): Promise<void> {
  try {
    const library = await resolveLibrary();
    if (library.kind !== 'ready') {
      return;
    }
    await syncFolderSettingsWithDirectory(library.directory, chrome.storage.local);
  } catch {
    // A folder that cannot be written leaves this browser's settings in place.
  }
}

export function installFolderSettingsSync(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !settingsChanged(changes)) {
      return;
    }
    void publishFolderSettings();
  });
  void syncFolderSettings();
}

export async function syncFolderSettingsWithDirectory(
    directory: FileSystemDirectoryHandle,
    storage: SettingsStorage,
    now: () => string = () => new Date().toISOString(),
): Promise<void> {
  const local = await readLocalSettings(storage);
  const file = await readFolderSettings(directory);
  const localTime = Date.parse(local.updatedAt);
  const fileTime = file === null ? Number.NaN : Date.parse(file.updatedAt);
  if (file === null || (Number.isFinite(localTime) && localTime > fileTime)) {
    const next = {...local, updatedAt: Number.isFinite(localTime) ? local.updatedAt : now()};
    await writeFolderSettings(directory, next);
    await storageSet(storage, {[FOLDER_SETTINGS_SYNCED_AT_KEY]: next.updatedAt});
    return;
  }
  if (!Number.isFinite(localTime) || fileTime > localTime) {
    await applyFolderSettings(storage, file);
  }
}

async function publishFolderSettings(): Promise<void> {
  try {
    const library = await resolveLibrary();
    if (library.kind !== 'ready') {
      return;
    }
    const storage = chrome.storage.local;
    const local = await readLocalSettings(storage);
    const file = await readFolderSettings(library.directory);
    const next = {...local, updatedAt: new Date().toISOString()};
    if (file !== null && sameSettings(file, next)) {
      return;
    }
    await writeFolderSettings(library.directory, next);
    await storageSet(storage, {[FOLDER_SETTINGS_SYNCED_AT_KEY]: next.updatedAt});
  } catch {
    // The toggle stays on this browser when the folder write fails.
  }
}

async function readLocalSettings(storage: SettingsStorage): Promise<FolderSettings> {
  const values = await storageGet(storage, null);
  const companions: Record<string, CompanionPortraitSelection> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith(COMPANION_PORTRAIT_SELECTION_KEY_PREFIX)) {
      continue;
    }
    if (isCompanionPortraitSelection(value)) {
      companions[value.characterId] = value;
    }
  }
  const syncedAt = values[FOLDER_SETTINGS_SYNCED_AT_KEY];
  return {
    campaignCardPortraitUpgradeEnabled: booleanPref(
        values[CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY],
        true,
    ),
    characterJournalEnabled: booleanPref(values[CHARACTER_JOURNAL_ENABLED_KEY], true),
    companionPortraitEnabled: booleanPref(values[COMPANION_PORTRAIT_ENABLED_KEY], true),
    companions,
    journalList: normalizeJournalListPreferences(values[JOURNAL_LIST_PREFERENCES_KEY]),
    schemaVersion: 1,
    updatedAt: isTimestamp(syncedAt) ? syncedAt : '',
  };
}

async function applyFolderSettings(
    storage: SettingsStorage,
    settings: FolderSettings,
): Promise<void> {
  const current = await storageGet(storage, null);
  const stale = Object.keys(current).filter((key) => {
    if (!key.startsWith(COMPANION_PORTRAIT_SELECTION_KEY_PREFIX)) {
      return false;
    }
    const characterId = key.slice(COMPANION_PORTRAIT_SELECTION_KEY_PREFIX.length);
    return settings.companions[characterId] === undefined;
  });
  if (stale.length > 0) {
    await storageRemove(storage, stale);
  }
  const next: Record<string, unknown> = {
    [CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY]: settings.campaignCardPortraitUpgradeEnabled,
    [CHARACTER_JOURNAL_ENABLED_KEY]: settings.characterJournalEnabled,
    [COMPANION_PORTRAIT_ENABLED_KEY]: settings.companionPortraitEnabled,
    [JOURNAL_LIST_PREFERENCES_KEY]: settings.journalList,
    [FOLDER_SETTINGS_SYNCED_AT_KEY]: settings.updatedAt,
  };
  for (const selection of Object.values(settings.companions)) {
    next[`${COMPANION_PORTRAIT_SELECTION_KEY_PREFIX}${selection.characterId}`] = selection;
  }
  await storageSet(storage, next);
}

async function readFolderSettings(
    directory: FileSystemDirectoryHandle,
): Promise<FolderSettings | null> {
  try {
    const handle = await directory.getFileHandle(BACKUP_FOLDER_SETTINGS_NAME);
    return parseFolderSettings(JSON.parse(await (await handle.getFile()).text()));
  } catch {
    return null;
  }
}

async function writeFolderSettings(
    directory: FileSystemDirectoryHandle,
    settings: FolderSettings,
): Promise<void> {
  const handle = await directory.getFileHandle(BACKUP_FOLDER_SETTINGS_NAME, {create: true});
  const writable = await handle.createWritable();
  await writable.write(`${JSON.stringify(settings, null, 2)}\n`);
  await writable.close();
}

function sameSettings(left: FolderSettings, right: FolderSettings): boolean {
  const rest = ({updatedAt: _updatedAt, ...body}: FolderSettings) => body;
  return JSON.stringify(rest(left)) === JSON.stringify(rest(right));
}

function settingsChanged(
    changes: Record<string, chrome.storage.StorageChange>,
): boolean {
  return Object.keys(changes).some((key) =>
    key === CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY
    || key === CHARACTER_JOURNAL_ENABLED_KEY
    || key === COMPANION_PORTRAIT_ENABLED_KEY
    || key === JOURNAL_LIST_PREFERENCES_KEY
    || key.startsWith(COMPANION_PORTRAIT_SELECTION_KEY_PREFIX));
}

function parseCompanions(value: unknown): Record<string, CompanionPortraitSelection> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const companions: Record<string, CompanionPortraitSelection> = {};
  for (const [characterId, selection] of Object.entries(value)) {
    if (!isCompanionPortraitSelection(selection) || selection.characterId !== characterId) {
      return null;
    }
    companions[characterId] = selection;
  }
  return companions;
}

function booleanPref(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function storageGet(
    storage: SettingsStorage,
    key: string | null,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    storage.get(key, (result) => {
      const error = runtimeError();
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve(result);
    });
  });
}

function storageSet(
    storage: SettingsStorage,
    values: Record<string, unknown>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.set(values, () => {
      const error = runtimeError();
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function storageRemove(storage: SettingsStorage, keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.remove(keys, () => {
      const error = runtimeError();
      if (error !== undefined) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function runtimeError(): Error | undefined {
  if (typeof chrome === 'undefined') {
    return undefined;
  }
  const message = chrome.runtime?.lastError?.message;
  return message === undefined ? undefined : new Error(message);
}
