import setupStyles from './setup.css?raw';
import {
  BACKUP_FOLDER_PICKER_ID,
  connectBackupFolder,
  readDirectoryPermission,
  requestDirectoryPermission,
  type BackupFolderPermission,
  type ConnectBackupFolderResult,
} from '../platform/chrome/backup-folder';
import {
  decideLibraryConnection,
  libraryDecisionMessage,
  readBrowserLibraryItems,
  type LibraryItem,
} from '../platform/chrome/backup-folder-decision';
import {
  copyBrowserLibraryIntoFolder,
  copyResultMessage,
  listCommittedCharacterIds,
} from '../platform/chrome/backup-folder-copy';
import {
  adoptFolderLibrary,
  describeAdoptResult,
} from '../platform/chrome/folder-library-adopt';
import {
  compareBrowserLibraryToFolder,
} from '../platform/chrome/folder-library-snapshot';
import type {LibraryComparison} from '../platform/chrome/folder-library-compare';
import {
  describeUnionResult,
  unionBrowserLibraryIntoFolder,
} from '../platform/chrome/folder-library-union';
import {
  conflictChoices,
  conflictChoiceKey,
  resolveFolderConflicts,
  type ConflictChoice,
  type ResolveFolderConflictsResult,
} from '../platform/chrome/folder-library-conflicts';
import {installFolderHolder} from '../platform/chrome/folder-holder';
import {handFolderToSession, holdFolderSession} from '../platform/chrome/folder-session';
import {getStoredBackupFolder} from '../platform/chrome/indexed-db';
import {syncFolderSettings} from '../platform/chrome/folder-settings';
import {isFolderLibrary} from '../platform/chrome/library-mode';

const STYLE_ATTRIBUTE_NAME = 'data-bfa-folder-setup-styles';
const JOURNALS_SHOW_IN_POPUP = 'Journals and art in that folder show in the extension popup.';
const SETUP_STAYS_OPEN = 'Leave this window open so the popup can keep listing them.';

let folderReady = false;

export const FOLDER_PICKER_UNAVAILABLE_MESSAGE =
  'The folder picker did not open. Chrome, Edge, and Opera allow it with no extra setting. Brave blocks it until you open brave://flags/#file-system-access-api, set File System Access API to Enabled, and relaunch Brave. In another Chromium browser, open its flags page, search for File System Access API, set it to Enabled if it is listed, and relaunch. Then choose the folder again. Nothing was changed.';

export const FOLDER_PERMISSION_NEEDED_MESSAGE =
  'This browser has not allowed the folder yet. Choose it again and allow access when asked. Nothing was changed.';

interface StoredFolderAccess {
  directory: FileSystemDirectoryHandle;
  permission: BackupFolderPermission;
}

interface FolderSetupActions {
  adoptLibrary: typeof adoptFolderLibrary;
  compareLibrary: (directory: FileSystemDirectoryHandle) => Promise<LibraryComparison>;
  confirmCopy: (message: string) => boolean;
  confirmRemove: (message: string) => boolean;
  confirmSwitch: (message: string) => boolean;
  connect: typeof connectBackupFolder;
  copyLibrary: typeof copyBrowserLibraryIntoFolder;
  isSavingInFolder: () => Promise<boolean>;
  listCommitted: typeof listCommittedCharacterIds;
  pickDirectory: () => Promise<FileSystemDirectoryHandle>;
  readBrowserItems: () => Promise<LibraryItem[]>;
  readStoredFolder: () => Promise<StoredFolderAccess | null>;
  resolveConflicts: typeof resolveFolderConflicts;
  unionLibrary: typeof unionBrowserLibraryIntoFolder;
}

void initializeFolderSetup(document);

export async function initializeFolderSetup(
    doc: Document,
    options: Partial<FolderSetupActions> = {},
): Promise<void> {
  folderReady = false;
  ensureStyles(doc);
  const choose = doc.querySelector<HTMLButtonElement>('#folder-setup-choose');
  const copy = doc.querySelector<HTMLButtonElement>('#folder-setup-copy');
  const close = doc.querySelector<HTMLButtonElement>('#folder-setup-close');
  const status = doc.querySelector<HTMLParagraphElement>('#folder-setup-status');
  if (choose === null || copy === null || close === null || status === null) {
    return;
  }

  const actions = resolveActions(options);
  if (options.pickDirectory === undefined && !canShowDirectoryPicker(doc.defaultView)) {
    status.textContent = FOLDER_PICKER_UNAVAILABLE_MESSAGE;
  }
  let generation = 0;
  close.addEventListener('click', () => {
    if (folderReady) {
      void revealJournalPopup();
      return;
    }
    window.close();
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !close.disabled) {
      if (folderReady) {
        void revealJournalPopup();
        return;
      }
      window.close();
    }
  });
  choose.addEventListener('click', () => {
    const ticket = ++generation;
    close.disabled = true;
    void chooseFolder(
        () => ticket === generation,
        choose,
        copy,
        status,
        actions,
    ).finally(() => {
      close.disabled = false;
    });
  });
  const opened = generation;
  await offerStoredFolder(() => opened === generation, copy, status, actions);
  choose.focus();
}

function resolveActions(options: Partial<FolderSetupActions>): FolderSetupActions {
  return {
    adoptLibrary: options.adoptLibrary ?? adoptFolderLibrary,
    compareLibrary: options.compareLibrary ?? compareBrowserLibraryToFolder,
    confirmCopy: options.confirmCopy ?? ((message) => window.confirm(message)),
    confirmRemove: options.confirmRemove ?? ((message) => window.confirm(message)),
    confirmSwitch: options.confirmSwitch ?? ((message) => window.confirm(message)),
    connect: options.connect ?? connectBackupFolder,
    copyLibrary: options.copyLibrary ?? copyBrowserLibraryIntoFolder,
    isSavingInFolder: options.isSavingInFolder ?? (() => isFolderLibrary()),
    listCommitted: options.listCommitted ?? listCommittedCharacterIds,
    pickDirectory: options.pickDirectory ?? pickBackupDirectory,
    readBrowserItems: options.readBrowserItems ?? readBrowserLibraryItems,
    readStoredFolder: options.readStoredFolder ?? readStoredFolderAccess,
    resolveConflicts: options.resolveConflicts ?? resolveFolderConflicts,
    unionLibrary: options.unionLibrary ?? unionBrowserLibraryIntoFolder,
  };
}

async function chooseFolder(
    current: () => boolean,
    choose: HTMLButtonElement,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    actions: FolderSetupActions,
): Promise<void> {
  choose.disabled = true;
  copy.hidden = true;
  status.classList.remove('bfa-folder-setup__status--error');
  try {
    const restored = await restoredPromptFolder(actions);
    if (restored !== null) {
      if (!current()) {
        return;
      }
      await presentFolder(
          current,
          choose,
          copy,
          status,
          restored,
          restored.name,
          'reconnected',
          actions,
      );
      return;
    }
    const directory = await actions.pickDirectory();
    if (await actions.isSavingInFolder()) {
      const stored = await actions.readStoredFolder();
      if (stored !== null && !await sameDirectory(directory, stored.directory)) {
        const confirmed = actions.confirmSwitch(
            `Switch from “${stored.directory.name}” to “${directory.name}”? Files in the current folder stay there. This browser will read and write the new folder instead.`,
        );
        if (!confirmed) {
          status.textContent = `Still using “${stored.directory.name}”. Nothing was changed.`;
          return;
        }
      }
    }
    const result = await actions.connect(directory);
    if (!current()) {
      return;
    }
    if (result.kind === 'initialized' || result.kind === 'reconnected') {
      await presentFolder(
          current,
          choose,
          copy,
          status,
          directory,
          result.folderName,
          result.kind,
          actions,
      );
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = stoppedMessage(result);
  } catch (error) {
    if (!current()) {
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = folderChoiceFailureMessage(error);
  } finally {
    if (current()) {
      choose.disabled = false;
    }
  }
}

async function restoredPromptFolder(
    actions: FolderSetupActions,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const stored = await actions.readStoredFolder();
    if (stored === null || stored.permission !== 'prompt') {
      return null;
    }
    const permission = await allowDirectory(stored.directory);
    return permission === 'granted' || permission === 'unknown'
      ? stored.directory
      : null;
  } catch {
    return null;
  }
}

async function sameDirectory(
    left: FileSystemDirectoryHandle,
    right: FileSystemDirectoryHandle,
): Promise<boolean> {
  const isSameEntry = (left as FileSystemDirectoryHandle & {
    isSameEntry?: (other: FileSystemHandle) => Promise<boolean>;
  }).isSameEntry;
  if (typeof isSameEntry !== 'function') {
    return false;
  }
  try {
    return await isSameEntry.call(left, right);
  } catch {
    return false;
  }
}

async function offerStoredFolder(
    current: () => boolean,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    actions: FolderSetupActions,
): Promise<void> {
  let stored: StoredFolderAccess | null;
  try {
    stored = await actions.readStoredFolder();
  } catch {
    return;
  }
  if (!current() || stored === null) {
    return;
  }
  if (stored.permission === 'prompt') {
    status.textContent = `“${stored.directory.name}” is selected. Choose it and allow access when asked. Nothing was changed.`;
    return;
  }
  if (stored.permission === 'denied') {
    status.textContent = `This browser blocked “${stored.directory.name}”. Choose it again and allow access. Nothing was changed.`;
    return;
  }
  await presentFolder(
      current,
      null,
      copy,
      status,
      stored.directory,
      stored.directory.name,
      'reconnected',
      actions,
  );
}

async function presentFolder(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    kind: 'initialized' | 'reconnected',
    actions: FolderSetupActions,
): Promise<void> {
  clearConflictReview(status);
  // This window is the document Chrome allowed. Keep that directory here and
  // answer folder reads for the popup and the service worker.
  installFolderHolder(directory);
  await handFolderToSession(directory);
  let items: LibraryItem[];
  try {
    items = await actions.readBrowserItems();
  } catch {
    if (!current()) {
      return;
    }
    copy.hidden = true;
    status.classList.remove('bfa-folder-setup__status--error');
    status.textContent = kind === 'initialized'
      ? `“${folderName}” is ready. This browser's art could not be checked, so nothing was moved.`
      : `“${folderName}” was connected. This browser's art could not be checked, so nothing was changed.`;
    return;
  }

  let committed: Set<string>;
  try {
    committed = await actions.listCommitted(directory);
  } catch {
    if (!current()) {
      return;
    }
    copy.hidden = true;
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = 'Choose the folder again before continuing. Nothing was changed.';
    return;
  }
  if (!current()) {
    return;
  }
  if (committed.size > 0) {
    status.classList.remove('bfa-folder-setup__status--error');
    if (await actions.isSavingInFolder()) {
      status.textContent = savingInFolderMessage(folderName);
      await markFolderReady(choose, copy, status);
      return;
    }
    let comparison: LibraryComparison;
    try {
      comparison = await actions.compareLibrary(directory);
    } catch {
      copy.hidden = true;
      status.classList.add('bfa-folder-setup__status--error');
      status.textContent = `“${folderName}” and this browser could not be compared. Nothing was changed.`;
      return;
    }
    if (comparison.kind === 'conflicts') {
      presentConflictReview(
          current,
          choose,
          copy,
          status,
          directory,
          folderName,
          comparison,
          actions,
      );
      return;
    }
    if (comparison.kind === 'additions') {
      const fromBrowser = comparison.additions.filter((item) => item.side === 'browser').length;
      const fromFolder = comparison.additions.filter((item) => item.side === 'folder').length;
      status.textContent = `“${folderName}” can add ${fromBrowser} ${fromBrowser === 1 ? 'record' : 'records'} from this browser${fromFolder === 0 ? '' : ` and keep ${fromFolder} folder-only ${fromFolder === 1 ? 'record' : 'records'}`}.${siblingMessage(comparison)}`;
      await runUnion(current, choose, copy, status, directory, folderName, actions, fromBrowser);
      return;
    }
    const hasLocal = items.length > 0;
    const siblingNotice = siblingMessage(comparison);
    if (!hasLocal) {
      status.textContent = `“${folderName}” already has saved characters. This browser has no copies to remove.${siblingNotice}`;
      await adoptNow(current, choose, copy, status, directory, folderName, actions);
      return;
    }
    status.textContent = `“${folderName}” already has saved characters. This browser still has its own copies.${siblingNotice}`;
    await runAdopt(current, choose, copy, status, directory, folderName, actions, {
      buttonLabel: 'Remove browser copies',
      declinedMessage: `“${folderName}” already has saved characters. This browser still keeps its own copies.${siblingNotice}`,
      prompt: `Remove this browser's copies now that “${folderName}” has them? New art and notes will save in that folder.${siblingNotice}`,
    });
    return;
  }

  const decision = decideLibraryConnection('blank', items, []);
  status.classList.remove('bfa-folder-setup__status--error');
  status.textContent = libraryDecisionMessage(folderName, decision);
  if (decision.kind !== 'blank-with-local') {
    if (await actions.isSavingInFolder()) {
      status.textContent = savingInFolderMessage(folderName);
      await markFolderReady(choose, copy, status);
      return;
    }
    // This browser has nothing to remove. Choosing the folder is the choice
    // to save here.
    await adoptNow(current, choose, copy, status, directory, folderName, actions);
    return;
  }

  copy.hidden = false;
  copy.textContent = 'Copy into folder';
  copy.onclick = () => {
    void runCopy(current, choose, copy, status, directory, folderName, actions);
  };
  // Let the status paint before the confirm dialog blocks the window.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!current()) {
    return;
  }
  await runCopy(current, choose, copy, status, directory, folderName, actions);
}

function presentConflictReview(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    comparison: Extract<LibraryComparison, {kind: 'conflicts'}>,
    actions: FolderSetupActions,
): void {
  const doc = status.ownerDocument;
  const review = doc.createElement('div');
  review.className = 'bfa-folder-setup__conflicts';
  review.setAttribute('data-bfa-folder-conflicts', 'true');
  const heading = doc.createElement('h2');
  heading.className = 'bfa-folder-setup__conflicts-title';
  heading.textContent = 'Choose what to keep';
  review.append(heading);
  const choices: Record<string, ConflictChoice> = {};
  for (const conflict of comparison.conflicts) {
    const fieldset = doc.createElement('fieldset');
    fieldset.className = 'bfa-folder-setup__conflict';
    const legend = doc.createElement('legend');
    legend.textContent = `${conflictKindLabel(conflict.browser.kind)} ${conflict.browser.id}`;
    fieldset.append(legend);
    const revisions = doc.createElement('p');
    revisions.className = 'bfa-folder-setup__conflict-revisions';
    revisions.textContent = conflict.reason === 'deleted-in-folder'
      ? `This browser: ${revisionLabel(conflict.browser.updatedAt)} · Folder deletion: ${revisionLabel(conflict.tombstone?.deletedAt ?? null)}`
      : `This browser: ${revisionLabel(conflict.browser.updatedAt)} · Folder: ${revisionLabel(conflict.folder?.updatedAt ?? null)}`;
    fieldset.append(revisions);
    const key = conflictChoiceKey(conflict);
    for (const choice of conflictChoices(conflict)) {
      const label = doc.createElement('label');
      label.className = 'bfa-folder-setup__conflict-choice';
      const input = doc.createElement('input');
      input.type = 'radio';
      input.name = `bfa-folder-conflict-${key}`;
      input.value = choice;
      input.addEventListener('change', () => {
        choices[key] = choice;
        copy.disabled = Object.keys(choices).length !== comparison.conflicts.length;
      });
      label.append(input, doc.createTextNode(conflictChoiceLabel(choice, conflict.browser.kind)));
      fieldset.append(label);
    }
    review.append(fieldset);
  }
  status.before(review);
  status.textContent = `“${folderName}” has ${comparison.conflicts.length} ${comparison.conflicts.length === 1 ? 'conflict' : 'conflicts'}. Nothing changes until every row has a choice and you apply them.${siblingMessage(comparison)}`;
  copy.hidden = false;
  copy.disabled = true;
  copy.textContent = 'Apply choices';
  copy.onclick = () => {
    void applyConflictChoices(
        current,
        choose,
        copy,
        status,
        review,
        directory,
        folderName,
        choices,
        actions,
    );
  };
}

async function applyConflictChoices(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    review: HTMLElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    choices: Readonly<Record<string, ConflictChoice>>,
    actions: FolderSetupActions,
): Promise<void> {
  copy.disabled = true;
  if (choose !== null) {
    choose.disabled = true;
  }
  try {
    const result = await actions.resolveConflicts(directory, choices);
    if (!current()) {
      return;
    }
    const failed = result.kind !== 'complete';
    status.classList.toggle('bfa-folder-setup__status--error', failed);
    status.textContent = describeConflictResult(folderName, result);
    if (!failed) {
      review.remove();
      copy.hidden = true;
    }
  } catch {
    if (!current()) {
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = 'The conflict choices could not be applied. This browser’s copies were kept.';
  } finally {
    if (!copy.hidden) {
      copy.disabled = false;
    }
    if (choose !== null) {
      choose.disabled = false;
    }
  }
}

function conflictChoiceLabel(
    choice: ConflictChoice,
    kind: 'crop' | 'full-art' | 'image' | 'note',
): string {
  const item = kind === 'full-art'
    ? 'full art'
    : kind === 'crop' ? 'crop' : kind === 'image' ? 'photo' : 'note';
  switch (choice) {
    case 'folder': return kind === 'note'
      ? 'Keep folder note'
      : `Use folder ${item}; keep browser copy beside it`;
    case 'browser': return kind === 'note'
      ? 'Keep browser note'
      : `Use browser ${item}; keep folder copy beside it`;
    case 'both': return kind === 'image'
      ? 'Keep both photos; the newer note keeps this photo id'
      : 'Keep both notes';
    case 'deleted': return 'Leave deleted';
    case 'restore': return `Restore browser ${item}`;
  }
}

function conflictKindLabel(kind: 'crop' | 'full-art' | 'image' | 'note'): string {
  if (kind === 'full-art') {
    return 'Full art';
  }
  if (kind === 'crop') {
    return 'Portrait crop';
  }
  return kind === 'image' ? 'Photo' : 'Note';
}

function revisionLabel(value: string | null): string {
  return value === null || value.trim() === '' ? 'time unavailable' : value;
}

function describeConflictResult(
    folderName: string,
    result: ResolveFolderConflictsResult,
): string {
  if (result.kind === 'complete') {
    const photos = result.photos === undefined
      ? ''
      : ` Kept both versions of ${result.photos} conflicting ${result.photos === 1 ? 'photo' : 'photos'} with distinct ids.`;
    return `Applied the conflict choices.${photos} The files were checked, and this browser now uses “${folderName}”.`;
  }
  return `${result.message} This browser’s copies were kept.`;
}

function clearConflictReview(status: HTMLElement): void {
  status.ownerDocument.querySelector('[data-bfa-folder-conflicts]')?.remove();
}

async function runUnion(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    actions: FolderSetupActions,
    additions: number,
): Promise<void> {
  copy.hidden = false;
  copy.textContent = 'Add records and use folder';
  copy.onclick = () => {
    void runUnion(current, choose, copy, status, directory, folderName, actions, additions);
  };
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!current() || !actions.confirmCopy(
      `Add ${additions} ${additions === 1 ? 'record' : 'records'} from this browser to “${folderName}”? The files will be checked before this browser uses the folder.`,
  )) {
    return;
  }
  copy.disabled = true;
  if (choose !== null) {
    choose.disabled = true;
  }
  try {
    const result = await actions.unionLibrary(directory);
    if (!current()) {
      return;
    }
    const failed = result.kind !== 'complete';
    status.classList.toggle('bfa-folder-setup__status--error', failed);
    status.textContent = describeUnionResult(folderName, result);
    if (!failed) {
      copy.hidden = true;
    }
  } catch {
    if (!current()) {
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = 'The folder union did not finish. This browser’s copies were kept.';
  } finally {
    copy.disabled = false;
    if (choose !== null) {
      choose.disabled = false;
    }
  }
}

async function runCopy(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    actions: FolderSetupActions,
): Promise<void> {
  if (!actions.confirmCopy(
      `Copy this browser's art and notes into “${folderName}”? After the files check out, you can remove the copies in this browser.`,
  )) {
    return;
  }

  copy.disabled = true;
  if (choose !== null) {
    choose.disabled = true;
  }
  status.classList.remove('bfa-folder-setup__status--error');
  try {
    const result = await actions.copyLibrary(directory);
    if (!current()) {
      return;
    }
    const failedOnly = result.copiedCharacterIds.length === 0 && result.failed.length > 0;
    status.classList.toggle('bfa-folder-setup__status--error', failedOnly);
    status.textContent = copyResultMessage(folderName, result);
    if (result.failed.length !== 0 || result.copiedCharacterIds.length === 0) {
      return;
    }
  } catch {
    if (!current()) {
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = 'The copy did not finish. Nothing in this browser was removed.';
    return;
  } finally {
    copy.disabled = false;
    if (choose !== null) {
      choose.disabled = false;
    }
  }

  await runAdopt(current, choose, copy, status, directory, folderName, actions, {
    buttonLabel: 'Remove browser copies',
    declinedMessage: `Copied into “${folderName}”. This browser still keeps its own copies. Choose Remove browser copies when you want new art and notes to save only in the folder.`,
    prompt: `Remove this browser's copies now that “${folderName}” has them? New art and notes will save in that folder.`,
  });
}

async function runAdopt(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    actions: FolderSetupActions,
    prompt: {buttonLabel: string; declinedMessage: string; prompt: string},
): Promise<void> {
  copy.hidden = false;
  copy.textContent = prompt.buttonLabel;
  copy.onclick = () => {
    void runAdopt(current, choose, copy, status, directory, folderName, actions, prompt);
  };
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!current()) {
    return;
  }
  if (!actions.confirmRemove(prompt.prompt)) {
    status.classList.remove('bfa-folder-setup__status--error');
    status.textContent = prompt.declinedMessage;
    return;
  }

  copy.disabled = true;
  if (choose !== null) {
    choose.disabled = true;
  }
  status.classList.remove('bfa-folder-setup__status--error');
  try {
    const result = await actions.adoptLibrary(directory);
    if (!current()) {
      return;
    }
    const failed = result.kind === 'mismatch' || result.kind === 'unavailable';
    status.classList.toggle('bfa-folder-setup__status--error', failed);
    status.textContent = describeAdoptResult(folderName, result);
    if (!failed) {
      await markFolderReady(choose, copy, status);
    }
  } catch {
    if (!current()) {
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = 'The folder has the checked files. This browser\'s copies could not be removed.';
  } finally {
    copy.disabled = false;
    if (choose !== null) {
      choose.disabled = false;
    }
  }
}

async function adoptNow(
    current: () => boolean,
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
    directory: FileSystemDirectoryHandle,
    folderName: string,
    actions: FolderSetupActions,
): Promise<void> {
  copy.hidden = true;
  if (choose !== null) {
    choose.disabled = true;
  }
  status.classList.remove('bfa-folder-setup__status--error');
  try {
    const result = await actions.adoptLibrary(directory);
    if (!current()) {
      return;
    }
    const failed = result.kind === 'mismatch' || result.kind === 'unavailable';
    status.classList.toggle('bfa-folder-setup__status--error', failed);
    status.textContent = describeAdoptResult(folderName, result);
    if (!failed) {
      await markFolderReady(choose, copy, status);
    }
  } catch {
    if (!current()) {
      return;
    }
    status.classList.add('bfa-folder-setup__status--error');
    status.textContent = 'The folder is connected. This browser could not start saving there yet. Nothing was removed.';
  } finally {
    copy.disabled = false;
    if (choose !== null) {
      choose.disabled = false;
    }
  }
}

async function markFolderReady(
    choose: HTMLButtonElement | null,
    copy: HTMLButtonElement,
    status: HTMLParagraphElement,
): Promise<void> {
  copy.hidden = true;
  if (choose !== null) {
    choose.hidden = true;
  }
  const doc = status.ownerDocument;
  const title = doc.querySelector('#folder-setup-title');
  if (title !== null) {
    title.textContent = 'Folder ready';
  }
  for (const paragraph of doc.querySelectorAll<HTMLElement>('.bfa-folder-setup__copy')) {
    paragraph.hidden = true;
  }
  const close = doc.querySelector<HTMLButtonElement>('#folder-setup-close');
  if (close !== null) {
    // Done looked like the last step, so the window was closed and the
    // folder grant went with it. The title bar is still there. This button
    // is hidden so the page does not ask to be dismissed.
    close.hidden = true;
  }
  if (!status.textContent?.includes(JOURNALS_SHOW_IN_POPUP)) {
    status.textContent = `${status.textContent ?? ''} ${JOURNALS_SHOW_IN_POPUP}`.trim();
  }
  if (!status.textContent.includes(SETUP_STAYS_OPEN)) {
    status.textContent = `${status.textContent} ${SETUP_STAYS_OPEN}`;
  }
  folderReady = true;
  await syncFolderSettings();
  await holdFolderSession();
  await revealJournalPopup();
}

async function revealJournalPopup(): Promise<void> {
  // openPopup fails unless a normal browser window is focused. Parking this
  // window first leaves that call with nothing to attach to, so the toolbar
  // popup never appears and the list still waits on another click.
  const windowId = await focusBrowserWindow();
  await openToolbarPopup(windowId);
  await parkSetupWindow();
}

async function focusBrowserWindow(): Promise<number | undefined> {
  const windowsApi = globalThis.chrome?.windows;
  if (windowsApi?.getAll === undefined || windowsApi.update === undefined) {
    return undefined;
  }
  try {
    const open = await windowsApi.getAll({windowTypes: ['normal']});
    const browser = open.find((item) => item.focused === true) ?? open[0];
    if (browser?.id === undefined) {
      return undefined;
    }
    await windowsApi.update(browser.id, {focused: true});
    return browser.id;
  } catch {
    return undefined;
  }
}

async function openToolbarPopup(windowId: number | undefined): Promise<void> {
  const action = globalThis.chrome?.action;
  if (action?.openPopup === undefined) {
    return;
  }
  try {
    if (windowId === undefined) {
      await action.openPopup();
    } else {
      await action.openPopup({windowId});
    }
  } catch {
    // The toolbar icon still lists the folder while this window stays open.
  }
}

async function parkSetupWindow(): Promise<void> {
  const windowsApi = chromeWindowApi();
  if (windowsApi === null) {
    return;
  }
  try {
    const current = await windowsApi.getCurrent();
    if (current.id === undefined) {
      return;
    }
    const place: SetupWindowPlace = {id: current.id};
    if (current.width !== undefined) {
      place.width = current.width;
    }
    if (current.height !== undefined) {
      place.height = current.height;
    }
    await windowsApi.update(current.id, parkedWindowBounds(place));
  } catch {
    // Closing this document is what drops the folder. Leave it open.
  }
}

function savingInFolderMessage(folderName: string): string {
  return `“${folderName}” is connected. ${JOURNALS_SHOW_IN_POPUP} This browser is not keeping a second copy.`;
}

function siblingMessage(comparison: LibraryComparison): string {
  if (comparison.siblings.length === 0) {
    return '';
  }
  return ` Found ${comparison.siblings.length} Drive conflict ${comparison.siblings.length === 1 ? 'copy' : 'copies'} and left ${comparison.siblings.length === 1 ? 'it' : 'them'} untouched.`;
}

function stoppedMessage(
    result: Exclude<ConnectBackupFolderResult, {folderName: string; kind: 'initialized' | 'reconnected'}>,
): string {
  switch (result.kind) {
    case 'occupied':
      return 'That folder already has files. Create a blank folder and choose that. A folder Beyond Full Art already set up can be chosen again.';
    case 'unreadable':
      return 'That folder has a Beyond Full Art file this version cannot read. Nothing was changed.';
    case 'failed':
      return 'The folder could not be set up. Nothing on this browser was changed.';
  }
}

async function readStoredFolderAccess(): Promise<StoredFolderAccess | null> {
  const stored = await getStoredBackupFolder();
  if (stored === null) {
    return null;
  }
  return {
    directory: stored.handle,
    permission: await readDirectoryPermission(stored.handle),
  };
}

function canShowDirectoryPicker(win: Window | null): boolean {
  return typeof directoryPicker(win) === 'function';
}

function directoryPicker(win: Window | null): ((options: {
  id?: string;
  mode?: 'readwrite';
}) => Promise<FileSystemDirectoryHandle>) | undefined {
  if (win === null) {
    return undefined;
  }
  return (win as Window & {
    showDirectoryPicker?: (options: {
      id?: string;
      mode?: 'readwrite';
    }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
}

function folderChoiceFailureMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'No folder was chosen. Nothing was changed.';
  }
  if (error instanceof Error && (
    error.message === FOLDER_PICKER_UNAVAILABLE_MESSAGE
    || error.message === FOLDER_PERMISSION_NEEDED_MESSAGE
  )) {
    return error.message;
  }
  if (error instanceof DOMException && (
    error.name === 'SecurityError' || error.name === 'NotAllowedError'
  )) {
    return FOLDER_PICKER_UNAVAILABLE_MESSAGE;
  }
  return 'The folder could not be set up. Nothing on this browser was changed.';
}

async function pickBackupDirectory(): Promise<FileSystemDirectoryHandle> {
  const showDirectoryPicker = directoryPicker(window);
  if (typeof showDirectoryPicker !== 'function') {
    throw new Error(FOLDER_PICKER_UNAVAILABLE_MESSAGE);
  }

  const directory = await showDirectoryPicker.call(window, {
    id: BACKUP_FOLDER_PICKER_ID,
    mode: 'readwrite',
  });
  const permission = await allowDirectory(directory);
  if (permission === 'denied' || permission === 'prompt') {
    throw new Error(FOLDER_PERMISSION_NEEDED_MESSAGE);
  }
  return directory;
}

async function allowDirectory(handle: object): Promise<BackupFolderPermission> {
  const current = await readDirectoryPermission(handle);
  if (current !== 'prompt') {
    return current;
  }

  // Ask in this turn. Waiting for the window move first spends the click,
  // Brave never shows the question, and the handle stays `prompt`. The move
  // still runs so this popup does not cover the question.
  announcePermissionStepAside();
  const parking = stepAsideForPermissionPrompt();
  try {
    return await requestDirectoryPermission(handle);
  } finally {
    await restoreSetupWindow(await parking);
  }
}

function announcePermissionStepAside(): void {
  const status = document.querySelector('#folder-setup-status');
  if (status === null) {
    return;
  }
  status.classList.remove('bfa-folder-setup__status--error');
  status.textContent = 'Allow access in the browser question. This window moves aside until you answer.';
}

interface SetupWindowPlace {
  height?: number;
  id: number;
  left?: number;
  top?: number;
  width?: number;
}

function chromeWindowApi(): {
  getCurrent: () => Promise<chrome.windows.Window>;
  update: (windowId: number, info: chrome.windows.UpdateInfo) => Promise<chrome.windows.Window | undefined>;
} | null {
  if (
    typeof chrome === 'undefined'
    || chrome.windows?.getCurrent === undefined
    || chrome.windows.update === undefined
  ) {
    return null;
  }
  return {
    getCurrent: () => chrome.windows.getCurrent(),
    update: (windowId, info) => chrome.windows.update(windowId, info),
  };
}

async function stepAsideForPermissionPrompt(): Promise<SetupWindowPlace | null> {
  const windowsApi = chromeWindowApi();
  if (windowsApi === null) {
    return null;
  }
  try {
    const current = await windowsApi.getCurrent();
    if (current.id === undefined) {
      return null;
    }
    const place: SetupWindowPlace = {
      id: current.id,
    };
    if (current.left !== undefined) {
      place.left = current.left;
    }
    if (current.top !== undefined) {
      place.top = current.top;
    }
    if (current.width !== undefined) {
      place.width = current.width;
    }
    if (current.height !== undefined) {
      place.height = current.height;
    }
    await windowsApi.update(current.id, parkedWindowBounds(place));
    return place;
  } catch {
    return null;
  }
}

function parkedWindowBounds(place: SetupWindowPlace): chrome.windows.UpdateInfo {
  if (place.width === undefined || place.height === undefined) {
    return {focused: false, state: 'minimized'};
  }
  return {
    focused: false,
    left: Math.max(0, Math.round(screen.availWidth - place.width - 12)),
    top: Math.max(0, Math.round(screen.availHeight - place.height - 12)),
  };
}

async function restoreSetupWindow(place: SetupWindowPlace | null): Promise<void> {
  if (place === null) {
    return;
  }
  const windowsApi = chromeWindowApi();
  if (windowsApi === null) {
    return;
  }
  const info: chrome.windows.UpdateInfo = {focused: true, state: 'normal'};
  if (place.left !== undefined) {
    info.left = place.left;
  }
  if (place.top !== undefined) {
    info.top = place.top;
  }
  if (place.width !== undefined) {
    info.width = place.width;
  }
  if (place.height !== undefined) {
    info.height = place.height;
  }
  try {
    await windowsApi.update(place.id, info);
  } catch {
    // The setup window can stay where the user left it.
  }
}

function ensureStyles(doc: Document): void {
  if (doc.head.querySelector(`[${STYLE_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = setupStyles;
  doc.head.append(styleElement);
}
