export const FOLDER_SESSION_PAGE = 'folder/session.html';
export const FOLDER_SESSION_READY_KEY = 'bfa.folder.sessionReady';
export const FOLDER_SESSION_READY_MESSAGE = 'bfa.folder.session.ready';
export const FOLDER_SESSION_TOUCH_MESSAGE = 'bfa.folder.session.touch';

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
const FOLDER_SESSION_TOUCH_WAIT_MS = 40;

export async function touchFolderSession(): Promise<boolean> {
  const runtime = globalThis.chrome?.runtime;
  if (runtime?.sendMessage === undefined) {
    return false;
  }
  for (let attempt = 0; attempt < FOLDER_SESSION_TOUCH_ATTEMPTS; attempt += 1) {
    try {
      // Chrome throws Illegal invocation if `sendMessage` is copied off runtime.
      const response = await runtime.sendMessage({
        type: FOLDER_SESSION_TOUCH_MESSAGE,
      });
      return isOpenResponse(response);
    } catch {
      // The hidden page is not listening yet.
    }
    if (attempt < FOLDER_SESSION_TOUCH_ATTEMPTS - 1) {
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
    if (!isFolderSessionReadyMessage(message) || !message.open) {
      return;
    }
    if (!isExtensionPage(sender)) {
      return;
    }
    void markFolderSessionReady();
  });
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
