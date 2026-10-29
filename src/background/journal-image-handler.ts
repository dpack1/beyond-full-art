import {journalImageStorageFullMessage} from '../features/character-journal/character-journal-image-fit';
import {
  deleteFolderJournalImage,
  libraryBlockedError,
  readFolderJournalImage,
  resolveLibrary,
  writeFolderJournalImage,
} from '../platform/chrome/folder-library';
import {
  asJournalImageRequest,
  createDeleteJournalImageSuccessResponse,
  createGetJournalImageSuccessResponse,
  createJournalImageErrorResponse,
  createPutJournalImageSuccessResponse,
  describeRejectedJournalImage,
  isMalformedJournalImageMessage,
  type JournalImageRequest,
  type StoredJournalImage,
} from '../platform/chrome/journal-messages';
import {
  deleteStoredCharacterArtBlob,
  getStoredCharacterArtBlob,
  putStoredCharacterArtBlob,
} from '../platform/chrome/indexed-db';
import {isTrustedMessageSender} from './message-sender';

export function installJournalImageMessageHandler(): void {
  chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
    if (!isTrustedMessageSender(sender)) {
      return false;
    }
    const request = asJournalImageRequest(rawMessage);
    if (request === null) {
      if (isMalformedJournalImageMessage(rawMessage)) {
        sendResponse(createJournalImageErrorResponse(
            rawMessage.type,
            describeRejectedJournalImage(rawMessage)
              ?? 'Received an invalid journal photo request.',
        ));
        return true;
      }

      return false;
    }

    void handleJournalImageRequest(request)
        .then((response) => {
          sendResponse(response);
        })
        .catch((error) => {
          sendResponse(createJournalImageErrorResponse(
              request.type,
              asErrorMessage(error),
          ));
        });

    return true;
  });
}

async function handleJournalImageRequest(request: JournalImageRequest) {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  switch (request.type) {
    case 'journal:delete-image':
      if (library.kind === 'ready') {
        await deleteFolderJournalImage(library.directory, request.blobKey);
      } else {
        await deleteStoredCharacterArtBlob(request.blobKey);
      }
      return createDeleteJournalImageSuccessResponse();
    case 'journal:get-image':
      return createGetJournalImageSuccessResponse(
          library.kind === 'ready'
            ? await readFolderJournalImage(library.directory, request.blobKey)
            : await readJournalImage(request.blobKey),
      );
    case 'journal:put-image': {
      const byteBuffer = request.byteBuffer;
      if (byteBuffer === undefined) {
        throw new Error('Journal photo save request was missing binary data.');
      }
      if (library.kind === 'ready') {
        if (request.characterId === undefined) {
          throw new Error('The photo could not be saved in the folder.');
        }
        const bytes = new Uint8Array(byteBuffer.byteLength);
        bytes.set(new Uint8Array(byteBuffer));
        await writeFolderJournalImage(
            library.directory,
            request.characterId,
            request.blobKey,
            bytes,
            request.mimeType,
        );
        return createPutJournalImageSuccessResponse();
      }

      try {
        await putStoredCharacterArtBlob(
            request.blobKey,
            new Blob([byteBuffer], {type: request.mimeType}),
        );
      } catch (error) {
        if (isQuotaError(error)) {
          throw new Error(journalImageStorageFullMessage(request.byteSize));
        }

        throw error;
      }
      return createPutJournalImageSuccessResponse();
    }
  }
}

async function readJournalImage(
    blobKey: string,
): Promise<StoredJournalImage | null> {
  const blob = await getStoredCharacterArtBlob(blobKey);
  if (blob === null) {
    return null;
  }

  if (!isSupportedMimeType(blob.type)) {
    throw new Error('Stored journal photo has an unsupported type.');
  }

  return {
    byteBuffer: await blob.arrayBuffer(),
    mimeType: blob.type,
  };
}

function isQuotaError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const name = 'name' in error && typeof error.name === 'string' ? error.name : '';
  const message = error instanceof Error ? error.message : '';
  return name === 'QuotaExceededError' || /quota/i.test(message);
}

function isSupportedMimeType(
    value: string,
): value is StoredJournalImage['mimeType'] {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return 'The journal photo operation failed.';
}
