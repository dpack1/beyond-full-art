import type {
  CharacterArtMetadata,
  CharacterId,
  CharacterPortraitCropMetadata,
  SaveCharacterArtInput,
  SaveCharacterPortraitCropInput,
  StoredCharacterArtData,
} from '../../features/character-art/art-types';
import {
  isCharacterArtMetadata,
  isCharacterPortraitCropMetadata,
  isSupportedCharacterArtMimeType,
} from '../../features/character-art/art-types';

type CharacterArtOperation =
  | 'art:delete'
  | 'art:get-crop-image-data'
  | 'art:get-crop-metadata'
  | 'art:get-image-data'
  | 'art:get-metadata'
  | 'art:list-metadata'
  | 'art:save-crop'
  | 'art:save';

export const CHARACTER_ART_MESSAGE_SOURCE = 'beyond-full-art';

interface CharacterArtEnvelope {
  source: typeof CHARACTER_ART_MESSAGE_SOURCE;
}

interface DeleteCharacterArtRequest extends CharacterArtEnvelope {
  characterId: CharacterId;
  type: 'art:delete';
}

interface DeleteCharacterArtSuccessResponse extends CharacterArtEnvelope {
  type: 'art:delete:success';
}

interface ErrorResponse extends CharacterArtEnvelope {
  message: string;
  operation: CharacterArtOperation;
  type: 'art:error';
}

interface GetCharacterArtImageDataRequest extends CharacterArtEnvelope {
  characterId: CharacterId;
  type: 'art:get-image-data';
}

interface GetCharacterArtCropImageDataRequest extends CharacterArtEnvelope {
  characterId: CharacterId;
  type: 'art:get-crop-image-data';
}

interface GetCharacterArtImageDataSuccessResponse extends CharacterArtEnvelope {
  imageData: {
    byteBase64?: string;
    byteBuffer?: ArrayBuffer;
    fileName: string;
    mimeType: StoredCharacterArtData['mimeType'];
  } | null;
  type: 'art:get-image-data:success';
}

interface GetCharacterArtCropImageDataSuccessResponse extends CharacterArtEnvelope {
  imageData: {
    byteBase64?: string;
    byteBuffer?: ArrayBuffer;
    fileName: string;
    mimeType: StoredCharacterArtData['mimeType'];
  } | null;
  type: 'art:get-crop-image-data:success';
}

interface GetCharacterArtMetadataRequest extends CharacterArtEnvelope {
  characterId: CharacterId;
  type: 'art:get-metadata';
}

interface ListCharacterArtMetadataRequest extends CharacterArtEnvelope {
  type: 'art:list-metadata';
}

interface GetCharacterArtCropMetadataRequest extends CharacterArtEnvelope {
  characterId: CharacterId;
  type: 'art:get-crop-metadata';
}

interface GetCharacterArtMetadataSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterArtMetadata | null;
  type: 'art:get-metadata:success';
}

interface ListCharacterArtMetadataSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterArtMetadata[];
  type: 'art:list-metadata:success';
}

interface GetCharacterArtCropMetadataSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterPortraitCropMetadata | null;
  type: 'art:get-crop-metadata:success';
}

interface SaveCharacterArtRequest extends CharacterArtEnvelope {
  byteBase64: string;
  byteBuffer?: ArrayBuffer;
  byteSize: number;
  characterId: CharacterId;
  fileName: string;
  height: number | null;
  mimeType: SaveCharacterArtInput['mimeType'];
  type: 'art:save';
  width: number | null;
}

interface SaveCharacterArtCropRequest extends CharacterArtEnvelope {
  byteBase64: string;
  byteBuffer?: ArrayBuffer;
  byteSize: number;
  characterId: CharacterId;
  cropRect: SaveCharacterPortraitCropInput['cropRect'];
  fileName: string;
  height: number;
  mimeType: SaveCharacterPortraitCropInput['mimeType'];
  sourceArtBlobKey: string;
  type: 'art:save-crop';
  width: number;
}

interface SaveCharacterArtSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterArtMetadata;
  type: 'art:save:success';
}

interface SaveCharacterArtCropSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterPortraitCropMetadata;
  type: 'art:save-crop:success';
}

export type CharacterArtRequest =
  | DeleteCharacterArtRequest
  | GetCharacterArtCropImageDataRequest
  | GetCharacterArtCropMetadataRequest
  | GetCharacterArtImageDataRequest
  | GetCharacterArtMetadataRequest
  | ListCharacterArtMetadataRequest
  | SaveCharacterArtCropRequest
  | SaveCharacterArtRequest;

type CharacterArtResponse =
  | DeleteCharacterArtSuccessResponse
  | ErrorResponse
  | GetCharacterArtCropImageDataSuccessResponse
  | GetCharacterArtCropMetadataSuccessResponse
  | GetCharacterArtImageDataSuccessResponse
  | GetCharacterArtMetadataSuccessResponse
  | ListCharacterArtMetadataSuccessResponse
  | SaveCharacterArtCropSuccessResponse
  | SaveCharacterArtSuccessResponse;

type ParsedCharacterArtResponse =
  | DeleteCharacterArtSuccessResponse
  | ErrorResponse
  | {
    imageData: StoredCharacterArtData | null;
    source: typeof CHARACTER_ART_MESSAGE_SOURCE;
    type: 'art:get-crop-image-data:success';
  }
  | {
    imageData: StoredCharacterArtData | null;
    source: typeof CHARACTER_ART_MESSAGE_SOURCE;
    type: 'art:get-image-data:success';
  }
  | GetCharacterArtCropMetadataSuccessResponse
  | GetCharacterArtMetadataSuccessResponse
  | ListCharacterArtMetadataSuccessResponse
  | SaveCharacterArtCropSuccessResponse
  | SaveCharacterArtSuccessResponse;

export function asCharacterArtRequest(
    value: unknown,
): CharacterArtRequest | null {
  if (
    !isRecord(value)
    || value.source !== CHARACTER_ART_MESSAGE_SOURCE
    || typeof value.type !== 'string'
  ) {
    return null;
  }

  switch (value.type) {
    case 'art:delete':
      if (typeof value.characterId !== 'string') {
        return null;
      }

      return {
        characterId: value.characterId,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:delete',
      };
    case 'art:get-image-data':
      if (typeof value.characterId !== 'string') {
        return null;
      }

      return {
        characterId: value.characterId,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-image-data',
      };
    case 'art:get-crop-image-data':
      if (typeof value.characterId !== 'string') {
        return null;
      }

      return {
        characterId: value.characterId,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-crop-image-data',
      };
    case 'art:get-metadata':
      if (typeof value.characterId !== 'string') {
        return null;
      }

      return {
        characterId: value.characterId,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-metadata',
      };
    case 'art:list-metadata':
      return {
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:list-metadata',
      };
    case 'art:get-crop-metadata':
      if (typeof value.characterId !== 'string') {
        return null;
      }

      return {
        characterId: value.characterId,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-crop-metadata',
      };
    case 'art:save':
      if (
        typeof value.characterId !== 'string'
        || typeof value.fileName !== 'string'
        || typeof value.byteSize !== 'number'
        || typeof value.mimeType !== 'string'
        || !isSupportedCharacterArtMimeType(value.mimeType)
        || typeof value.byteBase64 !== 'string'
        || !isNullableNumber(value.height)
        || !isNullableNumber(value.width)
      ) {
        return null;
      }

      const byteBuffer = decodeBase64ToArrayBuffer(value.byteBase64);

      return {
        byteBase64: value.byteBase64,
        byteBuffer,
        byteSize: value.byteSize,
        characterId: value.characterId,
        fileName: value.fileName,
        height: value.height,
        mimeType: value.mimeType,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:save',
        width: value.width,
      };
    case 'art:save-crop':
      if (
        typeof value.characterId !== 'string'
        || typeof value.fileName !== 'string'
        || typeof value.byteSize !== 'number'
        || typeof value.mimeType !== 'string'
        || !isSupportedCharacterArtMimeType(value.mimeType)
        || typeof value.byteBase64 !== 'string'
        || typeof value.height !== 'number'
        || typeof value.sourceArtBlobKey !== 'string'
        || typeof value.width !== 'number'
        || !isCharacterPortraitCropRect(value.cropRect)
      ) {
        return null;
      }

      return {
        byteBase64: value.byteBase64,
        byteBuffer: decodeBase64ToArrayBuffer(value.byteBase64),
        byteSize: value.byteSize,
        characterId: value.characterId,
        cropRect: value.cropRect,
        fileName: value.fileName,
        height: value.height,
        mimeType: value.mimeType,
        sourceArtBlobKey: value.sourceArtBlobKey,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:save-crop',
        width: value.width,
      };
    default:
      return null;
  }
}

export function isCharacterArtOperationType(value: unknown):
boolean {
  return (
    value === 'art:delete'
    || value === 'art:get-crop-image-data'
    || value === 'art:get-crop-metadata'
    || value === 'art:get-image-data'
    || value === 'art:get-metadata'
    || value === 'art:list-metadata'
    || value === 'art:save-crop'
    || value === 'art:save'
  );
}

export async function deleteStoredCharacterArt(
    characterId: CharacterId,
): Promise<void> {
  const response = await sendCharacterArtMessage({
    characterId,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:delete',
  });

  if (response.type !== 'art:delete:success') {
    throw new Error('Invalid delete response');
  }
}

export async function getStoredCharacterArtImageData(
    characterId: CharacterId,
): Promise<StoredCharacterArtData | null> {
  const response = await sendCharacterArtMessage({
    characterId,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-image-data',
  });

  if (response.type !== 'art:get-image-data:success') {
    throw new Error('Invalid image-data response');
  }

  return response.imageData;
}

export async function getStoredCharacterPortraitCropImageData(
    characterId: CharacterId,
): Promise<StoredCharacterArtData | null> {
  const response = await sendCharacterArtMessage({
    characterId,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-crop-image-data',
  });

  if (response.type !== 'art:get-crop-image-data:success') {
    throw new Error('Invalid crop image-data response');
  }

  return response.imageData;
}

export async function getStoredCharacterArtMetadata(
    characterId: CharacterId,
): Promise<CharacterArtMetadata | null> {
  const response = await sendCharacterArtMessage({
    characterId,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-metadata',
  });

  if (response.type !== 'art:get-metadata:success') {
    throw new Error('Invalid metadata response');
  }

  return response.metadata;
}

export async function getStoredCharacterPortraitCropMetadata(
    characterId: CharacterId,
): Promise<CharacterPortraitCropMetadata | null> {
  const response = await sendCharacterArtMessage({
    characterId,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-crop-metadata',
  });

  if (response.type !== 'art:get-crop-metadata:success') {
    throw new Error('Invalid crop metadata response');
  }

  return response.metadata;
}

export async function listStoredCharacterArtMetadata():
Promise<CharacterArtMetadata[]> {
  const response = await sendCharacterArtMessage({
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:list-metadata',
  });

  if (response.type !== 'art:list-metadata:success') {
    throw new Error('Invalid metadata-list response');
  }

  return response.metadata;
}

export async function saveStoredCharacterArt(
    input: SaveCharacterArtInput,
): Promise<CharacterArtMetadata> {
  const response = await sendCharacterArtMessage({
    ...input,
    byteBase64: encodeArrayBufferToBase64(input.byteBuffer),
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:save',
  });

  if (response.type !== 'art:save:success') {
    throw new Error('Invalid save response');
  }

  return response.metadata;
}

export async function saveStoredCharacterPortraitCrop(
    input: SaveCharacterPortraitCropInput,
): Promise<CharacterPortraitCropMetadata> {
  const response = await sendCharacterArtMessage({
    ...input,
    byteBase64: encodeArrayBufferToBase64(input.byteBuffer),
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:save-crop',
  });

  if (response.type !== 'art:save-crop:success') {
    throw new Error('Invalid save crop response');
  }

  return response.metadata;
}

export function createDeleteCharacterArtSuccessResponse():
DeleteCharacterArtSuccessResponse {
  return {
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:delete:success',
  };
}

export function createErrorResponse(
    operation: CharacterArtOperation,
    message: string,
): ErrorResponse {
  return {
    message,
    operation,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:error',
  };
}

export function createGetCharacterArtImageDataSuccessResponse(
    imageData: StoredCharacterArtData | null,
): GetCharacterArtImageDataSuccessResponse {
  return {
    imageData: imageData === null
      ? null
      : {
        byteBase64: encodeArrayBufferToBase64(imageData.byteBuffer),
        fileName: imageData.fileName,
        mimeType: imageData.mimeType,
      },
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-image-data:success',
  };
}

export function createGetCharacterArtCropImageDataSuccessResponse(
    imageData: StoredCharacterArtData | null,
): GetCharacterArtCropImageDataSuccessResponse {
  return {
    imageData: imageData === null
      ? null
      : {
        byteBase64: encodeArrayBufferToBase64(imageData.byteBuffer),
        fileName: imageData.fileName,
        mimeType: imageData.mimeType,
      },
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-crop-image-data:success',
  };
}

export function createGetCharacterArtMetadataSuccessResponse(
    metadata: CharacterArtMetadata | null,
): GetCharacterArtMetadataSuccessResponse {
  return {
    metadata,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-metadata:success',
  };
}

export function createListCharacterArtMetadataSuccessResponse(
    metadata: CharacterArtMetadata[],
): ListCharacterArtMetadataSuccessResponse {
  return {
    metadata,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:list-metadata:success',
  };
}

export function createGetCharacterArtCropMetadataSuccessResponse(
    metadata: CharacterPortraitCropMetadata | null,
): GetCharacterArtCropMetadataSuccessResponse {
  return {
    metadata,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-crop-metadata:success',
  };
}

export function createSaveCharacterArtSuccessResponse(
    metadata: CharacterArtMetadata,
): SaveCharacterArtSuccessResponse {
  return {
    metadata,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:save:success',
  };
}

export function createSaveCharacterArtCropSuccessResponse(
    metadata: CharacterPortraitCropMetadata,
): SaveCharacterArtCropSuccessResponse {
  return {
    metadata,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:save-crop:success',
  };
}

async function sendCharacterArtMessage(
    request: CharacterArtRequest,
): Promise<ParsedCharacterArtResponse> {
  const rawResponse = await sendRuntimeMessage(request);
  const parsedResponse = asCharacterArtResponse(rawResponse);
  if (parsedResponse === null) {
    throw new Error('Received an invalid response from the extension');
  }

  if (parsedResponse.type === 'art:error') {
    throw new Error(parsedResponse.message);
  }

  return parsedResponse;
}

function asCharacterArtResponse(
    value: unknown,
): ParsedCharacterArtResponse | null {
  if (
    !isRecord(value)
    || value.source !== CHARACTER_ART_MESSAGE_SOURCE
    || typeof value.type !== 'string'
  ) {
    return null;
  }

  switch (value.type) {
    case 'art:delete:success':
      return {
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:delete:success',
      };
    case 'art:error':
      if (
        typeof value.message !== 'string'
        || typeof value.operation !== 'string'
      ) {
        return null;
      }

      return {
        message: value.message,
        operation: value.operation as CharacterArtOperation,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:error',
      };
    case 'art:get-crop-image-data:success':
      if (
        value.imageData !== null
        && (
          !isRecord(value.imageData)
          || typeof value.imageData.byteBase64 !== 'string'
          || typeof value.imageData.fileName !== 'string'
          || typeof value.imageData.mimeType !== 'string'
          || !isSupportedCharacterArtMimeType(value.imageData.mimeType)
        )
      ) {
        return null;
      }

      if (value.imageData === null) {
        return {
          imageData: null,
          source: CHARACTER_ART_MESSAGE_SOURCE,
          type: 'art:get-crop-image-data:success',
        };
      }

      return {
        imageData: {
          byteBuffer: decodeBase64ToArrayBuffer(value.imageData.byteBase64 as string),
          fileName: value.imageData.fileName as string,
          mimeType: value.imageData.mimeType as StoredCharacterArtData['mimeType'],
        },
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-crop-image-data:success',
      };
    case 'art:get-image-data:success':
      if (
        value.imageData !== null
        && (
          !isRecord(value.imageData)
          || typeof value.imageData.byteBase64 !== 'string'
          || typeof value.imageData.fileName !== 'string'
          || typeof value.imageData.mimeType !== 'string'
          || !isSupportedCharacterArtMimeType(value.imageData.mimeType)
        )
      ) {
        return null;
      }

      if (value.imageData === null) {
        return {
          imageData: null,
          source: CHARACTER_ART_MESSAGE_SOURCE,
          type: 'art:get-image-data:success',
        };
      }

      const byteBase64 = value.imageData.byteBase64 as string;
      const fileName = value.imageData.fileName;
      const mimeType = value.imageData.mimeType;

      return {
        imageData: {
          byteBuffer: decodeBase64ToArrayBuffer(byteBase64),
          fileName: fileName as string,
          mimeType: mimeType as StoredCharacterArtData['mimeType'],
        },
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-image-data:success',
      };
    case 'art:get-crop-metadata:success':
      if (
        value.metadata !== null
        && !isCharacterPortraitCropMetadata(value.metadata)
      ) {
        return null;
      }

      return {
        metadata: value.metadata,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-crop-metadata:success',
      };
    case 'art:get-metadata:success':
      if (
        value.metadata !== null
        && !isCharacterArtMetadata(value.metadata)
      ) {
        return null;
      }

      return {
        metadata: value.metadata,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-metadata:success',
      };
    case 'art:list-metadata:success':
      if (
        !Array.isArray(value.metadata)
        || !value.metadata.every(isCharacterArtMetadata)
      ) {
        return null;
      }

      return {
        metadata: value.metadata,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:list-metadata:success',
      };
    case 'art:save-crop:success':
      if (!isCharacterPortraitCropMetadata(value.metadata)) {
        return null;
      }

      return {
        metadata: value.metadata,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:save-crop:success',
      };
    case 'art:save:success':
      if (!isCharacterArtMetadata(value.metadata)) {
        return null;
      }

      return {
        metadata: value.metadata,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:save:success',
      };
    default:
      return null;
  }
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isCharacterPortraitCropRect(
    value: unknown,
): value is SaveCharacterPortraitCropInput['cropRect'] {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.height === 'number'
    && typeof value.width === 'number'
    && typeof value.x === 'number'
    && typeof value.y === 'number'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sendRuntimeMessage(message: CharacterArtRequest): Promise<unknown> {
  if (typeof chrome === 'undefined' || chrome.runtime?.sendMessage === undefined) {
    throw new Error('chrome.runtime.sendMessage is unavailable');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }

      resolve(response);
    });
  });
}

function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = globalThis.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes.buffer;
}

function encodeArrayBufferToBase64(byteBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(byteBuffer);
  let binaryString = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binaryString += String.fromCharCode(...chunk);
  }

  return globalThis.btoa(binaryString);
}
