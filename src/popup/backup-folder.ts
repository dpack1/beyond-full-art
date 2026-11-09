import {
  forgetBackupFolder,
  readBackupFolderConnection,
  requestDirectoryPermission,
  type BackupFolderConnection,
  type BackupFolderPermission,
} from '../platform/chrome/backup-folder';
import {listCommittedCharacterIds} from '../platform/chrome/backup-folder-copy';
import {getStoredBackupFolder} from '../platform/chrome/indexed-db';
import {syncFolderSettings} from '../platform/chrome/folder-settings';
import {folderHolderIsOpen} from '../platform/chrome/folder-holder';
import {libraryDirectoryIsOpen} from '../platform/chrome/folder-library';
import {
  holdFolderSession,
  touchFolderSession,
} from '../platform/chrome/folder-session';
import {isFolderLibrary} from '../platform/chrome/library-mode';
import {
  readFolderLibraryStatus,
  type FolderLibraryStatus,
} from '../platform/chrome/folder-library-status';

const ERROR_CLASS_NAME = 'bfa-popup__status--error';

let storedPromptHandle: object | null = null;
let grantedInThisDocument = false;

export async function allowSavedBackupFolder(): Promise<void> {
  grantedInThisDocument = false;
  try {
    const storedPromise = getStoredBackupFolder();
    const savingPromise = isFolderLibrary();
    const stored = await storedPromise;
    if (stored === null || !await savingPromise) {
      return;
    }
    // Skip queryPermission. Waiting on that, or on chrome.storage before the
    // handle is even loaded, spends the toolbar click. The request then
    // returns prompt and the popup still looks unloaded.
    const permission = await requestDirectoryPermission(stored.handle);
    grantedInThisDocument = permission === 'granted';
  } catch {
    // The toolbar click can expire before the permission request.
  }
}

export async function installBackupFolder(doc: Document): Promise<void> {
  const choose = doc.querySelector<HTMLButtonElement>('#backup-folder-choose');
  const check = doc.querySelector<HTMLButtonElement>('#backup-folder-check');
  const forget = doc.querySelector<HTMLButtonElement>('#backup-folder-forget');
  const status = doc.querySelector<HTMLParagraphElement>('#backup-folder-status');
  if (choose === null || check === null || forget === null || status === null) {
    return;
  }

  choose.addEventListener('click', () => {
    void openSetup(choose, check, forget, status, doc);
  });
  check.addEventListener('click', () => {
    void checkFolder(check, status, doc);
  });
  forget.addEventListener('click', () => {
    void forgetConnection(check, forget, status);
  });
  await refresh(check, forget, status);
}

async function refresh(
    check: HTMLButtonElement,
    forget: HTMLButtonElement,
    status: HTMLParagraphElement,
): Promise<void> {
  try {
    let connection = await readBackupFolderConnection();
    const savingInFolder = await isFolderLibrary();
    if (
      savingInFolder
      && connection?.permission === 'prompt'
      && !grantedInThisDocument
    ) {
      await allowSavedBackupFolder();
      connection = await readBackupFolderConnection();
    }
    if (connection === null || connection.permission === 'denied') {
      grantedInThisDocument = false;
    }
    const permission = await usablePermission(connection, savingInFolder);
    storedPromptHandle = null;
    if (connection?.permission === 'prompt' && permission !== 'granted') {
      const stored = await getStoredBackupFolder();
      storedPromptHandle = stored?.handle ?? null;
    }
    const loaded = connection !== null
      && savingInFolder
      && permission === 'granted';
    forget.hidden = connection === null;
    check.hidden = !loaded;
    const choose = status.ownerDocument.querySelector<HTMLButtonElement>(
        '#backup-folder-choose',
    );
    if (choose !== null) {
      choose.textContent = storedPromptHandle !== null && savingInFolder
        ? 'Show journals'
        : 'Choose folder';
    }
    status.classList.remove(ERROR_CLASS_NAME);
    const shown = connection === null
      || permission === null
      || permission === connection.permission
      ? connection
      : {...connection, permission};
    if (loaded) {
      await holdFolderSession();
      await syncFolderSettings();
    }
    status.textContent = connectionMessage(
        shown,
        await copiedCharacterCount(shown),
        savingInFolder,
    );
  } catch {
    storedPromptHandle = null;
    grantedInThisDocument = false;
    forget.hidden = true;
    check.hidden = true;
    const choose = status.ownerDocument.querySelector<HTMLButtonElement>(
        '#backup-folder-choose',
    );
    if (choose !== null) {
      choose.textContent = 'Choose folder';
    }
    status.classList.add(ERROR_CLASS_NAME);
    status.textContent = 'The backup folder could not be checked. Art on this browser was not changed.';
  }
}

async function checkFolder(
    check: HTMLButtonElement,
    status: HTMLParagraphElement,
    doc: Document,
): Promise<void> {
  check.disabled = true;
  try {
    const stored = await getStoredBackupFolder();
    if (stored === null) {
      throw new Error('Choose the folder again before checking it.');
    }
    const result = await readFolderLibraryStatus(stored.handle);
    status.classList.remove(ERROR_CLASS_NAME);
    await syncFolderSettings();
    status.textContent = folderCheckMessage(stored.handle.name, result);
    doc.dispatchEvent(new Event('bfa-folder-checked'));
  } catch (error) {
    status.classList.add(ERROR_CLASS_NAME);
    status.textContent = error instanceof Error && error.message.trim() !== ''
      ? error.message
      : 'The folder could not be checked. Nothing was changed.';
  } finally {
    check.disabled = false;
  }
}

async function openSetup(
    choose: HTMLButtonElement,
    check: HTMLButtonElement,
    forget: HTMLButtonElement,
    status: HTMLParagraphElement,
    doc: Document,
): Promise<void> {
  choose.disabled = true;
  try {
    const handle = storedPromptHandle;
    if (handle !== null) {
      const permission = await requestDirectoryPermission(handle);
      if (permission === 'granted') {
        grantedInThisDocument = true;
        await refresh(check, forget, status);
        doc.dispatchEvent(new Event('bfa-folder-checked'));
        return;
      }
      // The folder is already chosen. A prompt means the browser did not
      // grant this click. Opening the picker again is the step that looked
      // like setup had to be started over.
      if (permission === 'prompt') {
        await refresh(check, forget, status);
        return;
      }
    }
    await openBackupFolderSetupWindow();
    status.classList.remove(ERROR_CLASS_NAME);
  } catch (error) {
    status.classList.add(ERROR_CLASS_NAME);
    status.textContent = error instanceof Error && error.message.trim() !== ''
      ? error.message
      : 'Folder setup could not be opened.';
  } finally {
    choose.disabled = false;
  }
}

async function forgetConnection(
    check: HTMLButtonElement,
    forget: HTMLButtonElement,
    status: HTMLParagraphElement,
): Promise<void> {
  const savingInFolder = await isFolderLibrary();
  const confirmed = window.confirm(savingInFolder
    ? 'Forget this backup folder on this browser? Files in the folder stay where they are. Art and notes stay in that folder, so choose it again before opening them.'
    : 'Forget this backup folder on this browser? Files in the folder stay where they are.');
  if (!confirmed) {
    return;
  }

  forget.disabled = true;
  try {
    await forgetBackupFolder();
    await touchFolderSession();
    await refresh(check, forget, status);
  } catch {
    status.classList.add(ERROR_CLASS_NAME);
    status.textContent = 'The backup folder could not be forgotten. Files in the folder were not changed.';
  } finally {
    forget.disabled = false;
  }
}

export function folderCheckMessage(
    folderName: string,
    status: FolderLibraryStatus,
): string {
  const checked = new Date(status.checkedAt).toLocaleString();
  const newest = status.newestAt === null
    ? 'No saved changes were found.'
    : `Newest folder change: ${new Date(status.newestAt).toLocaleString()}.`;
  const siblings = status.siblingCount === 0
    ? ''
    : ` ${status.siblingCount} possible Drive conflict ${status.siblingCount === 1 ? 'copy was' : 'copies were'} found.`;
  return `Checked “${folderName}” at ${checked}. ${status.characterCount} saved ${status.characterCount === 1 ? 'character' : 'characters'}. ${newest}${siblings}`;
}

export async function openBackupFolderSetupWindow(): Promise<void> {
  if (
    typeof chrome === 'undefined'
    || chrome.windows?.create === undefined
    || chrome.runtime?.getURL === undefined
  ) {
    throw new Error('Folder setup could not be opened.');
  }

  await chrome.windows.create({
    focused: true,
    height: 560,
    type: 'popup',
    url: chrome.runtime.getURL('folder/setup.html'),
    width: 440,
  });
}

export function connectionMessage(
    connection: BackupFolderConnection | null,
    copiedCharacterCount: number | null,
    savingInFolder: boolean,
): string {
  if (connection === null) {
    return 'No backup folder yet. Choose an empty folder to prepare one.';
  }
  if (connection.permission === 'denied' || connection.permission === 'prompt') {
    if (savingInFolder) {
      return `“${connection.folderName}” is connected. The folder setup window was closed, so the list could not load. Click Show journals to list the art and journals in that folder.`;
    }
  }
  if (connection.permission === 'denied') {
    return `This browser blocked “${connection.folderName}”. Choose that folder again and allow access.`;
  }
  if (connection.permission === 'prompt') {
    return `Choose “${connection.folderName}” again and allow access so this browser can write to it.`;
  }
  if (savingInFolder) {
    return `“${connection.folderName}” is connected. Journals and art in that folder show in the extension popup. Leave the folder setup window open. This browser is not keeping a second copy.`;
  }
  if (copiedCharacterCount === 0) {
    return `Connected to “${connection.folderName}”. Nothing has been copied into that folder yet.`;
  }
  if (copiedCharacterCount !== null && copiedCharacterCount > 0) {
    const label = copiedCharacterCount === 1 ? 'character' : 'characters';
    return `“${connection.folderName}” has ${copiedCharacterCount} saved ${label}. Open the folder again to remove this browser's copies and save there from now on.`;
  }
  return `Connected to “${connection.folderName}”. Art and notes still stay in this browser.`;
}

async function usablePermission(
    connection: BackupFolderConnection | null,
    savingInFolder: boolean,
): Promise<BackupFolderPermission | null> {
  if (connection === null) {
    return null;
  }
  if (
    grantedInThisDocument
    && connection.permission !== 'denied'
  ) {
    return 'granted';
  }
  if (
    !savingInFolder
    || connection.permission === 'granted'
    || connection.permission === 'denied'
  ) {
    return connection.permission;
  }
  // The service worker often still reports prompt after an extension page
  // was allowed. characters/ opening is the check that the folder can be read.
  const stored = await getStoredBackupFolder();
  if (
    stored !== null
    && await libraryDirectoryIsOpen(stored.handle, connection.permission)
  ) {
    return 'granted';
  }
  // The setup window is the page that was allowed. While it is still open it
  // reads the folder for this popup, so no second click is required.
  if (await folderHolderIsOpen()) {
    return 'granted';
  }
  if (await touchFolderSession()) {
    return 'granted';
  }
  return connection.permission;
}

async function copiedCharacterCount(
    connection: BackupFolderConnection | null,
): Promise<number | null> {
  if (
    connection === null
    || connection.permission === 'denied'
    || connection.permission === 'prompt'
  ) {
    return null;
  }
  try {
    const stored = await getStoredBackupFolder();
    if (stored === null) {
      return null;
    }
    return (await listCommittedCharacterIds(stored.handle)).size;
  } catch {
    return null;
  }
}
