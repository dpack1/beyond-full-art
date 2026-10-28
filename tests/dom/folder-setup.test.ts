import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  FOLDER_PERMISSION_NEEDED_MESSAGE,
  FOLDER_PICKER_UNAVAILABLE_MESSAGE,
  initializeFolderSetup,
} from '../../src/folder/setup';
import type {LibraryItem} from '../../src/platform/chrome/backup-folder-decision';

describe('backup folder setup window', () => {
  afterEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('prepares the chosen folder and reports that browser art stays put', async () => {
    document.body.innerHTML = setupMarkup();
    const connect = vi.fn().mockResolvedValue({
      folderName: 'Campaign art',
      kind: 'initialized',
    });

    await initializeFolderSetup(document, {
      connect,
      pickDirectory: async () => ({name: 'Campaign art'}) as FileSystemDirectoryHandle,
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await nextTask();

    expect(connect).toHaveBeenCalledOnce();
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('nothing was moved.');
    expect(copyButton().hidden).toBe(true);
  });

  it('asks for a blank folder when the chosen one already has files', async () => {
    document.body.innerHTML = setupMarkup();
    await initializeFolderSetup(document, {
      connect: vi.fn().mockResolvedValue({kind: 'occupied'}),
      pickDirectory: async () => ({name: 'Notes'}) as FileSystemDirectoryHandle,
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await nextTask();

    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('Create a blank folder');
  });

  it('says the folder picker is blocked when this browser cannot open it', async () => {
    document.body.innerHTML = setupMarkup();
    await initializeFolderSetup(document, {
      readStoredFolder: async () => null,
    });

    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toBe(FOLDER_PICKER_UNAVAILABLE_MESSAGE);

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await nextTask();

    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toBe(FOLDER_PICKER_UNAVAILABLE_MESSAGE);
  });

  it('leaves everything in place when the picker is cancelled', async () => {
    document.body.innerHTML = setupMarkup();
    await initializeFolderSetup(document, {
      pickDirectory: async () => {
        throw new DOMException('cancelled', 'AbortError');
      },
      readStoredFolder: async () => null,
    });

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await nextTask();

    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toBe('No folder was chosen. Nothing was changed.');
  });

  it('copies into an empty folder and removes the browser copy after a second confirmation', async () => {
    document.body.innerHTML = setupMarkup();
    const directory = {name: 'Beyond-Full-Art'} as FileSystemDirectoryHandle;
    const copyLibrary = vi.fn().mockResolvedValue({
      copiedCharacterIds: ['172153137'],
      failed: [],
      notes: 2,
      photos: 1,
      skippedCharacterIds: [],
    });
    const adoptLibrary = vi.fn().mockResolvedValue({characters: 1, kind: 'removed'});
    const confirmCopy = vi.fn().mockReturnValue(true);
    const confirmRemove = vi.fn().mockReturnValue(true);

    await initializeFolderSetup(document, {
      adoptLibrary,
      confirmCopy,
      confirmRemove,
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      copyLibrary,
      listCommitted: async () => new Set(),
      pickDirectory: async () => directory,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(confirmCopy).toHaveBeenCalledOnce();
    expect(confirmRemove).toHaveBeenCalledOnce();
    expect(copyLibrary).toHaveBeenCalledWith(directory);
    expect(adoptLibrary).toHaveBeenCalledWith(directory);
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('Removed this browser\'s copies of 1 character');
    expect(copyButton().hidden).toBe(true);
  });

  it('leaves the browser copy when removal is declined', async () => {
    document.body.innerHTML = setupMarkup();
    const adoptLibrary = vi.fn();
    await initializeFolderSetup(document, {
      adoptLibrary,
      confirmCopy: () => true,
      confirmRemove: () => false,
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'initialized',
      }),
      copyLibrary: vi.fn().mockResolvedValue({
        copiedCharacterIds: ['172153137'],
        failed: [],
        notes: 2,
        photos: 1,
        skippedCharacterIds: [],
      }),
      listCommitted: async () => new Set(),
      pickDirectory: async () => ({name: 'Beyond-Full-Art'}) as FileSystemDirectoryHandle,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(adoptLibrary).not.toHaveBeenCalled();
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('still keeps its own copies');
    expect(copyButton().hidden).toBe(false);
    expect(copyButton().textContent).toBe('Remove browser copies');
  });

  it('does not copy when the confirmation is declined', async () => {
    document.body.innerHTML = setupMarkup();
    const copyLibrary = vi.fn();
    await initializeFolderSetup(document, {
      confirmCopy: () => false,
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'initialized',
      }),
      copyLibrary,
      listCommitted: async () => new Set(),
      pickDirectory: async () => ({name: 'Beyond-Full-Art'}) as FileSystemDirectoryHandle,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await nextTask();
    await nextTask();

    expect(copyLibrary).not.toHaveBeenCalled();
    expect(copyButton().hidden).toBe(false);
  });

  it('asks to remove browser copies when the folder already has characters', async () => {
    document.body.innerHTML = setupMarkup();
    const directory = {name: 'Beyond-Full-Art'} as FileSystemDirectoryHandle;
    const adoptLibrary = vi.fn().mockResolvedValue({characters: 1, kind: 'removed'});
    const copyLibrary = vi.fn();
    await initializeFolderSetup(document, {
      adoptLibrary,
      compareLibrary: async () => ({kind: 'match', siblings: []}),
      confirmRemove: () => true,
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      copyLibrary,
      listCommitted: async () => new Set(['172153137']),
      pickDirectory: async () => directory,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(copyLibrary).not.toHaveBeenCalled();
    expect(adoptLibrary).toHaveBeenCalledWith(directory);
    expect(copyButton().hidden).toBe(true);
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('New art and notes save in “Beyond-Full-Art”');
  });

  it('unions browser-only records into an existing folder after one confirmation', async () => {
    document.body.innerHTML = setupMarkup();
    const directory = {name: 'Beyond-Full-Art'} as FileSystemDirectoryHandle;
    const unionLibrary = vi.fn().mockResolvedValue({
      additions: 1,
      characters: 1,
      kind: 'complete',
      notes: 1,
      photos: 0,
    });
    const confirmCopy = vi.fn().mockReturnValue(true);
    await initializeFolderSetup(document, {
      compareLibrary: async () => ({
        additions: [{
          record: {
            characterId: '172153137',
            fingerprint: 'browser',
            id: 'note-1',
            kind: 'note',
            updatedAt: '2026-10-23T00:00:00.000Z',
          },
          side: 'browser',
        }],
        kind: 'additions',
        siblings: [],
      }),
      confirmCopy,
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      listCommitted: async () => new Set(['172153137']),
      pickDirectory: async () => directory,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
      unionLibrary,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(confirmCopy).toHaveBeenCalledOnce();
    expect(unionLibrary).toHaveBeenCalledWith(directory);
    expect(copyButton().hidden).toBe(true);
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('Added 1 record');
  });

  it('offers checked preservation choices for an art conflict', async () => {
    document.body.innerHTML = setupMarkup();
    const unionLibrary = vi.fn();
    await initializeFolderSetup(document, {
      compareLibrary: async () => ({
        additions: [],
        conflicts: [{
          browser: {
            characterId: '172153137',
            fingerprint: 'browser',
            id: 'full-art',
            kind: 'full-art',
            updatedAt: '2026-10-23T00:00:00.000Z',
          },
          folder: {
            characterId: '172153137',
            fingerprint: 'folder',
            id: 'full-art',
            kind: 'full-art',
            updatedAt: '2026-10-23T01:00:00.000Z',
          },
          reason: 'changed',
          tombstone: null,
        }],
        kind: 'conflicts',
        siblings: [],
      }),
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      listCommitted: async () => new Set(['172153137']),
      pickDirectory: async () => ({name: 'Beyond-Full-Art'}) as FileSystemDirectoryHandle,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
      unionLibrary,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(unionLibrary).not.toHaveBeenCalled();
    expect(copyButton().hidden).toBe(false);
    expect(copyButton().disabled).toBe(true);
    expect(document.querySelectorAll('input[type="radio"]')).toHaveLength(2);
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('has 1 conflict');
  });

  it('offers the lossless keep-both choice for a photo conflict', async () => {
    document.body.innerHTML = setupMarkup();
    await initializeFolderSetup(document, {
      compareLibrary: async () => ({
        additions: [],
        conflicts: [{
          browser: {
            characterId: '172153137',
            fingerprint: 'browser-photo',
            id: 'photo-1',
            kind: 'image',
            updatedAt: null,
          },
          folder: {
            characterId: '172153137',
            fingerprint: 'folder-photo',
            id: 'photo-1',
            kind: 'image',
            updatedAt: null,
          },
          reason: 'changed',
          tombstone: null,
        }],
        kind: 'conflicts',
        siblings: [],
      }),
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      listCommitted: async () => new Set(['172153137']),
      pickDirectory: async () => ({name: 'Beyond-Full-Art'}) as FileSystemDirectoryHandle,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
    });

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    const choice = document.querySelector<HTMLInputElement>('input[value="both"]');
    expect(choice).not.toBeNull();
    expect(choice?.parentElement?.textContent)
        .toContain('Keep both photos; the newer note keeps this photo id');
    expect(copyButton().disabled).toBe(true);
  });

  it('requires a choice for every note conflict before applying', async () => {
    document.body.innerHTML = setupMarkup();
    const directory = {name: 'Beyond-Full-Art'} as FileSystemDirectoryHandle;
    const resolveConflicts = vi.fn().mockResolvedValue({
      characters: 1,
      kind: 'complete',
      notes: 1,
    });
    await initializeFolderSetup(document, {
      compareLibrary: async () => ({
        additions: [],
        conflicts: [{
          browser: {
            characterId: '172153137',
            fingerprint: 'browser',
            id: 'note-1',
            kind: 'note',
            updatedAt: '2026-10-23T00:00:00.000Z',
          },
          folder: {
            characterId: '172153137',
            fingerprint: 'folder',
            id: 'note-1',
            kind: 'note',
            updatedAt: '2026-10-23T01:00:00.000Z',
          },
          reason: 'changed',
          tombstone: null,
        }],
        kind: 'conflicts',
        siblings: [],
      }),
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      listCommitted: async () => new Set(['172153137']),
      pickDirectory: async () => directory,
      readBrowserItems: async () => [browserArtItem()],
      readStoredFolder: async () => null,
      resolveConflicts,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(copyButton().disabled).toBe(true);
    expect(document.querySelector('.bfa-folder-setup__conflict-revisions')?.textContent)
        .toContain('2026-10-23T01:00:00.000Z');
    const browserChoice = document.querySelector<HTMLInputElement>('input[value="browser"]');
    if (browserChoice === null) {
      throw new Error('Missing browser-note choice');
    }
    browserChoice.checked = true;
    browserChoice.dispatchEvent(new Event('change', {bubbles: true}));
    expect(copyButton().disabled).toBe(false);
    copyButton().click();
    await flush();

    expect(resolveConflicts).toHaveBeenCalledWith(directory, {
      ['172153137\u0000note\u0000note-1']: 'browser',
    });
    expect(document.querySelector('[data-bfa-folder-conflicts]')).toBeNull();
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('Applied the conflict choices');
  });

  it('moves the setup window aside while Brave asks for access', async () => {
    document.body.innerHTML = setupMarkup();
    const order: string[] = [];
    const requestPermission = vi.fn().mockImplementation(async () => {
      order.push('request');
      expect(document.querySelector('#folder-setup-status')?.textContent)
          .toBe('Allow access in the browser question. This window moves aside until you answer.');
      return 'granted';
    });
    const directory = {
      name: 'Beyond-Full-Art',
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;
    const update = vi.fn().mockImplementation(async () => {
      order.push('update');
      return {};
    });
    vi.stubGlobal('chrome', {
      windows: {
        getCurrent: vi.fn().mockResolvedValue({
          height: 560,
          id: 7,
          left: 100,
          top: 80,
          width: 440,
        }),
        update,
      },
    });
    Object.defineProperty(window.screen, 'availWidth', {configurable: true, value: 1400});
    Object.defineProperty(window.screen, 'availHeight', {configurable: true, value: 900});
    Object.assign(window, {
      showDirectoryPicker: vi.fn().mockResolvedValue(directory),
    });

    await initializeFolderSetup(document, {
      connect: vi.fn().mockResolvedValue({
        folderName: 'Beyond-Full-Art',
        kind: 'reconnected',
      }),
      isSavingInFolder: async () => true,
      listCommitted: async () => new Set(['172153137']),
      readBrowserItems: async () => [],
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(order).toEqual(['update', 'request', 'update']);
    expect(update).toHaveBeenNthCalledWith(1, 7, {focused: false, left: 948, top: 328});
    expect(update).toHaveBeenNthCalledWith(2, 7, {
      focused: true,
      height: 560,
      left: 100,
      state: 'normal',
      top: 80,
      width: 440,
    });
    expect(requestPermission).toHaveBeenCalledWith({mode: 'readwrite'});
  });

  it('reads the saved folder once this browser allows it', async () => {
    document.body.innerHTML = setupMarkup();
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const directory = {
      name: 'Beyond-Full-Art',
      queryPermission: vi.fn().mockResolvedValue('prompt'),
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;
    const pickDirectory = vi.fn();
    await initializeFolderSetup(document, {
      isSavingInFolder: async () => true,
      listCommitted: async () => new Set(['172153137']),
      pickDirectory,
      readBrowserItems: async () => [],
      readStoredFolder: async () => ({directory, permission: 'prompt'}),
    });

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(requestPermission).toHaveBeenCalledWith({mode: 'readwrite'});
    expect(pickDirectory).not.toHaveBeenCalled();
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toBe('“Beyond-Full-Art” is where art and notes are saved. This browser is not keeping a second copy.');
  });

  it('opens the picker when the saved folder stays blocked', async () => {
    document.body.innerHTML = setupMarkup();
    const directory = {
      name: 'Beyond-Full-Art',
      queryPermission: async () => 'prompt',
      requestPermission: async () => 'prompt',
    } as unknown as FileSystemDirectoryHandle;
    const picked = {name: 'Other folder'} as FileSystemDirectoryHandle;
    const pickDirectory = vi.fn().mockResolvedValue(picked);
    const connect = vi.fn().mockResolvedValue({kind: 'occupied'});
    await initializeFolderSetup(document, {
      confirmSwitch: () => true,
      connect,
      isSavingInFolder: async () => true,
      pickDirectory,
      readStoredFolder: async () => ({directory, permission: 'prompt'}),
    });

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(pickDirectory).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledWith(picked);
  });

  it('keeps the allow-access message when the chosen folder is still blocked', async () => {
    document.body.innerHTML = setupMarkup();
    await initializeFolderSetup(document, {
      pickDirectory: async () => {
        throw new Error(FOLDER_PERMISSION_NEEDED_MESSAGE);
      },
      readStoredFolder: async () => null,
    });

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await nextTask();

    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toBe(FOLDER_PERMISSION_NEEDED_MESSAGE);
  });

  it('keeps the current library folder when a folder switch is declined', async () => {
    document.body.innerHTML = setupMarkup();
    const current = {name: 'Current folder'} as FileSystemDirectoryHandle;
    const picked = {
      isSameEntry: vi.fn().mockResolvedValue(false),
      name: 'Other folder',
    } as unknown as FileSystemDirectoryHandle;
    const connect = vi.fn();
    const confirmSwitch = vi.fn().mockReturnValue(false);
    await initializeFolderSetup(document, {
      confirmSwitch,
      connect,
      isSavingInFolder: async () => true,
      pickDirectory: async () => picked,
      readStoredFolder: async () => ({directory: current, permission: 'denied'}),
    });

    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(confirmSwitch).toHaveBeenCalledOnce();
    expect(connect).not.toHaveBeenCalled();
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toBe('Still using “Current folder”. Nothing was changed.');
  });

  it('starts saving in an empty folder when this browser has nothing', async () => {
    document.body.innerHTML = setupMarkup();
    const directory = {name: 'Campaign art'} as FileSystemDirectoryHandle;
    const adoptLibrary = vi.fn().mockResolvedValue({characters: 0, kind: 'saving-in-folder'});
    await initializeFolderSetup(document, {
      adoptLibrary,
      confirmRemove: () => true,
      connect: vi.fn().mockResolvedValue({
        folderName: 'Campaign art',
        kind: 'initialized',
      }),
      isSavingInFolder: async () => false,
      listCommitted: async () => new Set(),
      pickDirectory: async () => directory,
      readBrowserItems: async () => [],
      readStoredFolder: async () => null,
    });
    document.querySelector<HTMLButtonElement>('#folder-setup-choose')?.click();
    await flush();

    expect(adoptLibrary).toHaveBeenCalledWith(directory);
    expect(document.querySelector('#folder-setup-status')?.textContent)
        .toContain('not keeping a second copy');
  });
});

function setupMarkup(): string {
  return `
    <button id="folder-setup-choose" type="button">Choose an empty folder</button>
    <button id="folder-setup-copy" type="button" hidden>Copy into folder</button>
    <button id="folder-setup-close" type="button">Close</button>
    <p id="folder-setup-status"></p>
  `;
}

function copyButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>('#folder-setup-copy');
  if (button === null) {
    throw new Error('Missing copy button');
  }
  return button;
}

function browserArtItem(): LibraryItem {
  return {
    characterId: '172153137',
    detail: '10:2026-10-23T00:00:00.000Z',
    id: 'full-art',
    kind: 'art',
    revision: '2026-10-23T00:00:00.000Z',
  };
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function flush(): Promise<void> {
  for (let step = 0; step < 6; step += 1) {
    await nextTask();
  }
}
