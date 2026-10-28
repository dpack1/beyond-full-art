import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const storageMocks = vi.hoisted(() => ({
  CHARACTER_JOURNAL_ENABLED_KEY: 'bfa.preferences.characterJournalEnabled',
  getAllRawCharacterJournalRecords: vi.fn(),
  getCampaignCardPortraitUpgradeEnabled: vi.fn(),
  getCharacterJournalEnabled: vi.fn(),
  mergeImportedCharacterJournalRecords: vi.fn(),
  readableImportedJournalRecords: vi.fn((records: unknown[]) => records),
  setCampaignCardPortraitUpgradeEnabled: vi.fn(),
  setCharacterJournalEnabled: vi.fn(),
}));
const journalMessageMocks = vi.hoisted(() => ({
  getStoredJournalImage: vi.fn(),
  putStoredJournalImage: vi.fn(),
}));
const messageMocks = vi.hoisted(() => ({
  deleteStoredCharacterArt: vi.fn(),
  getStoredCharacterArtImageData: vi.fn(),
  listStoredCharacterArtMetadata: vi.fn(),
}));
const companionStorageMocks = vi.hoisted(() => ({
  COMPANION_PORTRAIT_ENABLED_KEY: 'bfa.preferences.companionPortraitEnabled',
  getCompanionPortraitEnabled: vi.fn(),
  setCompanionPortraitEnabled: vi.fn(),
}));
const journalListPreferenceMocks = vi.hoisted(() => ({
  getJournalListPreferences: vi.fn(),
  setJournalListPreferences: vi.fn(),
}));
const storageUsageMocks = vi.hoisted(() => ({
  readExtensionStorageUsage: vi.fn(),
}));

vi.mock('../../src/platform/chrome/storage', () => storageMocks);
vi.mock('../../src/platform/chrome/messages', () => messageMocks);
vi.mock('../../src/platform/chrome/journal-messages', () => journalMessageMocks);
vi.mock(
    '../../src/platform/chrome/companion-portrait-storage',
    () => companionStorageMocks,
);
vi.mock('../../src/platform/chrome/storage-usage', () => storageUsageMocks);
vi.mock(
    '../../src/platform/chrome/journal-list-preferences',
    () => journalListPreferenceMocks,
);

import {initializePopup} from '../../src/popup/settings';
import {connectionMessage, folderCheckMessage} from '../../src/popup/backup-folder';
import * as backupFolderApi from '../../src/platform/chrome/backup-folder';
import * as indexedDbApi from '../../src/platform/chrome/indexed-db';
import {importJournalExportFile} from '../../src/popup/journal-export';
import {
  JOURNAL_EXPORT_FORMAT,
  JOURNAL_EXPORT_VERSION,
} from '../../src/features/character-journal/character-journal-export';
import {createStoredZip} from '../../src/shared/zip';

describe('popup settings', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = createPopupFixture();
    storageMocks.getCampaignCardPortraitUpgradeEnabled.mockResolvedValue(true);
    storageMocks.getAllRawCharacterJournalRecords.mockResolvedValue([]);
    storageMocks.getCharacterJournalEnabled.mockResolvedValue(true);
    storageMocks.mergeImportedCharacterJournalRecords.mockResolvedValue(undefined);
    storageMocks.setCampaignCardPortraitUpgradeEnabled.mockResolvedValue(undefined);
    storageMocks.setCharacterJournalEnabled.mockResolvedValue(undefined);
    journalListPreferenceMocks.getJournalListPreferences.mockResolvedValue({
      showPreview: false,
      showThumbnail: false,
      showUpdatedDate: false,
    });
    journalListPreferenceMocks.setJournalListPreferences.mockResolvedValue(undefined);
    companionStorageMocks.getCompanionPortraitEnabled.mockResolvedValue(true);
    companionStorageMocks.setCompanionPortraitEnabled.mockResolvedValue(undefined);
    messageMocks.deleteStoredCharacterArt.mockResolvedValue(undefined);
    messageMocks.getStoredCharacterArtImageData.mockResolvedValue(null);
    messageMocks.listStoredCharacterArtMetadata.mockResolvedValue([]);
    journalMessageMocks.getStoredJournalImage.mockResolvedValue(null);
    journalMessageMocks.putStoredJournalImage.mockResolvedValue(undefined);
    storageUsageMocks.readExtensionStorageUsage.mockResolvedValue({
      indexedDbBytes: null,
      indexedDbQuotaBytes: null,
      localBytes: null,
      localQuotaBytes: null,
    });
    URL.createObjectURL = vi.fn(() => 'blob:popup-download');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens a window to choose a backup folder', async () => {
    const create = vi.fn().mockResolvedValue({id: 1});
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
      windows: {create},
    });

    await initializePopup(document);
    document.querySelector<HTMLButtonElement>('#backup-folder-choose')?.click();
    await nextTask();

    expect(create).toHaveBeenCalledWith({
      focused: true,
      height: 560,
      type: 'popup',
      url: 'chrome-extension://test/folder/setup.html',
      width: 440,
    });
  });

  it('allows the saved folder from Choose folder without opening setup', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = {
      getDirectoryHandle: async () => {
        throw new Error('unread');
      },
      name: 'Beyond-Full-Art',
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission,
    };
    vi.spyOn(indexedDbApi, 'getStoredBackupFolder').mockResolvedValue({
      connectedAt: '2026-10-28T00:00:00.000Z',
      handle: handle as unknown as FileSystemDirectoryHandle,
      id: 'selected',
    });
    vi.spyOn(backupFolderApi, 'readBackupFolderConnection')
        .mockResolvedValueOnce({
          connectedAt: '2026-10-28T00:00:00.000Z',
          folderName: 'Beyond-Full-Art',
          permission: 'prompt',
        })
        .mockResolvedValue({
          connectedAt: '2026-10-28T00:00:00.000Z',
          folderName: 'Beyond-Full-Art',
          permission: 'granted',
        });
    const create = vi.fn().mockResolvedValue({id: 1});
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
      storage: {
        local: {
          get: (
              _key: string,
              callback: (value: Record<string, unknown>) => void,
          ) => {
            callback({'bfa.library.mode': 'folder'});
          },
          set: (_values: unknown, callback: () => void) => {
            callback();
          },
        },
      },
      windows: {create},
    });

    await initializePopup(document);
    document.querySelector<HTMLButtonElement>('#backup-folder-choose')?.click();
    await nextTask();

    expect(requestPermission).toHaveBeenCalledWith({mode: 'readwrite'});
    expect(create).not.toHaveBeenCalled();
    expect(document.querySelector('#backup-folder-status')?.textContent)
        .toBe('“Beyond-Full-Art” is where art and notes are saved. This browser is not keeping a second copy.');
  });

  it('says a selected folder is waiting for access', () => {
    expect(connectionMessage({
      connectedAt: '2026-10-28T00:00:00.000Z',
      folderName: 'Beyond-Full-Art',
      permission: 'prompt',
    }, null, true)).toBe(
        '“Beyond-Full-Art” is selected. Allow access to show the art and notes saved in that folder. Choose the folder and allow access when asked.',
    );
  });

  it('summarizes a folder check and possible Drive conflict copies', () => {
    const message = folderCheckMessage('Beyond-Full-Art', {
      characterCount: 2,
      checkedAt: '2026-10-26T18:00:00.000Z',
      newestAt: '2026-10-26T17:18:19.000Z',
      siblingCount: 1,
    });

    expect(message).toContain('Checked “Beyond-Full-Art”');
    expect(message).toContain('2 saved characters');
    expect(message).toContain('Newest folder change:');
    expect(message).toContain('1 possible Drive conflict copy was found');
  });

  it('shows notes and image storage from the two measured pools', async () => {
    storageUsageMocks.readExtensionStorageUsage.mockResolvedValue({
      indexedDbBytes: 4096,
      indexedDbQuotaBytes: 5_000_000_000,
      localBytes: 9_000_000,
      localQuotaBytes: 10_485_760,
    });

    await initializePopup(document);

    expect(document.querySelector<HTMLParagraphElement>(
        '#storage-usage-summary',
    )?.hidden).toBe(true);
    expect(document.querySelector('#storage-usage-local')?.textContent)
        .toBe('8.6 MB of 10.0 MB');
    expect(document.querySelector<HTMLProgressElement>(
        '#storage-usage-local-meter',
    )?.classList.contains('bfa-popup__storage-meter--warning')).toBe(true);
    expect(document.querySelector('#storage-usage-images')?.textContent)
        .toBe('about 4.0 KB of 4.7 GB');
  });

  it('renders an empty stored-content inventory', async () => {
    await initializePopup(document);

    expect(document.querySelector('#stored-content-summary')?.textContent)
        .toBe('No stored content.');
    expect(document.querySelector('#stored-content-empty')?.hasAttribute('hidden'))
        .toBe(false);
    expect(document.querySelectorAll('.bfa-popup__stored-art-item')).toHaveLength(0);
  });

  it('groups full art and journal actions by character', async () => {
    messageMocks.listStoredCharacterArtMetadata.mockResolvedValue([
      createMetadata({characterId: '169418375', fileName: 'Matilda.webp'}),
    ]);
    storageMocks.getAllRawCharacterJournalRecords.mockResolvedValue([{
      characterId: '169418375',
      records: [createJournalNote('169418375')],
    }]);

    await initializePopup(document);

    expect(document.querySelector('#stored-content-summary')?.textContent)
        .toBe('1 character');
    expect(document.querySelector('.bfa-popup__stored-art-title')?.textContent)
        .toBe('Matilda');
    expect([...document.querySelectorAll('.bfa-popup__button')]
        .map((element) => element.textContent))
        .toEqual([
          'Open character', 'Download', 'Delete', 'Export', 'Import',
        ]);
    expect(document.querySelector<HTMLAnchorElement>(
        '.bfa-popup__stored-art-actions a',
    )?.href).toBe('https://www.dndbeyond.com/characters/169418375');
  });

  it('downloads a stored full-art item', async () => {
    messageMocks.listStoredCharacterArtMetadata.mockResolvedValue([
      createMetadata({characterId: '169418374', fileName: 'Zurelda.png'}),
    ]);
    messageMocks.getStoredCharacterArtImageData.mockResolvedValue({
      byteBuffer: new Uint8Array([1, 2, 3]).buffer,
      fileName: 'Zurelda: full?.png',
      mimeType: 'image/png',
    });
    let clickedDownload = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function click(this: HTMLAnchorElement) {
          clickedDownload = this.download;
        },
    );

    await initializePopup(document);
    findButton('Download')?.click();
    await nextTask();

    expect(messageMocks.getStoredCharacterArtImageData)
        .toHaveBeenCalledWith('169418374');
    expect(clickedDownload).toBe('Zurelda- full-.png');
    expect(document.querySelector('#stored-content-status')?.textContent)
        .toBe('Stored full art download started.');
  });

  it('deletes a stored full-art item after confirmation', async () => {
    messageMocks.listStoredCharacterArtMetadata
        .mockResolvedValueOnce([
          createMetadata({characterId: '169418374', fileName: 'Zurelda.png'}),
        ])
        .mockResolvedValueOnce([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    await initializePopup(document);
    findButton('Delete')?.click();
    await nextTask();

    expect(messageMocks.deleteStoredCharacterArt).toHaveBeenCalledWith('169418374');
    expect(document.querySelector('#stored-content-summary')?.textContent)
        .toBe('No stored content.');
    expect(document.querySelector('#stored-content-status')?.textContent)
        .toBe('Stored full art deleted.');
  });

  it('toggles the character journal setting', async () => {
    storageMocks.getCharacterJournalEnabled.mockResolvedValue(false);

    await initializePopup(document);
    document.querySelector<HTMLInputElement>('#character-journal-enabled')?.click();
    await nextTask();

    expect(storageMocks.setCharacterJournalEnabled).toHaveBeenCalledWith(true);
    expect(document.querySelector('#character-journal-status')?.textContent)
        .toBe('Character Journal tab enabled.');
  });

  it('stores optional character journal list details independently', async () => {
    await initializePopup(document);

    document.querySelector<HTMLInputElement>('#character-journal-show-preview')?.click();
    await nextTask();

    expect(journalListPreferenceMocks.setJournalListPreferences).toHaveBeenCalledWith({
      showPreview: true,
      showThumbnail: false,
      showUpdatedDate: false,
    });
  });

  it('toggles the companion portrait setting', async () => {
    companionStorageMocks.getCompanionPortraitEnabled.mockResolvedValue(false);

    await initializePopup(document);
    document.querySelector<HTMLInputElement>('#companion-portrait-enabled')?.click();
    await nextTask();

    expect(companionStorageMocks.setCompanionPortraitEnabled).toHaveBeenCalledWith(true);
    expect(document.querySelector('#companion-portrait-status')?.textContent)
        .toBe('Companion portrait enabled.');
  });

  it('exports all journals and their photos as a ZIP', async () => {
    storageMocks.getAllRawCharacterJournalRecords.mockResolvedValue([{
      characterId: '169418374',
      records: [createJournalNote('169418374')],
    }]);
    journalMessageMocks.getStoredJournalImage.mockResolvedValue({
      byteBuffer: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'image/png',
    });
    let downloaded = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function click(this: HTMLAnchorElement) {
          downloaded = this.download;
        },
    );

    await initializePopup(document);
    document.querySelector<HTMLButtonElement>('#stored-content-export-all')?.click();
    await nextTask();

    expect(journalMessageMocks.getStoredJournalImage)
        .toHaveBeenCalledWith('bfa.journal.image.image-1');
    expect(downloaded).toMatch(
        /^beyond-full-art-journals-169418374-\d{4}-\d{2}-\d{2}\.zip$/,
    );
    expect(document.querySelector('#stored-content-status')?.textContent)
        .toBe('Journal export downloaded.');
  });

  it('imports supported notes and missing photos from a backup', async () => {
    const note = createJournalNote('169418374');
    const backup = {
      characters: [{characterId: '169418374', records: [note]}],
      exportedAt: '2026-10-22T00:00:00.000Z',
      format: JOURNAL_EXPORT_FORMAT,
      images: [{
        blobKey: 'bfa.journal.image.image-1',
        byteBase64: 'AQID',
        error: null,
        fileName: 'gate.png',
        mimeType: 'image/png',
      }],
      version: JOURNAL_EXPORT_VERSION,
    };
    const html = `<script id="bfa-journal-backup" type="application/json">${JSON.stringify(backup)}</script>`;

    const result = await importJournalExportFile(
        new File([html], 'journal.html', {type: 'text/html'}),
        document,
    );

    expect(journalMessageMocks.putStoredJournalImage).toHaveBeenCalledWith({
      blobKey: 'bfa.journal.image.image-1',
      byteBuffer: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'image/png',
    });
    expect(storageMocks.mergeImportedCharacterJournalRecords)
        .toHaveBeenCalledWith('169418374', [note]);
    expect(result).toEqual({characters: 1, missingPhotos: 0, notes: 1});
  });

  it('imports a journal ZIP with Markdown-adjacent photo files', async () => {
    const note = createJournalNote('169418374');
    const backup = {
      characters: [{characterId: '169418374', records: [note]}],
      exportedAt: '2026-10-22T00:00:00.000Z',
      format: JOURNAL_EXPORT_FORMAT,
      images: [{
        blobKey: 'bfa.journal.image.image-1',
        byteBase64: null,
        error: null,
        fileName: 'gate.png',
        mimeType: 'image/png',
        zipPath: 'characters/169418374/photos/image-1-gate.png',
      }],
      version: JOURNAL_EXPORT_VERSION,
    };
    const encoder = new TextEncoder();
    const zip = createStoredZip([
      {data: encoder.encode(JSON.stringify(backup)), path: 'backup.json'},
      {
        data: new Uint8Array([1, 2, 3]),
        path: 'characters/169418374/photos/image-1-gate.png',
      },
    ]);

    const result = await importJournalExportFile(
        new File([new Uint8Array(zip)], 'journal.zip', {type: 'application/zip'}),
        document,
    );

    expect(journalMessageMocks.putStoredJournalImage).toHaveBeenLastCalledWith({
      blobKey: 'bfa.journal.image.image-1',
      byteBuffer: new Uint8Array([1, 2, 3]).buffer,
      mimeType: 'image/png',
    });
    expect(result).toEqual({characters: 1, missingPhotos: 0, notes: 1});
  });
});

function findButton(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent === label);
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function createMetadata(options: {characterId: string; fileName: string}) {
  return {
    blobKey: `blob-${options.characterId}`,
    byteSize: 2048,
    characterId: options.characterId,
    createdAt: '2026-08-06T00:00:00.000Z',
    fileName: options.fileName,
    height: 1024,
    mimeType: 'image/png',
    schemaVersion: 1,
    updatedAt: '2026-08-07T00:00:00.000Z',
    width: 1024,
  };
}

function createJournalNote(characterId: string) {
  return {
    body: 'Met <Voss> at the gate.',
    characterId,
    createdAt: '2026-10-20T00:00:00.000Z',
    featuredImageId: 'image-1',
    id: 'note-1',
    images: [{
      altText: '',
      blobKey: 'bfa.journal.image.image-1',
      byteSize: 3,
      fileName: 'gate.png',
      height: 20,
      id: 'image-1',
      mimeType: 'image/png',
      width: 20,
    }],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title: 'Gate',
    type: 'place',
    updatedAt: '2026-10-21T00:00:00.000Z',
  };
}

function createPopupFixture(): string {
  return `
    <main>
      <input id="campaign-card-portrait-upgrade" type="checkbox">
      <p id="campaign-card-portrait-upgrade-status"></p>
      <input id="character-journal-enabled" type="checkbox">
      <input id="character-journal-show-updated-date" type="checkbox">
      <input id="character-journal-show-preview" type="checkbox">
      <input id="character-journal-show-thumbnail" type="checkbox">
      <p id="character-journal-status"></p>
      <input id="companion-portrait-enabled" type="checkbox">
      <p id="companion-portrait-status"></p>
      <p id="backup-folder-status"></p>
      <button id="backup-folder-check" type="button" hidden>Check folder</button>
      <button id="backup-folder-choose" type="button">Choose folder</button>
      <button id="backup-folder-forget" type="button" hidden>Forget folder</button>
      <p id="storage-usage-summary"></p>
      <span id="storage-usage-local"></span>
      <progress id="storage-usage-local-meter"></progress>
      <span id="storage-usage-images"></span>
      <progress id="storage-usage-images-meter"></progress>
      <p id="stored-content-summary"></p>
      <button id="stored-content-export-all" type="button">Export all journals</button>
      <button id="stored-content-import-all" type="button">Import backup</button>
      <input id="stored-content-import-file" type="file">
      <p id="stored-content-empty" hidden></p>
      <ul id="stored-content-list"></ul>
      <p id="stored-content-status"></p>
    </main>`;
}
