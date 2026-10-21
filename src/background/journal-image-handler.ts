import {journalImageStorageFullMessage} from '../features/character-journal/character-journal-image-fit';
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

export function installJournalImageMessageHandler(): void {
  chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
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
  switch (request.type) {
    case 'journal:delete-image':
      await deleteStoredCharacterArtBlob(request.blobKey);
      return createDeleteJournalImageSuccessResponse();
    case 'journal:get-image':
      return createGetJournalImageSuccessResponse(
          await readJournalImage(request.blobKey),
      );
    case 'journal:put-image': {
      const byteBuffer = request.byteBuffer;
      if (byteBuffer === undefined) {
        throw new Error('Journal photo save request was missing binary data.');
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
