import {
  BACKUP_FOLDER_CHARACTERS_DIRECTORY,
  readDirectoryPermission,
} from '../platform/chrome/backup-folder';
import {
  FOLDER_SESSION_HOLD_MESSAGE,
  FOLDER_SESSION_READY_MESSAGE,
  FOLDER_SESSION_RELEASE_MESSAGE,
  FOLDER_SESSION_TOUCH_MESSAGE,
} from '../platform/chrome/folder-session';
import {getStoredBackupFolder} from '../platform/chrome/indexed-db';

// Chrome ends folder access when the last extension page that holds the
// handle closes. The toolbar popup is usually that page, so a sheet refresh
// lost the folder. This hidden page stays open and keeps a handle that has
// already opened characters/.
let held: FileSystemDirectoryHandle | null = null;

async function touch(): Promise<boolean> {
  const stored = await getStoredBackupFolder();
  if (stored?.handle == null) {
    held = null;
    shareRelease();
    return false;
  }
  return openAndHold(held ?? stored.handle, stored.handle);
}

async function openAndHold(
    preferred: FileSystemDirectoryHandle | null,
    stored: FileSystemDirectoryHandle,
): Promise<boolean> {
  const candidates = preferred !== null && preferred !== stored
    ? [preferred, stored]
    : [stored];
  for (const handle of candidates) {
    const permission = await readDirectoryPermission(handle);
    if (permission === 'denied') {
      continue;
    }
    try {
      await handle.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
      held = handle;
      shareHeldFolder();
      return true;
    } catch {
      // The other copy may be the one the setup window already opened.
    }
  }
  return false;
}

function shareHeldFolder(): void {
  if (held === null || chrome.runtime?.sendMessage === undefined) {
    return;
  }
  const pending = chrome.runtime.sendMessage({
    handle: held,
    type: FOLDER_SESSION_HOLD_MESSAGE,
  });
  if (pending instanceof Promise) {
    void pending.catch(() => {
      // The service worker stores the handle when it is listening.
    });
  }
}

function shareRelease(): void {
  if (chrome.runtime?.sendMessage === undefined) {
    return;
  }
  const pending = chrome.runtime.sendMessage({type: FOLDER_SESSION_RELEASE_MESSAGE});
  if (pending instanceof Promise) {
    void pending.catch(() => {
      // Forgetting the folder still removed the saved handle.
    });
  }
}

function isDirectoryHandle(value: unknown): value is FileSystemDirectoryHandle {
  return typeof value === 'object'
    && value !== null
    && typeof (value as FileSystemDirectoryHandle).getDirectoryHandle === 'function';
}

function publish(open: boolean): void {
  const pending = chrome.runtime.sendMessage({
    open,
    type: FOLDER_SESSION_READY_MESSAGE,
  });
  if (pending instanceof Promise) {
    void pending.catch(() => {
      // The page still holds the folder when the service worker is restarting.
    });
  }
}

function waitToRetry(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// This page is often created before the popup is allowed to use the folder.
// Keep asking until characters/ opens, then hold that handle so a sheet
// refresh can read the folder after the popup closes.
async function keepFolderOpen(): Promise<void> {
  let announced = false;
  let failures = 0;
  for (;;) {
    const open = await touch();
    if (open !== announced) {
      announced = open;
      publish(open);
    }
    if (open) {
      return;
    }
    const stored = await getStoredBackupFolder();
    if (stored?.handle == null) {
      return;
    }
    const permission = await readDirectoryPermission(stored.handle);
    if (permission === 'denied') {
      return;
    }
    failures += 1;
    await waitToRetry(failures < 8 ? 250 : 2000);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (typeof message !== 'object' || message === null) {
    return;
  }
  const type = (message as {type?: unknown}).type;
  if (type === FOLDER_SESSION_RELEASE_MESSAGE) {
    held = null;
    return;
  }
  if (type === FOLDER_SESSION_HOLD_MESSAGE) {
    const handle = (message as {handle?: unknown}).handle;
    void (async () => {
      const stored = await getStoredBackupFolder();
      const open = stored?.handle == null
        ? false
        : await openAndHold(
            isDirectoryHandle(handle) ? handle : null,
            stored.handle,
        );
      publish(open);
      sendResponse({open});
    })();
    return true;
  }
  if (type !== FOLDER_SESSION_TOUCH_MESSAGE) {
    return;
  }
  void touch().then((open) => {
    publish(open);
    sendResponse({open});
  });
  return true;
});

void keepFolderOpen();
