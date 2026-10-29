import {
  libraryBlockedError,
  listFolderJournals,
  readFolderNotes,
  readFolderPhotoCatalogFile,
  resolveLibrary,
  writeFolderNotes,
  writeFolderPhotoCatalogFile,
} from '../platform/chrome/folder-library';
import {isLibraryRequest} from '../platform/chrome/folder-library-client';
import {isTrustedMessageSender} from './message-sender';

const LIBRARY_MESSAGE_SOURCE = 'beyond-full-art-library';

export function installLibraryMessageHandler(): void {
  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    if (!isTrustedMessageSender(sender)) {
      return false;
    }
    if (!isLibraryRequest(rawMessage)) {
      return false;
    }
    void handleLibraryRequest(rawMessage)
        .then((result) => {
          sendResponse({
            present: result.present,
            records: result.records,
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
  type: 'library:list-notes' | 'library:read-notes' | 'library:read-photos' | 'library:write-notes' | 'library:write-photos';
}): Promise<{present?: boolean; records: unknown[]}> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind !== 'ready') {
    throw new Error('The folder is not the place art and notes are saved.');
  }
  switch (request.type) {
    case 'library:list-notes':
      return {records: await listFolderJournals(library.directory)};
    case 'library:read-notes':
      return {
        records: await readFolderNotes(
            library.directory,
            requiredCharacterId(request.characterId),
        ),
      };
    case 'library:write-notes':
      await writeFolderNotes(
          library.directory,
          requiredCharacterId(request.characterId),
          request.records ?? [],
      );
      return {records: []};
    case 'library:read-photos': {
      const catalog = await readFolderPhotoCatalogFile(
          library.directory,
          requiredCharacterId(request.characterId),
      );
      return {present: catalog.present, records: catalog.images};
    }
    case 'library:write-photos':
      await writeFolderPhotoCatalogFile(
          library.directory,
          requiredCharacterId(request.characterId),
          request.records ?? [],
      );
      return {records: []};
  }
}

function requiredCharacterId(characterId: string | undefined): string {
  if (characterId === undefined || !/^[A-Za-z0-9_-]+$/.test(characterId)) {
    throw new Error('The character id could not be used in the folder.');
  }
  return characterId;
}
