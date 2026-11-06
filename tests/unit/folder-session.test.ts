import {afterEach, describe, expect, it, vi} from 'vitest';

import {
  ensureFolderSession,
  FOLDER_SESSION_PAGE,
  installFolderSessionMessages,
  markFolderSessionReady,
  FOLDER_SESSION_READY_KEY,
  touchFolderSession,
} from '../../src/platform/chrome/folder-session';

describe('folder session', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens one hidden page for the backup folder', async () => {
    const createDocument = vi.fn().mockResolvedValue(undefined);
    const hasDocument = vi.fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);
    vi.stubGlobal('chrome', {
      offscreen: {
        createDocument,
        hasDocument,
      },
    });

    await ensureFolderSession();
    await ensureFolderSession();

    expect(createDocument).toHaveBeenCalledOnce();
    expect(createDocument).toHaveBeenCalledWith({
      justification: 'Keep the backup folder open so art and notes load after a refresh.',
      reasons: ['BLOBS'],
      url: FOLDER_SESSION_PAGE,
    });
  });

  it('records a ready folder only from the hidden extension page', async () => {
    const area = {
      set: vi.fn(function (this: unknown, _values: unknown, callback: () => void) {
        if (this !== area) {
          throw new TypeError(
              'Illegal invocation: Function must be called on an object of type StorageArea',
          );
        }
        callback();
      }),
    };
    const listeners: Array<(
      message: unknown,
      sender: chrome.runtime.MessageSender,
    ) => void> = [];
    vi.stubGlobal('chrome', {
      runtime: {
        id: 'extension-id',
        onMessage: {
          addListener(listener: (
            message: unknown,
            sender: chrome.runtime.MessageSender,
          ) => void) {
            listeners.push(listener);
          },
        },
      },
      storage: {local: area},
    });
    installFolderSessionMessages();

    listeners[0]?.(
        {open: true, type: 'bfa.folder.session.ready'},
        {id: 'extension-id', url: 'https://www.dndbeyond.com/characters/1'},
    );
    await Promise.resolve();
    expect(area.set).not.toHaveBeenCalled();

    listeners[0]?.(
        {open: true, type: 'bfa.folder.session.ready'},
        {id: 'extension-id', url: 'chrome-extension://extension-id/folder/session.html'},
    );
    await Promise.resolve();
    expect(area.set).toHaveBeenCalledOnce();
  });

  it('asks the hidden page again when it is not listening yet', async () => {
    let attempts = 0;
    const runtime = {
      sendMessage: vi.fn(function (this: unknown) {
        if (this !== runtime) {
          throw new TypeError('Illegal invocation');
        }
        attempts += 1;
        if (attempts === 1) {
          return Promise.reject(new Error('The message port closed.'));
        }
        return Promise.resolve({open: true});
      }),
    };
    vi.stubGlobal('chrome', {runtime});

    await expect(touchFolderSession()).resolves.toBe(true);

    expect(runtime.sendMessage).toHaveBeenCalledTimes(2);
    expect(runtime.sendMessage).toHaveBeenCalledWith({type: 'bfa.folder.session.touch'});
  });

  it('records that the folder session is ready', async () => {
    const area = {
      set: vi.fn(function (this: unknown, _values: unknown, callback: () => void) {
        if (this !== area) {
          throw new TypeError(
              'Illegal invocation: Function must be called on an object of type StorageArea',
          );
        }
        callback();
      }),
    };
    vi.stubGlobal('chrome', {
      storage: {local: area},
    });

    await markFolderSessionReady();

    expect(area.set).toHaveBeenCalledOnce();
    const values = area.set.mock.calls[0]?.[0] as Record<string, string>;
    expect(values[FOLDER_SESSION_READY_KEY]).toEqual(expect.any(String));
  });
});
