import {
  libraryBlockedError,
  listFolderJournals,
  readFolderNotes,
  resolveLibrary,
  writeFolderNotes,
} from '../platform/chrome/folder-library';
import {isLibraryRequest} from '../platform/chrome/folder-library-client';

const LIBRARY_MESSAGE_SOURCE = 'beyond-full-art-library';

export function installLibraryMessageHandler(): void {
  chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
    if (!isLibraryRequest(rawMessage)) {
      return false;
    }
    void handleLibraryRequest(rawMessage)
        .then((records) => {
          sendResponse({
            records,
            source: LIBRARY_MESSAGE_SOURCE,
            type: 'library:notes:success',
          });
        })
        .catch((error: unknown) => {
          sendResponse({
            message: error instanceof Error && error.message.trim() !== ''
              ? error.message
              : 'The folder library could not be updated.',
            source: LIBRARY_MESSAGE_SOURCE,
            type: 'library:error',
          });
        });
    return true;
  });
}

async function handleLibraryRequest(request: {
  characterId?: string;
  records?: unknown[];
  type: 'library:list-notes' | 'library:read-notes' | 'library:write-notes';
}): Promise<unknown[]> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind !== 'ready') {
    throw new Error('The folder is not the place art and notes are saved.');
  }
  switch (request.type) {
    case 'library:list-notes':
      return listFolderJournals(library.directory);
    case 'library:read-notes':
      return readFolderNotes(library.directory, requiredCharacterId(request.characterId));
    case 'library:write-notes':
      await writeFolderNotes(
          library.directory,
          requiredCharacterId(request.characterId),
          request.records ?? [],
      );
      return [];
  }
}

function requiredCharacterId(characterId: string | undefined): string {
  if (characterId === undefined || !/^[A-Za-z0-9_-]+$/.test(characterId)) {
    throw new Error('The character id could not be used in the folder.');
  }
  return characterId;
}
