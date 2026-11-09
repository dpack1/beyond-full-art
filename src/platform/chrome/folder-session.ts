export const FOLDER_SESSION_PAGE = 'folder/session.html';
export const FOLDER_SESSION_READY_KEY = 'bfa.folder.sessionReady';
export const FOLDER_SESSION_READY_MESSAGE = 'bfa.folder.session.ready';
export const FOLDER_SESSION_TOUCH_MESSAGE = 'bfa.folder.session.touch';
export const FOLDER_SESSION_HOLD_MESSAGE = 'bfa.folder.session.hold';
export const FOLDER_SESSION_RELEASE_MESSAGE = 'bfa.folder.session.release';

let activeFolderDirectory: FileSystemDirectoryHandle | null = null;

export function rememberActiveFolderDirectory(
    handle: FileSystemDirectoryHandle | null,
): void {
  activeFolderDirectory = handle;
}

export function readActiveFolderDirectory(): FileSystemDirectoryHandle | null {
  return activeFolderDirectory;
}

let creating: Promise<void> | null = null;

export async function ensureFolderSession(): Promise<void> {
  const offscreen = globalThis.chrome?.offscreen;
  if (
    offscreen?.createDocument === undefined
    || offscreen.hasDocument === undefined
  ) {
    return;
  }
  if (await offscreen.hasDocument()) {
    return;
  }
  if (creating !== null) {
    await creating;
    return;
  }

  creating = offscreen.createDocument({
    justification: 'Keep the backup folder open so art and notes load after a refresh.',
    reasons: ['BLOBS'],
    url: FOLDER_SESSION_PAGE,
  }).then(() => undefined);
  try {
    await creating;
  } catch (error) {
    if (await offscreen.hasDocument()) {
      return;
    }
    throw error;
  } finally {
    creating = null;
  }
}

export async function holdFolderSession(): Promise<void> {
  const open = await touchFolderSession();
  if (!open) {
    return;
  }
  try {
    await markFolderSessionReady();
  } catch {
    // The hidden page records the same key when it opens the folder.
  }
}

export async function handFolderToSession(
    directory: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    await ensureFolderSession();
  } catch {
    // The service worker can still keep the handle from the message below.
  }
  // The setup window is the page the user allowed. The toolbar popup does
  // not get a click when it opens, so it cannot ask again. This hands the
  // already-open folder to the hidden page and the service worker.
  const open = await sendFolderSessionMessage({
    handle: directory,
    type: FOLDER_SESSION_HOLD_MESSAGE,
  }, {
    attempts: FOLDER_SESSION_HOLD_ATTEMPTS,
    retryClosed: true,
  });
  if (open) {
    try {
      await markFolderSessionReady();
    } catch {
      // The hidden page records the same key when it opens the folder.
    }
  }
  return open;
}

export async function releaseActiveFolderDirectory(): Promise<void> {
  rememberActiveFolderDirectory(null);
  await sendFolderSessionMessage({type: FOLDER_SESSION_RELEASE_MESSAGE});
}

export function markFolderSessionReady(): Promise<void> {
  return new Promise((resolve, reject) => {
    const area = globalThis.chrome?.storage?.local;
    if (area?.set === undefined) {
      resolve();
      return;
    }
    // Chrome throws Illegal invocation if `set` is copied off StorageArea.
    area.set({[FOLDER_SESSION_READY_KEY]: new Date().toISOString()}, () => {
      const runtimeError = globalThis.chrome?.runtime?.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve();
    });
  });
}

const FOLDER_SESSION_TOUCH_ATTEMPTS = 5;
const FOLDER_SESSION_HOLD_ATTEMPTS = 20;
const FOLDER_SESSION_TOUCH_WAIT_MS = 50;

export async function touchFolderSession(): Promise<boolean> {
  return sendFolderSessionMessage(
      {type: FOLDER_SESSION_TOUCH_MESSAGE},
      {attempts: FOLDER_SESSION_TOUCH_ATTEMPTS, retryClosed: false},
  );
}

async function sendFolderSessionMessage(
    message: {
      handle?: FileSystemDirectoryHandle;
      type: string;
    },
    options: {attempts: number; retryClosed: boolean} = {
      attempts: FOLDER_SESSION_TOUCH_ATTEMPTS,
      retryClosed: false,
    },
): Promise<boolean> {
  const runtime = globalThis.chrome?.runtime;
  if (runtime?.sendMessage === undefined) {
    return false;
  }
  for (let attempt = 0; attempt < options.attempts; attempt += 1) {
    try {
      // Chrome throws Illegal invocation if `sendMessage` is copied off runtime.
      const response = await runtime.sendMessage(message);
      if (message.type === FOLDER_SESSION_RELEASE_MESSAGE) {
        return true;
      }
      if (isOpenResponse(response)) {
        return true;
      }
      if (!options.retryClosed) {
        return false;
      }
    } catch {
      // The hidden page is not listening yet.
    }
    if (attempt < options.attempts - 1) {
      await waitForFolderSession(FOLDER_SESSION_TOUCH_WAIT_MS);
    }
  }
  return false;
}

function isOpenResponse(response: unknown): boolean {
  return typeof response === 'object'
    && response !== null
    && (response as {open?: unknown}).open === true;
}

function waitForFolderSession(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function installFolderSessionMessages(): void {
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (!isExtensionPage(sender)) {
      return;
    }
    if (isFolderSessionHoldMessage(message)) {
      rememberActiveFolderDirectory(message.handle);
      return;
    }
    if (isFolderSessionReleaseMessage(message)) {
      rememberActiveFolderDirectory(null);
      return;
    }
    if (!isFolderSessionReadyMessage(message) || !message.open) {
      return;
    }
    void markFolderSessionReady();
  });
}

function isFolderSessionHoldMessage(
    message: unknown,
): message is {handle: FileSystemDirectoryHandle; type: typeof FOLDER_SESSION_HOLD_MESSAGE} {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const record = message as {handle?: {getDirectoryHandle?: unknown}; type?: unknown};
  return record.type === FOLDER_SESSION_HOLD_MESSAGE
    && typeof record.handle?.getDirectoryHandle === 'function';
}

function isFolderSessionReleaseMessage(
    message: unknown,
): message is {type: typeof FOLDER_SESSION_RELEASE_MESSAGE} {
  return typeof message === 'object'
    && message !== null
    && (message as {type?: unknown}).type === FOLDER_SESSION_RELEASE_MESSAGE;
}

function isFolderSessionReadyMessage(
    message: unknown,
): message is {open: boolean; type: typeof FOLDER_SESSION_READY_MESSAGE} {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const record = message as {open?: unknown; type?: unknown};
  return record.type === FOLDER_SESSION_READY_MESSAGE && typeof record.open === 'boolean';
}

function isExtensionPage(sender: chrome.runtime.MessageSender): boolean {
  const extensionId = chrome.runtime.id;
  const senderUrl = sender.url ?? '';
  return sender.id === extensionId
    && senderUrl.startsWith(`chrome-extension://${extensionId}/`);
}
