// @vitest-environment node

import {describe, expect, it} from 'vitest';

import {BACKUP_FOLDER_SETTINGS_NAME} from '../../src/platform/chrome/backup-folder';
import {
  COMPANION_PORTRAIT_SELECTION_KEY_PREFIX,
} from '../../src/platform/chrome/companion-portrait-storage';
import {
  FOLDER_SETTINGS_SYNCED_AT_KEY,
  syncFolderSettingsWithDirectory,
} from '../../src/platform/chrome/folder-settings';
import {CHARACTER_JOURNAL_ENABLED_KEY} from '../../src/platform/chrome/storage';

const PETALI = {
  characterId: '169418374',
  companionId: 'familiar-petali',
  group: 'Familiar',
  imageUrl: 'https://www.dndbeyond.com/images/petali.png',
  name: 'Petali',
  schemaVersion: 1 as const,
  type: 'Tiny Fey',
  updatedAt: '2026-10-22T00:00:00.000Z',
};

describe('folder settings', () => {
  it('writes this browser\'s settings when the folder has none', async () => {
    const folder = memoryDirectory();
    const storage = memoryStorage({
      [CHARACTER_JOURNAL_ENABLED_KEY]: false,
    });

    await syncFolderSettingsWithDirectory(
        folder.directory,
        storage.area,
        () => '2026-10-28T00:00:00.000Z',
    );

    const saved = JSON.parse(folder.files.get(BACKUP_FOLDER_SETTINGS_NAME) ?? '');
    expect(saved.characterJournalEnabled).toBe(false);
    expect(saved.updatedAt).toBe('2026-10-28T00:00:00.000Z');
    expect(storage.values[FOLDER_SETTINGS_SYNCED_AT_KEY]).toBe('2026-10-28T00:00:00.000Z');
  });

  it('applies a newer folder copy, including the companion choice', async () => {
    const folder = memoryDirectory();
    folder.files.set(BACKUP_FOLDER_SETTINGS_NAME, `${JSON.stringify({
      campaignCardPortraitUpgradeEnabled: false,
      characterJournalEnabled: true,
      companionPortraitEnabled: true,
      companions: {'169418374': PETALI},
      journalList: {showPreview: true, showThumbnail: false, showUpdatedDate: true},
      schemaVersion: 1,
      updatedAt: '2026-10-28T12:00:00.000Z',
    })}\n`);
    const storage = memoryStorage({
      [CHARACTER_JOURNAL_ENABLED_KEY]: false,
      [FOLDER_SETTINGS_SYNCED_AT_KEY]: '2026-10-28T00:00:00.000Z',
    });

    await syncFolderSettingsWithDirectory(folder.directory, storage.area);

    expect(storage.values[CHARACTER_JOURNAL_ENABLED_KEY]).toBe(true);
    expect(storage.values[`${COMPANION_PORTRAIT_SELECTION_KEY_PREFIX}169418374`])
        .toEqual(PETALI);
    expect(storage.values[FOLDER_SETTINGS_SYNCED_AT_KEY]).toBe('2026-10-28T12:00:00.000Z');
  });

  it('writes this browser\'s newer companion into the folder', async () => {
    const folder = memoryDirectory();
    folder.files.set(BACKUP_FOLDER_SETTINGS_NAME, `${JSON.stringify({
      campaignCardPortraitUpgradeEnabled: true,
      characterJournalEnabled: true,
      companionPortraitEnabled: true,
      companions: {},
      journalList: {showPreview: false, showThumbnail: false, showUpdatedDate: false},
      schemaVersion: 1,
      updatedAt: '2026-10-28T00:00:00.000Z',
    })}\n`);
    const storage = memoryStorage({
      [CHARACTER_JOURNAL_ENABLED_KEY]: false,
      [FOLDER_SETTINGS_SYNCED_AT_KEY]: '2026-10-28T12:00:00.000Z',
      [`${COMPANION_PORTRAIT_SELECTION_KEY_PREFIX}169418374`]: PETALI,
    });

    await syncFolderSettingsWithDirectory(folder.directory, storage.area);

    const saved = JSON.parse(folder.files.get(BACKUP_FOLDER_SETTINGS_NAME) ?? '');
    expect(saved.characterJournalEnabled).toBe(false);
    expect(saved.companions['169418374']).toEqual(PETALI);
    expect(storage.values[`${COMPANION_PORTRAIT_SELECTION_KEY_PREFIX}169418374`])
        .toEqual(PETALI);
  });
});

function memoryStorage(initial: Record<string, unknown>): {
  area: chrome.storage.StorageArea;
  values: Record<string, unknown>;
} {
  const values = {...initial};
  const area = {
    get(key: string | string[] | null, callback: (items: Record<string, unknown>) => void) {
      if (key === null) {
        callback({...values});
        return;
      }
      const name = Array.isArray(key) ? key[0] : key;
      callback(name === undefined || values[name] === undefined ? {} : {[name]: values[name]});
    },
    remove(keys: string | string[], callback: () => void) {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete values[key];
      }
      callback();
    },
    set(next: Record<string, unknown>, callback: () => void) {
      Object.assign(values, next);
      callback();
    },
  };
  return {area: area as unknown as chrome.storage.StorageArea, values};
}

function memoryDirectory(): {
  directory: FileSystemDirectoryHandle;
  files: Map<string, string>;
} {
  const files = new Map<string, string>();
  class MemoryDirectory {
    async getFileHandle(
        name: string,
        options?: {create?: boolean},
    ): Promise<FileSystemFileHandle> {
      if (!files.has(name)) {
        if (options?.create !== true) {
          throw new DOMException('Missing file', 'NotFoundError');
        }
        files.set(name, '');
      }
      return {
        async createWritable() {
          let next = '';
          return {
            async close() {
              files.set(name, next);
            },
            async write(data: string) {
              next = data;
            },
          } as unknown as FileSystemWritableFileStream;
        },
        async getFile() {
          return new File([files.get(name) ?? ''], name);
        },
      } as unknown as FileSystemFileHandle;
    }
  }
  return {
    directory: new MemoryDirectory() as unknown as FileSystemDirectoryHandle,
    files,
  };
}
