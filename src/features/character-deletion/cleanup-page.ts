import {downloadJournalExport} from '../../popup/journal-export';
import {readRawCharacterJournalRecords} from '../../platform/chrome/storage';
import {mountCleanupDialog, type CleanupChoice, type CleanupDialog} from './cleanup-dialog';
import {
  asCleanupFailed,
  asCleanupPrompt,
  CLEANUP_MESSAGE_SOURCE,
  CHARACTER_DELETION_PAGE_SOURCE,
  type CleanupDecisionMessage,
  type CleanupPromptMessage,
} from './cleanup-messages';
import {
  characterIdFromElement,
  clearDeleteConfirmationNote,
  isCharacterDeleteConfirmation,
  placeDeleteConfirmationNote,
} from './delete-confirmation-note';
import {isCharacterDeletionSuccessStatus, isDeletionCharacterId} from './deletion-request';
import {parseCharacterIdFromCharacterPageUrl} from '../../platform/dndbeyond/urls';

type CleanupPrompt = CleanupPromptMessage;

const DELETE_FAILED_MESSAGE = 'Stored full art could not be deleted.';

export function installCharacterDeletionPage(doc: Document = document): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    const observed = pageDeletionEvent(event.data);
    if (observed === null) {
      return;
    }
    void chrome.runtime.sendMessage({
      source: CLEANUP_MESSAGE_SOURCE,
      status: observed.status,
      type: 'cleanup:succeeded',
    });
    if (observed.characterId === null) {
      return;
    }
    void chrome.runtime.sendMessage({
      characterId: observed.characterId,
      source: CLEANUP_MESSAGE_SOURCE,
      status: observed.status,
      type: 'cleanup:observed',
    });
  });

  if (!isTopFrame()) {
    return;
  }

  const queue: CleanupPrompt[] = [];
  const queuedIds = new Set<string>();
  let dialog: CleanupDialog | null = null;
  let draining = false;

  const enqueue = (prompt: CleanupPrompt) => {
    if (queuedIds.has(prompt.characterId)) {
      return;
    }
    queuedIds.add(prompt.characterId);
    queue.push(prompt);
    drain();
  };

  const drain = () => {
    if (draining || dialog === null) {
      return;
    }
    draining = true;
    void drainQueue().finally(() => {
      draining = false;
      if (queue.length > 0) {
        drain();
      }
    });
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const prompt = asCleanupPrompt(message);
    if (prompt !== null) {
      enqueue(prompt);
      sendResponse({ok: true});
      return false;
    }
    const failed = asCleanupFailed(message);
    if (failed !== null && dialog !== null && !draining) {
      dialog.showFailure(failed.message);
    }
    return false;
  });

  // document_start runs before <head> exists. Mounting here used to throw
  // on document.head.querySelector and the dialog never appeared.
  runWhenDocumentReady(doc, () => {
    dialog = mountCleanupDialog(doc);
    watchDeleteConfirmations(doc);
    claimPending();
    doc.defaultView?.setTimeout(claimPending, 500);
    doc.defaultView?.setTimeout(claimPending, 1500);
    drain();
  });

  async function drainQueue(): Promise<void> {
    const mounted = dialog;
    if (mounted === null) {
      return;
    }
    while (queue.length > 0) {
      const prompt = queue.shift();
      if (prompt === undefined) {
        return;
      }
      try {
        await mounted.prompt(
            (choice) => submitChoice(prompt.characterId, choice),
            {hasArt: prompt.hasArt, hasJournalData: prompt.hasJournalData},
            prompt.hasJournalData
              ? () => exportStoredJournal(prompt.characterId, doc)
              : undefined,
        );
      } finally {
        queuedIds.delete(prompt.characterId);
      }
    }
  }

  function claimPending(): void {
    chrome.runtime.sendMessage({
      source: CLEANUP_MESSAGE_SOURCE,
      type: 'cleanup:claim',
    }, (response) => {
      if (chrome.runtime.lastError !== undefined) {
        return;
      }
      const prompts = responsePrompts(response);
      for (const prompt of prompts) {
        enqueue(prompt);
      }
    });
  }
}

async function exportStoredJournal(characterId: string, doc: Document): Promise<string> {
  const records = await readRawCharacterJournalRecords(characterId);
  const result = await downloadJournalExport([{characterId, records}], doc);
  if (result.missingPhotos === 0) {
    return 'Journal export downloaded.';
  }
  const label = result.missingPhotos === 1 ? 'photo' : 'photos';
  return `Journal export downloaded, but ${result.missingPhotos} ${label} could not be included.`;
}

async function submitChoice(characterId: string, choice: CleanupChoice): Promise<void> {
  const response = await sendExtensionMessage({
    characterId,
    decision: choice.decision,
    remember: choice.remember,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:decision',
  } satisfies CleanupDecisionMessage);
  if (!isSuccess(response)) {
    throw new Error(responseMessage(response));
  }
}

export function runWhenDocumentReady(doc: Document, run: () => void): void {
  if (doc.head !== null && doc.body !== null) {
    run();
    return;
  }
  doc.addEventListener('DOMContentLoaded', () => {
    if (doc.head === null || doc.body === null) {
      return;
    }
    run();
  }, {once: true});
}

function watchDeleteConfirmations(doc: Document): void {
  let lastCharacterId: string | null = null;
  let previewing = false;
  const remember = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return;
    }
    const characterId = characterIdFromElement(target);
    if (characterId !== null) {
      lastCharacterId = characterId;
    }
  };
  doc.addEventListener('pointerdown', (event) => remember(event.target), true);
  doc.addEventListener('focusin', (event) => remember(event.target), true);
  doc.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const dialog = target.closest('dialog');
    const button = target.closest('button');
    if (
      dialog === null
      || button === null
      || !isCharacterDeleteConfirmation(dialog)
      || button.textContent?.trim() !== 'Delete'
    ) {
      return;
    }
    const noted = dialog.querySelector('[data-bfa-cleanup-note]')
        ?.getAttribute('data-bfa-character-id');
    const characterId = noted !== null && noted !== undefined && isDeletionCharacterId(noted)
      ? noted
      : characterIdForConfirmation(doc, lastCharacterId);
    if (characterId === null) {
      return;
    }
    // The delete body often has no character id. This click names the
    // character; the service worker still waits for the real 200.
    void chrome.runtime.sendMessage({
      characterId,
      source: CLEANUP_MESSAGE_SOURCE,
      type: 'cleanup:confirmed',
    });
  }, true);

  const scan = () => {
    for (const dialog of doc.querySelectorAll('dialog[open]')) {
      if (!isCharacterDeleteConfirmation(dialog)) {
        continue;
      }
      const characterId = characterIdForConfirmation(doc, lastCharacterId);
      if (characterId === null) {
        clearDeleteConfirmationNote(dialog);
        continue;
      }
      const existing = dialog.querySelector('[data-bfa-cleanup-note]');
      if (
        existing?.getAttribute('data-bfa-character-id') === characterId
        || dialog.getAttribute('data-bfa-cleanup-checked') === characterId
        || previewing
      ) {
        continue;
      }
      previewing = true;
      void previewStoredData(characterId).then((hasJournalData) => {
        previewing = false;
        if (!dialog.isConnected || !dialog.hasAttribute('open')) {
          return;
        }
        dialog.setAttribute('data-bfa-cleanup-checked', characterId);
        if (hasJournalData) {
          placeDeleteConfirmationNote(dialog, doc, characterId);
          return;
        }
        clearDeleteConfirmationNote(dialog);
      }).catch(() => undefined);
    }
  };
  scan();
  new MutationObserver(scan).observe(doc.documentElement, {
    attributeFilter: ['open'],
    attributes: true,
    childList: true,
    subtree: true,
  });
}

function characterIdForConfirmation(doc: Document, fallback: string | null): string | null {
  try {
    const fromPage = parseCharacterIdFromCharacterPageUrl(new URL(doc.location.href));
    if (fromPage !== null) {
      return fromPage;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function previewStoredData(characterId: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      characterId,
      source: CLEANUP_MESSAGE_SOURCE,
      type: 'cleanup:preview',
    }, (response) => {
      if (chrome.runtime.lastError !== undefined) {
        resolve(false);
        return;
      }
      resolve(previewHasJournal(response));
    });
  });
}

function previewHasJournal(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && (value as {hasJournalData?: unknown}).hasJournalData === true;
}

function pageDeletionEvent(value: unknown): {characterId: string | null; status: 200 | 204} | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.source !== CHARACTER_DELETION_PAGE_SOURCE
    || !isCharacterDeletionSuccessStatus(record.status)
  ) {
    return null;
  }
  const characterId = typeof record.characterId === 'string'
      && isDeletionCharacterId(record.characterId)
    ? record.characterId
    : null;
  return {characterId, status: record.status};
}

function responsePrompts(value: unknown): CleanupPrompt[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const prompts = (value as {prompts?: unknown}).prompts;
  if (!Array.isArray(prompts)) {
    return [];
  }
  return prompts.flatMap((prompt) => {
    const parsed = asCleanupPrompt(prompt);
    return parsed === null ? [] : [parsed];
  });
}

function isTopFrame(): boolean {
  try {
    return window.top === window;
  } catch {
    return false;
  }
}

function sendExtensionMessage(message: CleanupDecisionMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error !== undefined) {
        reject(new Error(error.message || DELETE_FAILED_MESSAGE));
        return;
      }
      resolve(response);
    });
  });
}

function isSuccess(value: unknown): boolean {
  return typeof value === 'object'
    && value !== null
    && (value as Record<string, unknown>).type === 'cleanup:decision:success';
}

function responseMessage(value: unknown): string {
  if (
    typeof value === 'object'
    && value !== null
    && typeof (value as Record<string, unknown>).message === 'string'
  ) {
    return (value as {message: string}).message;
  }
  return DELETE_FAILED_MESSAGE;
}
