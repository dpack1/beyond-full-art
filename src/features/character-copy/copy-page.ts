import {characterIdFromElement} from '../character-deletion/delete-confirmation-note';
import {isDeletionCharacterId} from '../character-deletion/deletion-request';
import {runWhenDocumentReady} from '../character-deletion/cleanup-page';
import {
  asCopyPrompt,
  CHARACTER_COPY_PAGE_SOURCE,
  COPY_MESSAGE_SOURCE,
  type CopyPromptMessage,
} from './copy-messages';
import {isCharacterCopySuccessStatus} from './copy-request';
import {mountCopyDialog, type CopyChoice, type CopyDialog} from './copy-dialog';

export function installCharacterCopyPage(doc: Document = document): void {
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== window.location.origin) {
      return;
    }
    const observed = pageCopyEvent(event.data);
    if (observed === null) {
      return;
    }
    void chrome.runtime.sendMessage({
      destinationId: observed.destinationId,
      source: COPY_MESSAGE_SOURCE,
      sourceFromPath: observed.sourceFromPath,
      sourceId: observed.sourceId,
      type: 'copy:observed',
    });
  });

  if (window !== window.top) {
    return;
  }

  doc.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest('button, [role="button"]');
    if (!(button instanceof HTMLElement) || !isCopyControl(button)) {
      return;
    }
    const characterId = characterIdFromElement(button);
    if (characterId === null) {
      return;
    }
    void chrome.runtime.sendMessage({
      characterId,
      source: COPY_MESSAGE_SOURCE,
      type: 'copy:clicked',
    });
  }, true);

  const queue: CopyPromptMessage[] = [];
  const queuedIds = new Set<string>();
  let dialog: CopyDialog | null = null;
  let draining = false;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const prompt = asCopyPrompt(message);
    if (prompt === null) {
      return false;
    }
    enqueue(prompt);
    sendResponse({ok: true});
    return false;
  });

  runWhenDocumentReady(doc, () => {
    dialog = mountCopyDialog(doc);
    claimPending();
    doc.defaultView?.setTimeout(claimPending, 500);
    doc.defaultView?.setTimeout(claimPending, 1500);
    drain();
  });

  function enqueue(prompt: CopyPromptMessage): void {
    if (queuedIds.has(prompt.destinationId)) {
      return;
    }
    queuedIds.add(prompt.destinationId);
    queue.push(prompt);
    drain();
  }

  function drain(): void {
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
  }

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
        await mounted.prompt((choice) => submitChoice(prompt, choice));
      } finally {
        queuedIds.delete(prompt.destinationId);
      }
    }
  }

  function claimPending(): void {
    chrome.runtime.sendMessage({
      source: COPY_MESSAGE_SOURCE,
      type: 'copy:claim',
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

function isCopyControl(button: HTMLElement): boolean {
  const label = button.getAttribute('aria-label')?.trim() || button.textContent?.trim() || '';
  return label.toLowerCase() === 'copy';
}

async function submitChoice(prompt: CopyPromptMessage, choice: CopyChoice): Promise<void> {
  const response = await sendExtensionMessage({
    decision: choice,
    destinationId: prompt.destinationId,
    source: COPY_MESSAGE_SOURCE,
    sourceId: prompt.sourceId,
    type: 'copy:decision',
  });
  if (
    typeof response !== 'object'
    || response === null
    || (response as {type?: unknown}).type !== 'copy:decision:success'
  ) {
    const message = typeof response === 'object' && response !== null
      ? (response as {message?: unknown}).message
      : undefined;
    throw new Error(typeof message === 'string' && message.trim() !== ''
      ? message
      : 'The journal could not be copied.');
  }
}

function sendExtensionMessage(message: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const error = chrome.runtime.lastError;
      if (error !== undefined) {
        reject(new Error(error.message || 'The journal could not be copied.'));
        return;
      }
      resolve(response);
    });
  });
}

function pageCopyEvent(value: unknown): {
  destinationId: string;
  sourceFromPath: boolean;
  sourceId: string | null;
} | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    record.source !== CHARACTER_COPY_PAGE_SOURCE
    || !isCharacterCopySuccessStatus(record.status)
    || typeof record.destinationId !== 'string'
    || !isDeletionCharacterId(record.destinationId)
  ) {
    return null;
  }
  const sourceId = record.sourceId;
  return {
    destinationId: record.destinationId,
    sourceFromPath: record.sourceFromPath === true,
    sourceId: typeof sourceId === 'string' && isDeletionCharacterId(sourceId) ? sourceId : null,
  };
}

function responsePrompts(value: unknown): CopyPromptMessage[] {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as {prompts?: unknown}).prompts)) {
    return [];
  }
  return (value as {prompts: unknown[]}).prompts.flatMap((prompt) => {
    const parsed = asCopyPrompt(prompt);
    return parsed === null ? [] : [parsed];
  });
}
