const LIBRARY_MESSAGE_SOURCE = 'beyond-full-art-library';

interface LibrarySuccess {
  records: unknown[];
  source: typeof LIBRARY_MESSAGE_SOURCE;
  type: 'library:notes:success';
}

interface LibraryError {
  message: string;
  source: typeof LIBRARY_MESSAGE_SOURCE;
  type: 'library:error';
}

type LibraryResponse = LibraryError | LibrarySuccess;

export async function readFolderJournalRecords(characterId: string): Promise<unknown[]> {
  const response = await sendLibraryMessage({
    characterId,
    source: LIBRARY_MESSAGE_SOURCE,
    type: 'library:read-notes',
  });
  return response.records;
}

export async function listFolderJournalRecords(): Promise<{
  characterId: string;
  records: unknown[];
}[]> {
  const response = await sendLibraryMessage({
    source: LIBRARY_MESSAGE_SOURCE,
    type: 'library:list-notes',
  });
  return response.records.filter(isJournalGroup);
}

export async function writeFolderJournalRecords(
    characterId: string,
    records: readonly unknown[],
): Promise<void> {
  await sendLibraryMessage({
    characterId,
    records,
    source: LIBRARY_MESSAGE_SOURCE,
    type: 'library:write-notes',
  });
}

export function isLibraryRequest(value: unknown): value is {
  characterId?: string;
  records?: unknown[];
  source: typeof LIBRARY_MESSAGE_SOURCE;
  type: 'library:list-notes' | 'library:read-notes' | 'library:write-notes';
} {
  if (!isRecord(value) || value.source !== LIBRARY_MESSAGE_SOURCE) {
    return false;
  }
  return value.type === 'library:list-notes'
    || value.type === 'library:read-notes'
    || value.type === 'library:write-notes';
}

async function sendLibraryMessage(message: {
  characterId?: string;
  records?: readonly unknown[];
  source: typeof LIBRARY_MESSAGE_SOURCE;
  type: 'library:list-notes' | 'library:read-notes' | 'library:write-notes';
}): Promise<LibrarySuccess> {
  if (typeof chrome === 'undefined' || chrome.runtime?.sendMessage === undefined) {
    throw new Error('The folder library could not be reached.');
  }
  const response = await new Promise<unknown>((resolve, reject) => {
    chrome.runtime.sendMessage(message, (value: unknown) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }
      resolve(value);
    });
  });
  if (!isLibrarySuccess(response)) {
    throw new Error(isLibraryError(response)
      ? response.message
      : 'The folder library did not respond.');
  }
  return response;
}

function isJournalGroup(value: unknown): value is {characterId: string; records: unknown[]} {
  return isRecord(value)
    && typeof value.characterId === 'string'
    && Array.isArray(value.records);
}

function isLibrarySuccess(value: unknown): value is LibrarySuccess {
  return isRecord(value)
    && value.source === LIBRARY_MESSAGE_SOURCE
    && value.type === 'library:notes:success'
    && Array.isArray(value.records);
}

function isLibraryError(value: unknown): value is LibraryError {
  return isRecord(value)
    && value.type === 'library:error'
    && typeof value.message === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
