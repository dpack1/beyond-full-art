import {installDeletionCleanup} from './deletion-cleanup';
import {installJournalImageMessageHandler} from './journal-image-handler';
import {installLibraryMessageHandler} from './library-handler';
import {installFolderSettingsSync} from '../platform/chrome/folder-settings';
import type {
  CharacterArtMetadata,
  CharacterPortraitCropMetadata,
  SaveCharacterArtInput,
  SaveCharacterPortraitCropInput,
} from '../features/character-art/art-types';
import {
  CHARACTER_ART_SCHEMA_VERSION,
  CHARACTER_PORTRAIT_CROP_SCHEMA_VERSION,
} from '../features/character-art/art-types';
import {
  asCharacterArtRequest,
  CHARACTER_ART_MESSAGE_SOURCE,
  createDeleteCharacterArtSuccessResponse,
  createGetCharacterArtCropImageDataSuccessResponse,
  createGetCharacterArtCropMetadataSuccessResponse,
  createErrorResponse,
  createGetCharacterArtImageDataSuccessResponse,
  createGetCharacterArtMetadataSuccessResponse,
  createListCharacterArtMetadataSuccessResponse,
  createSaveCharacterArtCropSuccessResponse,
  createSaveCharacterArtSuccessResponse,
} from '../platform/chrome/messages';
import {
  deleteFolderArt,
  libraryBlockedError,
  listFolderArtMetadata,
  readFolderArtBytes,
  readFolderArtMetadata,
  readFolderCropBytes,
  readFolderCropMetadata,
  resolveLibrary,
  saveFolderCrop,
  saveFolderFullArt,
} from '../platform/chrome/folder-library';
import {
  deleteStoredCharacterArtBlob,
  getStoredCharacterArtBlob,
  putStoredCharacterArtBlob,
} from '../platform/chrome/indexed-db';
import {
  deleteStoredCharacterArtMetadata,
  deleteStoredCharacterPortraitCropMetadata,
  getAllStoredCharacterArtMetadata,
  getStoredCharacterArtMetadata,
  getStoredCharacterPortraitCropMetadata,
  setStoredCharacterArtMetadata,
  setStoredCharacterPortraitCropMetadata,
} from '../platform/chrome/storage';

installJournalImageMessageHandler();
installLibraryMessageHandler();
installFolderSettingsSync();
installDeletionCleanup({deleteArt: deleteCharacterArt});

chrome.runtime.onMessage.addListener((rawMessage, _sender, sendResponse) => {
  const request = asCharacterArtRequest(rawMessage);
  if (request === null) {
    if (isMalformedCharacterArtMessage(rawMessage)) {
      sendResponse(createErrorResponse(
          rawMessage.type,
          'Received an invalid character-art request.',
      ));
    }
    return false;
  }

  void handleCharacterArtRequest(request)
      .then((response) => {
        sendResponse(response);
      })
      .catch((error) => {
        sendResponse(createErrorResponse(
            request.type,
            asErrorMessage(error, 'The requested operation failed.'),
        ));
      });

  return true;
});

async function handleCharacterArtRequest(
    request: ReturnType<typeof asCharacterArtRequest> extends infer T
      ? Exclude<T, null>
      : never,
) {
  switch (request.type) {
    case 'art:delete':
      await deleteCharacterArt(request.characterId);
      return createDeleteCharacterArtSuccessResponse();
    case 'art:get-image-data':
      return createGetCharacterArtImageDataSuccessResponse(
          await getCharacterArtImageData(request.characterId),
      );
    case 'art:get-crop-image-data':
      return createGetCharacterArtCropImageDataSuccessResponse(
          await getCharacterPortraitCropImageData(request.characterId),
      );
    case 'art:get-metadata':
      return createGetCharacterArtMetadataSuccessResponse(
          await readArtMetadata(request.characterId),
      );
    case 'art:list-metadata':
      return createListCharacterArtMetadataSuccessResponse(
          await listArtMetadata(),
      );
    case 'art:get-crop-metadata':
      return createGetCharacterArtCropMetadataSuccessResponse(
          await readCropMetadata(request.characterId),
      );
    case 'art:save': {
      if (request.byteBuffer === undefined) {
        throw new Error('Character-art save request was missing binary data.');
      }

      return createSaveCharacterArtSuccessResponse(await saveCharacterArt({
        byteBuffer: request.byteBuffer,
        byteSize: request.byteSize,
        characterId: request.characterId,
        fileName: request.fileName,
        height: request.height,
        loadedSha256: request.loadedSha256,
        mimeType: request.mimeType,
        width: request.width,
      }));
    }
    case 'art:save-crop': {
      if (request.byteBuffer === undefined) {
        throw new Error('Portrait-crop save request was missing binary data.');
      }

      return createSaveCharacterArtCropSuccessResponse(
          await saveCharacterPortraitCrop({
            byteBuffer: request.byteBuffer,
            byteSize: request.byteSize,
            characterId: request.characterId,
            cropRect: request.cropRect,
            fileName: request.fileName,
            height: request.height,
            mimeType: request.mimeType,
            sourceArtBlobKey: request.sourceArtBlobKey,
            width: request.width,
          }),
      );
    }
  }
}

function asErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message;
  }

  return fallbackMessage;
}

async function deleteCharacterArt(characterId: string): Promise<void> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    await deleteFolderArt(library.directory, characterId);
    return;
  }
  const metadata = await getStoredCharacterArtMetadata(characterId);
  const cropMetadata = await getStoredCharacterPortraitCropMetadata(characterId);
  if (metadata === null) {
    if (cropMetadata !== null) {
      await deleteStoredCharacterPortraitCropMetadata(characterId);
      await deleteStoredCharacterArtBlob(cropMetadata.blobKey);
    }
    return;
  }

  await deleteStoredCharacterArtMetadata(characterId);
  if (cropMetadata !== null) {
    await deleteStoredCharacterPortraitCropMetadata(characterId);
  }

  const blobKeys = [
    metadata.blobKey,
    ...(cropMetadata === null ? [] : [cropMetadata.blobKey]),
  ];
  for (const blobKey of blobKeys) {
    await deleteStoredCharacterArtBlob(blobKey);
  }
}

async function getCharacterArtImageData(characterId: string) {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    const metadata = await readFolderArtMetadata(library.directory, characterId);
    if (metadata === null) {
      return null;
    }
    const bytes = await readFolderArtBytes(library.directory, characterId);
    if (bytes === null) {
      throw new Error('Stored full art could not be loaded.');
    }
    return {
      byteBuffer: bytesToArrayBuffer(bytes),
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
    };
  }
  const metadata = await getStoredCharacterArtMetadata(characterId);
  if (metadata === null) {
    return null;
  }

  const blob = await getStoredCharacterArtBlob(metadata.blobKey);
  if (blob === null) {
    throw new Error('Stored full art could not be loaded.');
  }

  return {
    byteBuffer: await blob.arrayBuffer(),
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
  };
}

async function getCharacterPortraitCropImageData(characterId: string) {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    const metadata = await readFolderCropMetadata(library.directory, characterId);
    if (metadata === null) {
      return null;
    }
    const bytes = await readFolderCropBytes(library.directory, characterId);
    if (bytes === null) {
      throw new Error('Stored portrait crop could not be loaded.');
    }
    return {
      byteBuffer: bytesToArrayBuffer(bytes),
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
    };
  }
  const metadata = await getStoredCharacterPortraitCropMetadata(characterId);
  if (metadata === null) {
    return null;
  }

  const blob = await getStoredCharacterArtBlob(metadata.blobKey);
  if (blob === null) {
    throw new Error('Stored portrait crop could not be loaded.');
  }

  return {
    byteBuffer: await blob.arrayBuffer(),
    fileName: metadata.fileName,
    mimeType: metadata.mimeType,
  };
}

async function saveCharacterArt(
    input: SaveCharacterArtInput,
): Promise<CharacterArtMetadata> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  const existingMetadata = library.kind === 'ready'
    ? await readFolderArtMetadata(library.directory, input.characterId)
    : await getStoredCharacterArtMetadata(input.characterId);
  const existingCropMetadata = library.kind === 'ready'
    ? await readFolderCropMetadata(library.directory, input.characterId)
    : await getStoredCharacterPortraitCropMetadata(input.characterId);
  const createdAt = existingMetadata?.createdAt ?? new Date().toISOString();
  const nextBlobKey = createBlobKey(input.characterId);
  const nextMetadata: CharacterArtMetadata = {
    blobKey: nextBlobKey,
    byteSize: input.byteSize,
    characterId: input.characterId,
    createdAt,
    fileName: input.fileName,
    height: input.height,
    mimeType: input.mimeType,
    schemaVersion: CHARACTER_ART_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    width: input.width,
  };

  const nextBlob = new Blob([input.byteBuffer], {type: input.mimeType});
  if (library.kind === 'ready') {
    await saveFolderFullArt(
        library.directory,
        nextMetadata,
        new Uint8Array(input.byteBuffer),
        undefined,
        input.loadedSha256,
    );
    return nextMetadata;
  }

  await putStoredCharacterArtBlob(nextBlobKey, nextBlob);

  try {
    await setStoredCharacterArtMetadata(nextMetadata);
  } catch (error) {
    await deleteStoredCharacterArtBlob(nextBlobKey);
    throw error;
  }

  if (existingCropMetadata !== null) {
    try {
      await deleteStoredCharacterPortraitCropMetadata(input.characterId);
      await deleteStoredCharacterArtBlob(existingCropMetadata.blobKey);
    } catch {
      // Keep the successful full-art write and leave orphan cleanup for later.
    }
  }

  if (existingMetadata !== null && existingMetadata.blobKey !== nextBlobKey) {
    try {
      await deleteStoredCharacterArtBlob(existingMetadata.blobKey);
    } catch {
      // Keep the successful metadata write and leave orphan cleanup for later.
    }
  }

  return nextMetadata;
}

async function saveCharacterPortraitCrop(
    input: SaveCharacterPortraitCropInput,
): Promise<CharacterPortraitCropMetadata> {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  const fullArtMetadata = library.kind === 'ready'
    ? await readFolderArtMetadata(library.directory, input.characterId)
    : await getStoredCharacterArtMetadata(input.characterId);
  if (fullArtMetadata === null) {
    throw new Error('Stored full art is required before creating a portrait crop.');
  }

  if (fullArtMetadata.blobKey !== input.sourceArtBlobKey) {
    throw new Error('Stored full art changed before the portrait crop could be saved.');
  }

  const existingCropMetadata = library.kind === 'ready'
    ? await readFolderCropMetadata(library.directory, input.characterId)
    : await getStoredCharacterPortraitCropMetadata(input.characterId);
  const createdAt = existingCropMetadata?.createdAt ?? new Date().toISOString();
  const nextBlobKey = createBlobKey(input.characterId);
  const nextMetadata: CharacterPortraitCropMetadata = {
    blobKey: nextBlobKey,
    byteSize: input.byteSize,
    characterId: input.characterId,
    createdAt,
    cropRect: input.cropRect,
    fileName: input.fileName,
    height: input.height,
    mimeType: input.mimeType,
    schemaVersion: CHARACTER_PORTRAIT_CROP_SCHEMA_VERSION,
    sourceArtBlobKey: input.sourceArtBlobKey,
    updatedAt: new Date().toISOString(),
    width: input.width,
  };

  const nextBlob = new Blob([input.byteBuffer], {type: input.mimeType});
  if (library.kind === 'ready') {
    await saveFolderCrop(
        library.directory,
        nextMetadata,
        new Uint8Array(input.byteBuffer),
    );
    return nextMetadata;
  }
  await putStoredCharacterArtBlob(nextBlobKey, nextBlob);

  try {
    await setStoredCharacterPortraitCropMetadata(nextMetadata);
  } catch (error) {
    await deleteStoredCharacterArtBlob(nextBlobKey);
    throw error;
  }

  if (existingCropMetadata !== null && existingCropMetadata.blobKey !== nextBlobKey) {
    try {
      await deleteStoredCharacterArtBlob(existingCropMetadata.blobKey);
    } catch {
      // Keep the successful crop write and leave orphan cleanup for later.
    }
  }

  return nextMetadata;
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function readArtMetadata(characterId: string) {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    return readFolderArtMetadata(library.directory, characterId);
  }
  return getStoredCharacterArtMetadata(characterId);
}

async function readCropMetadata(characterId: string) {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    return readFolderCropMetadata(library.directory, characterId);
  }
  return getStoredCharacterPortraitCropMetadata(characterId);
}

async function listArtMetadata() {
  const library = await resolveLibrary();
  if (library.kind === 'blocked') {
    throw libraryBlockedError();
  }
  if (library.kind === 'ready') {
    return listFolderArtMetadata(library.directory);
  }
  return getAllStoredCharacterArtMetadata();
}

function createBlobKey(characterId: string): string {
  const randomSuffix = self.crypto.randomUUID();
  return `character-art:${characterId}:${randomSuffix}`;
}

function isMalformedCharacterArtMessage(
    value: unknown,
): value is {
  type:
  | 'art:delete'
  | 'art:get-crop-image-data'
  | 'art:get-crop-metadata'
  | 'art:get-image-data'
  | 'art:get-metadata'
  | 'art:list-metadata'
  | 'art:save'
  | 'art:save-crop'
} {
  return (
    typeof value === 'object'
    && value !== null
    && 'source' in value
    && 'type' in value
    && value.source === CHARACTER_ART_MESSAGE_SOURCE
    && (
      value.type === 'art:delete'
      || value.type === 'art:get-crop-image-data'
      || value.type === 'art:get-crop-metadata'
      || value.type === 'art:get-image-data'
      || value.type === 'art:get-metadata'
      || value.type === 'art:list-metadata'
      || value.type === 'art:save-crop'
      || value.type === 'art:save'
    )
  );
}
