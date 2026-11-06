import {
  BACKUP_FOLDER_CHARACTERS_DIRECTORY,
  readDirectoryPermission,
} from '../platform/chrome/backup-folder';
import {
  FOLDER_SESSION_READY_MESSAGE,
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
  const handle = stored?.handle ?? null;
  if (handle === null) {
    held = null;
    return false;
  }
  const permission = await readDirectoryPermission(handle);
  if (permission === 'denied') {
    held = null;
    return false;
  }
  try {
    await handle.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
  } catch {
    // Keep a handle that already opened the folder. A later check can fail
    // while the toolbar popup is still the page that holds the grant.
    return false;
  }
  held = handle;
  return true;
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
  if (
    typeof message !== 'object'
    || message === null
    || (message as {type?: unknown}).type !== FOLDER_SESSION_TOUCH_MESSAGE
  ) {
    return;
  }
  void touch().then((open) => {
    publish(open);
    sendResponse({open});
  });
  return true;
});

void keepFolderOpen();
