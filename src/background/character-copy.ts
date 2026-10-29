import {characterHasJournalOrPhotos} from './cleanup-journal';
import {duplicateCharacterJournal} from './duplicate-character-journal';
import {
  asCopyClaim,
  asCopyClicked,
  asCopyDecision,
  asCopyObserved,
  COPY_MESSAGE_SOURCE,
  createCopyPrompt,
  type CopyPromptMessage,
} from '../features/character-copy/copy-messages';
import {
  createCopyTrackerState,
  noteCopyClicked,
  noteCopyObserved,
  type CopySignal,
  type CopyTrackerState,
} from '../features/character-copy/copy-correlation';

const SESSION_KEY = 'bfa.characterCopy.state';
const PROMPT_TTL_MS = 30 * 60 * 1000;

interface PromptRecord extends CopySignal {
  at: number;
}

interface PersistedCopy {
  prompts: PromptRecord[];
  tracker: CopyTrackerState;
}

export function installCharacterCopy(): void {
  const runtime = new CharacterCopyRuntime();
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
    runtime.onMessage(message, sender, sendResponse));
  void runtime.hydrate();
}

class CharacterCopyRuntime {
  private hydrated = false;
  private pending: Array<() => void> = [];
  private prompts: PromptRecord[] = [];
  private tracker: CopyTrackerState = createCopyTrackerState();

  hydrate(): Promise<void> {
    return this.restore();
  }

  onMessage(
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
  ): boolean {
    const tabId = sender.tab?.id;
    if (asCopyClaim(message) !== null && tabId !== undefined) {
      this.afterHydration(() => {
        sendResponse({
          prompts: this.promptsFor(tabId),
          source: COPY_MESSAGE_SOURCE,
          type: 'copy:claim:result',
        });
      });
      return true;
    }
    const decision = asCopyDecision(message);
    if (decision !== null && tabId !== undefined) {
      this.afterHydration(() => {
        void this.answer(decision, tabId).then(sendResponse);
      });
      return true;
    }
    const clicked = asCopyClicked(message);
    if (clicked !== null && tabId !== undefined) {
      this.afterHydration(() => {
        void this.note(noteCopyClicked(this.tracker, {
          at: Date.now(),
          sourceId: clicked.characterId,
          tabId,
        }, Date.now())).then(
            () => sendResponse({ok: true}),
            () => sendResponse({ok: false}),
        );
      });
      return true;
    }
    const observed = asCopyObserved(message);
    if (observed !== null && tabId !== undefined) {
      this.afterHydration(() => {
        void this.note(noteCopyObserved(this.tracker, {
          at: Date.now(),
          destinationId: observed.destinationId,
          sourceFromPath: observed.sourceFromPath,
          sourceId: observed.sourceId,
          tabId,
        }, Date.now())).then(
            () => sendResponse({ok: true}),
            () => sendResponse({ok: false}),
        );
      });
      return true;
    }
    return false;
  }

  private async restore(): Promise<void> {
    const area = chrome.storage?.session;
    if (area !== undefined) {
      const stored = await sessionGet(area, SESSION_KEY);
      const persisted = asPersistedCopy(stored[SESSION_KEY]);
      if (persisted !== null) {
        this.prompts = persisted.prompts;
        this.tracker = persisted.tracker;
      }
    }
    this.hydrated = true;
    const queued = this.pending;
    this.pending = [];
    for (const work of queued) {
      work();
    }
  }

  private afterHydration(work: () => void): void {
    if (!this.hydrated) {
      this.pending.push(work);
      return;
    }
    work();
  }

  private async note(next: {signal: CopySignal | null; state: CopyTrackerState}): Promise<void> {
    this.tracker = next.state;
    this.persist();
    if (next.signal !== null) {
      await this.prompt(next.signal);
    }
  }

  private async prompt(signal: CopySignal): Promise<void> {
    if (this.prompts.some((prompt) =>
      prompt.destinationId === signal.destinationId
      && Date.now() - prompt.at <= PROMPT_TTL_MS)) {
      return;
    }
    const sourceHasJournal = await characterHasJournalOrPhotos(signal.sourceId);
    const destinationHasJournal = await characterHasJournalOrPhotos(signal.destinationId);
    if (!sourceHasJournal || destinationHasJournal) {
      return;
    }
    const prompt = {...signal, at: Date.now()};
    this.prompts = [
      ...this.prompts.filter((item) => item.destinationId !== signal.destinationId),
      prompt,
    ];
    this.persist();
    await sendTabMessage(signal.tabId, createCopyPrompt(signal.sourceId, signal.destinationId))
        .catch(() => undefined);
  }

  private promptsFor(tabId: number): CopyPromptMessage[] {
    const now = Date.now();
    this.prompts = this.prompts.filter((prompt) => now - prompt.at <= PROMPT_TTL_MS);
    return this.prompts
        .filter((prompt) => prompt.tabId === tabId)
        .map((prompt) => createCopyPrompt(prompt.sourceId, prompt.destinationId));
  }

  private async answer(
      decision: {decision: 'copy' | 'skip'; destinationId: string; sourceId: string},
      tabId: number,
  ): Promise<unknown> {
    const prompt = this.prompts.find((item) =>
      item.sourceId === decision.sourceId
      && item.destinationId === decision.destinationId
      && (item.tabId === tabId || this.prompts.filter((candidate) =>
        candidate.destinationId === decision.destinationId).length === 1));
    if (prompt === undefined) {
      return {
        message: 'The journal was left where it was.',
        source: COPY_MESSAGE_SOURCE,
        type: 'copy:error',
      };
    }
    this.prompts = this.prompts.filter((item) => item !== prompt);
    this.persist();
    if (decision.decision === 'skip') {
      return {source: COPY_MESSAGE_SOURCE, type: 'copy:decision:success'};
    }
    try {
      await duplicateCharacterJournal(decision.sourceId, decision.destinationId);
      return {source: COPY_MESSAGE_SOURCE, type: 'copy:decision:success'};
    } catch (error) {
      this.prompts = [...this.prompts, prompt];
      this.persist();
      return {
        message: error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'The journal could not be copied.',
        source: COPY_MESSAGE_SOURCE,
        type: 'copy:error',
      };
    }
  }

  private persist(): void {
    const area = chrome.storage?.session;
    if (area === undefined) {
      return;
    }
    const payload: PersistedCopy = {prompts: this.prompts, tracker: this.tracker};
    area.set({[SESSION_KEY]: payload}, () => undefined);
  }
}

function sessionGet(
    area: chrome.storage.StorageArea,
    key: string,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    area.get(key, (items) => {
      const message = chrome.runtime.lastError?.message;
      if (message !== undefined) {
        reject(new Error(message));
        return;
      }
      resolve(items);
    });
  });
}

function sendTabMessage(tabId: number, message: unknown): Promise<void> {
  if (tabId < 0) {
    return Promise.reject(new Error('Character copy had no tab to prompt.'));
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      const messageText = chrome.runtime.lastError?.message;
      if (messageText !== undefined) {
        reject(new Error(messageText));
        return;
      }
      resolve();
    });
  });
}

function asPersistedCopy(value: unknown): PersistedCopy | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as PersistedCopy;
  if (!Array.isArray(record.prompts) || typeof record.tracker !== 'object' || record.tracker === null) {
    return null;
  }
  if (!Array.isArray(record.tracker.clicks) || !Array.isArray(record.tracker.observed)) {
    return null;
  }
  return record;
}
