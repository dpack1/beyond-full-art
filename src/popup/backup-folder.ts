import {
  forgetBackupFolder,
  readBackupFolderConnection,
  type BackupFolderConnection,
} from '../platform/chrome/backup-folder';
import {listCommittedCharacterIds} from '../platform/chrome/backup-folder-copy';
import {getStoredBackupFolder} from '../platform/chrome/indexed-db';
import {isFolderLibrary} from '../platform/chrome/library-mode';
import {
  readFolderLibraryStatus,
  type FolderLibraryStatus,
} from '../platform/chrome/folder-library-status';

const ERROR_CLASS_NAME = 'bfa-popup__status--error';

export async function installBackupFolder(doc: Document): Promise<void> {
  const choose = doc.querySelector<HTMLButtonElement>('#backup-folder-choose');
  const check = doc.querySelector<HTMLButtonElement>('#backup-folder-check');
  const forget = doc.querySelector<HTMLButtonElement>('#backup-folder-forget');
  const status = doc.querySelector<HTMLParagraphElement>('#backup-folder-status');
  if (choose === null || check === null || forget === null || status === null) {
    return;
  }

  choose.addEventListener('click', () => {
    void openSetup(choose, status);
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
    const connection = await readBackupFolderConnection();
    const savingInFolder = await isFolderLibrary();
    forget.hidden = connection === null;
    check.hidden = connection === null
      || !savingInFolder
      || connection.permission !== 'granted';
    status.classList.remove(ERROR_CLASS_NAME);
    status.textContent = connectionMessage(
        connection,
        await copiedCharacterCount(connection),
        savingInFolder,
    );
  } catch {
    forget.hidden = true;
    check.hidden = true;
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
    status: HTMLParagraphElement,
): Promise<void> {
  choose.disabled = true;
  try {
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

function connectionMessage(
    connection: BackupFolderConnection | null,
    copiedCharacterCount: number | null,
    savingInFolder: boolean,
): string {
  if (connection === null) {
    return 'No backup folder yet. Choose an empty folder to prepare one.';
  }
  if (connection.permission === 'denied' || connection.permission === 'prompt') {
    if (savingInFolder) {
      return `Choose “${connection.folderName}” again. Art and notes stay in that folder, and nothing new is saved on this browser until Chrome can use it.`;
    }
  }
  if (connection.permission === 'denied') {
    return `Chrome blocked “${connection.folderName}”. Choose that folder again to allow access.`;
  }
  if (connection.permission === 'prompt') {
    return `Choose “${connection.folderName}” again so Chrome can write to it.`;
  }
  if (savingInFolder) {
    return `“${connection.folderName}” is where art and notes are saved. This browser is not keeping a second copy.`;
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
