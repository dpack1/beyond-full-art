import {
  characterHasJournalOrPhotos,
  deleteCharacterJournalAndPhotos,
} from './cleanup-journal';
import {
  getCleanupPreference,
  setCleanupPreference,
} from '../platform/chrome/cleanup-preference';
import {readFolderArtMetadata, resolveLibrary} from '../platform/chrome/folder-library';
import {getStoredCharacterArtMetadata} from '../platform/chrome/storage';
import {
  applyCleanupChoice,
  applyVerifiedCharacterDeletion,
} from '../features/character-deletion/cleanup-decision';
import {
  asCleanupClaim,
  asCleanupConfirmed,
  asCleanupDecision,
  asCleanupObserved,
  asCleanupPreview,
  asCleanupSucceeded,
  CLEANUP_MESSAGE_SOURCE,
  createCleanupFailed,
  createCleanupPrompt,
  type CleanupDecisionMessage,
  type CleanupPromptMessage,
} from '../features/character-deletion/cleanup-messages';
import {
  createDeletionTrackerState,
  noteDeletionCompleted,
  noteDeletionConfirmed,
  noteDeletionFailed,
  noteDeletionRequest,
  noteFetchSucceeded,
  notePageDeletion,
  type DeletionCleanupSignal,
  type DeletionTrackerState,
} from '../features/character-deletion/deletion-correlation';
import {
  CHARACTER_DELETION_URL_PATTERN,
  characterIdFromWebRequestBody,
  isWatchedCharacterDeletion,
} from '../features/character-deletion/deletion-request';
import {isTrustedMessageSender} from './message-sender';

const SESSION_KEY = 'bfa.deletionCleanup.state';
const PROMPT_TTL_MS = 30 * 60 * 1000;
const DELETE_FAILED_MESSAGE = 'Stored full art could not be deleted.';

interface PromptRecord {
  at: number;
  characterId: string;
  hasArt?: boolean;
  hasJournalData: boolean;
  tabId: number;
}

interface PersistedCleanup {
  prompts: PromptRecord[];
  tracker: DeletionTrackerState;
}

export function installDeletionCleanup(deps: {
  deleteArt: (characterId: string) => Promise<void>;
}): void {
  if (chrome.webRequest?.onBeforeRequest === undefined) {
    return;
  }
  try {
    installDeletionListeners(deps.deleteArt);
  } catch {
    // A permission or API failure leaves cleanup off. Art storage still runs.
  }
}

function installDeletionListeners(deleteArt: (characterId: string) => Promise<void>): void {
  const runtime = new DeletionCleanupRuntime(deleteArt);
  const filter = {urls: [CHARACTER_DELETION_URL_PATTERN]};
  chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        runtime.beforeRequest(details);
        return undefined;
      },
      filter,
      ['requestBody'],
  );
  chrome.webRequest.onCompleted.addListener(
      (details) => {
        runtime.completed(details);
      },
      filter,
  );
  chrome.webRequest.onErrorOccurred.addListener(
      (details) => runtime.failed(details.requestId),
      filter,
  );
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) =>
    runtime.onMessage(message, sender, sendResponse));
  void runtime.hydrate();
}

class DeletionCleanupRuntime {
  private hydrated = false;
  private pending: Array<() => void> = [];
  private prompts: PromptRecord[] = [];
  private tail: Promise<void> = Promise.resolve();
  private tracker: DeletionTrackerState = createDeletionTrackerState();

  constructor(private readonly deleteArt: (characterId: string) => Promise<void>) {}

  beforeRequest(details: chrome.webRequest.OnBeforeRequestDetails): void {
    this.afterHydration(() => {
      if (!isWatchedDeletion(details)) {
        return;
      }
      const next = noteDeletionRequest(this.tracker, {
        at: Date.now(),
        characterId: characterIdFromWebRequestBody(details.requestBody),
        requestId: details.requestId,
        tabId: details.tabId,
      });
      this.tracker = next.state;
      this.persist();
    });
  }

  completed(details: chrome.webRequest.OnCompletedDetails): void {
    this.afterHydration(() => {
      if (!isWatchedDeletion(details)) {
        return;
      }
      const next = noteDeletionCompleted(this.tracker, {
        at: Date.now(),
        requestId: details.requestId,
        statusCode: details.statusCode,
        tabId: details.tabId,
      });
      this.tracker = next.state;
      this.persist();
      if (next.signal !== null) {
        this.enqueueSignal(next.signal);
      }
    });
  }

  failed(requestId: string): void {
    this.afterHydration(() => {
      const next = noteDeletionFailed(this.tracker, {at: Date.now(), requestId});
      this.tracker = next.state;
      this.persist();
    });
  }

  onMessage(
      message: unknown,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
  ): boolean {
    if (!isTrustedMessageSender(sender)) {
      return false;
    }
    const tabId = sender.tab?.id;
    if (asCleanupClaim(message) !== null && tabId !== undefined) {
      this.afterHydration(() => {
        sendResponse({
          prompts: this.promptsFor(tabId),
          source: CLEANUP_MESSAGE_SOURCE,
          type: 'cleanup:claim:result',
        });
      });
      return true;
    }
    const preview = asCleanupPreview(message);
    if (preview !== null) {
      this.afterHydration(() => {
        void storedDataForPreview(preview.characterId).then(sendResponse);
      });
      return true;
    }
    const decision = asCleanupDecision(message);
    if (decision !== null) {
      this.afterHydration(() => {
        void this.answer(decision, sender.tab?.id).then(sendResponse);
      });
      return true;
    }
    const confirmed = asCleanupConfirmed(message);
    if (confirmed !== null && tabId !== undefined) {
      this.afterHydration(() => {
        this.noteTracked(noteDeletionConfirmed(this.tracker, {
          at: Date.now(),
          characterId: confirmed.characterId,
          tabId,
        }));
      });
    }
    const succeeded = asCleanupSucceeded(message);
    if (succeeded !== null && tabId !== undefined) {
      this.afterHydration(() => {
        this.noteTracked(noteFetchSucceeded(this.tracker, {
          at: Date.now(),
          statusCode: succeeded.status,
          tabId,
        }));
      });
    }
    const observed = asCleanupObserved(message);
    if (observed !== null && tabId !== undefined) {
      this.afterHydration(() => {
        const next = notePageDeletion(this.tracker, {
          at: Date.now(),
          characterId: observed.characterId,
          statusCode: observed.status,
          tabId,
        });
        this.tracker = next.state;
        this.persist();
        if (next.signal !== null) {
          this.enqueueSignal(next.signal);
        }
      });
    }
    return false;
  }

  async hydrate(): Promise<void> {
    const stored = await readSession();
    if (stored !== null) {
      this.tracker = stored.tracker;
      this.prompts = stored.prompts;
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

  private enqueueSignal(signal: DeletionCleanupSignal): void {
    this.tail = this.tail.then(() => this.handleSignal(signal)).catch(() => undefined);
  }

  private noteTracked(next: {signal: DeletionCleanupSignal | null; state: DeletionTrackerState}): void {
    this.tracker = next.state;
    this.persist();
    if (next.signal !== null) {
      this.enqueueSignal(next.signal);
    }
  }

  private async handleSignal(signal: DeletionCleanupSignal): Promise<void> {
    if (this.prompts.some((prompt) =>
      prompt.characterId === signal.characterId
      && Date.now() - prompt.at <= PROMPT_TTL_MS)) {
      return;
    }
    const preference = await getCleanupPreference();
    const hasJournalData = await journalDataForPrompt(signal.characterId);
    let hasArt = false;
    try {
      hasArt = await fullArtExists(signal.characterId);
    } catch {
      hasArt = false;
    }
    const outcome = await applyVerifiedCharacterDeletion({
      artExists: async () => hasArt || hasJournalData,
      characterId: signal.characterId,
      deleteArt: this.deleteArt,
      preference: preference === 'delete' && hasJournalData ? 'ask' : preference,
      prompt: async (characterId) => {
        this.rememberPrompt({
          at: Date.now(),
          characterId,
          hasArt,
          hasJournalData,
          tabId: signal.tabId,
        });
        // The sheet often navigates away before the content script can answer.
        // The prompt stays stored so the next page in this tab can claim it.
        await sendTabMessage(
            signal.tabId,
            createCleanupPrompt(characterId, hasJournalData, hasArt),
        ).catch(() => undefined);
      },
      tabId: signal.tabId,
    });
    if (outcome === 'delete-failed') {
      await sendTabMessage(
          signal.tabId,
          createCleanupFailed(signal.characterId, DELETE_FAILED_MESSAGE),
      ).catch(() => undefined);
    }
  }

  private async answer(
      decision: CleanupDecisionMessage,
      tabId: number | undefined,
  ): Promise<unknown> {
    const prompt = this.promptForDecision(decision.characterId, tabId);
    if (prompt === undefined) {
      return {
        message: 'Stored full art was left in place.',
        source: CLEANUP_MESSAGE_SOURCE,
        type: 'cleanup:error',
      };
    }
    this.prompts = this.prompts.filter((candidate) => candidate !== prompt);
    this.persist();
    try {
      await applyCleanupChoice({
        decision: decision.decision,
        deleteArt: async () => {
          // Recheck at delete time. The stored flag can miss a journal that
          // was saved after the prompt, and folder mode used to skip the
          // browser copy.
          await deleteCharacterJournalAndPhotos(decision.characterId);
          await this.deleteArt(decision.characterId);
        },
        remember: decision.remember,
        setPreference: setCleanupPreference,
      });
      return {source: CLEANUP_MESSAGE_SOURCE, type: 'cleanup:decision:success'};
    } catch (error) {
      this.prompts = [...this.prompts, prompt];
      this.persist();
      const message = error instanceof Error && error.message.trim() !== ''
        ? error.message
        : DELETE_FAILED_MESSAGE;
      return {message, source: CLEANUP_MESSAGE_SOURCE, type: 'cleanup:error'};
    }
  }

  private promptForDecision(
      characterId: string,
      tabId: number | undefined,
  ): PromptRecord | undefined {
    const now = Date.now();
    const fresh = this.prompts.filter((candidate) => now - candidate.at <= PROMPT_TTL_MS);
    const sameTab = fresh.find((candidate) =>
      candidate.characterId === characterId && candidate.tabId === tabId);
    if (sameTab !== undefined) {
      return sameTab;
    }
    const sameCharacter = fresh.filter((candidate) => candidate.characterId === characterId);
    return sameCharacter.length === 1 ? sameCharacter[0] : undefined;
  }

  private promptsFor(tabId: number): CleanupPromptMessage[] {
    const now = Date.now();
    this.prompts = this.prompts.filter((prompt) => now - prompt.at <= PROMPT_TTL_MS);
    return this.prompts
        .filter((prompt) => prompt.tabId === tabId)
        .map((prompt) => createCleanupPrompt(
            prompt.characterId,
            prompt.hasJournalData,
            prompt.hasArt !== false,
        ));
  }

  private rememberPrompt(prompt: PromptRecord): void {
    this.prompts = this.prompts.filter((candidate) => candidate.characterId !== prompt.characterId);
    this.prompts.push(prompt);
    this.persist();
  }

  private persist(): void {
    const area = chrome.storage?.session;
    if (area === undefined) {
      return;
    }
    const payload: PersistedCleanup = {
      prompts: this.prompts,
      tracker: this.tracker,
    };
    area.set({[SESSION_KEY]: payload}, () => undefined);
  }
}

async function storedDataForPreview(characterId: string): Promise<{
  hasArt: boolean;
  hasJournalData: boolean;
  source: typeof CLEANUP_MESSAGE_SOURCE;
  type: 'cleanup:preview:result';
}> {
  const hasJournalData = await journalDataForPrompt(characterId);
  let hasArt = false;
  try {
    hasArt = await fullArtExists(characterId);
  } catch {
    hasArt = false;
  }
  return {
    hasArt,
    hasJournalData,
    source: CLEANUP_MESSAGE_SOURCE,
    type: 'cleanup:preview:result',
  };
}

async function journalDataForPrompt(characterId: string): Promise<boolean> {
  try {
    return await characterHasJournalOrPhotos(characterId);
  } catch {
    return true;
  }
}

async function fullArtExists(characterId: string): Promise<boolean> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    return false;
  }
  if (library.kind === 'ready') {
    return (await readFolderArtMetadata(library.directory, characterId)) !== null;
  }
  return (await getStoredCharacterArtMetadata(characterId)) !== null;
}

function isWatchedDeletion(details: {
  documentUrl?: string;
  initiator?: string;
  method: string;
  url: string;
}): boolean {
  return isWatchedCharacterDeletion(details);
}

function sendTabMessage(tabId: number, message: unknown): Promise<void> {
  if (tabId < 0) {
    return Promise.reject(new Error('Character deletion had no tab to prompt.'));
  }
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, () => {
      const error = chrome.runtime.lastError;
      if (error !== undefined) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

async function readSession(): Promise<PersistedCleanup | null> {
  const area = chrome.storage?.session;
  if (area === undefined) {
    return null;
  }
  const stored = await new Promise<Record<string, unknown>>((resolve, reject) => {
    area.get(SESSION_KEY, (items) => {
      const error = chrome.runtime.lastError;
      if (error !== undefined) {
        reject(new Error(error.message));
        return;
      }
      resolve(items);
    });
  });
  return asPersistedCleanup(stored[SESSION_KEY]);
}

function asPersistedCleanup(value: unknown): PersistedCleanup | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as PersistedCleanup;
  if (!Array.isArray(record.prompts) || typeof record.tracker !== 'object' || record.tracker === null) {
    return null;
  }
  if (!Array.isArray(record.tracker.requests) || !Array.isArray(record.tracker.resolved)) {
    return null;
  }
  if (!Array.isArray(record.tracker.observations)) {
    record.tracker.observations = [];
  }
  if (!Array.isArray(record.tracker.confirmations)) {
    record.tracker.confirmations = [];
  }
  if (!Array.isArray(record.tracker.successes)) {
    record.tracker.successes = [];
  }
  return record;
}
