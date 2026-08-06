import type {
  CharacterArtMetadata,
  CharacterId,
  SaveCharacterArtInput,
  StoredCharacterArtData,
} from '../../features/character-art/art-types';
import {
  isCharacterArtMetadata,
  isSupportedCharacterArtMimeType,
} from '../../features/character-art/art-types';

type CharacterArtOperation =
  | 'art:delete'
  | 'art:get-image-data'
  | 'art:get-metadata'
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

interface GetCharacterArtImageDataSuccessResponse extends CharacterArtEnvelope {
  imageData: {
    byteBase64?: string;
    byteBuffer?: ArrayBuffer;
    fileName: string;
    mimeType: StoredCharacterArtData['mimeType'];
  } | null;
  type: 'art:get-image-data:success';
}

interface GetCharacterArtMetadataRequest extends CharacterArtEnvelope {
  characterId: CharacterId;
  type: 'art:get-metadata';
}

interface GetCharacterArtMetadataSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterArtMetadata | null;
  type: 'art:get-metadata:success';
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

interface SaveCharacterArtSuccessResponse extends CharacterArtEnvelope {
  metadata: CharacterArtMetadata;
  type: 'art:save:success';
}

export type CharacterArtRequest =
  | DeleteCharacterArtRequest
  | GetCharacterArtImageDataRequest
  | GetCharacterArtMetadataRequest
  | SaveCharacterArtRequest;

type CharacterArtResponse =
  | DeleteCharacterArtSuccessResponse
  | ErrorResponse
  | GetCharacterArtImageDataSuccessResponse
  | GetCharacterArtMetadataSuccessResponse
  | SaveCharacterArtSuccessResponse;

type ParsedCharacterArtResponse =
  | DeleteCharacterArtSuccessResponse
  | ErrorResponse
  | {
    imageData: StoredCharacterArtData | null;
    source: typeof CHARACTER_ART_MESSAGE_SOURCE;
    type: 'art:get-image-data:success';
  }
  | GetCharacterArtMetadataSuccessResponse
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
    case 'art:get-metadata':
      if (typeof value.characterId !== 'string') {
        return null;
      }

      return {
        characterId: value.characterId,
        source: CHARACTER_ART_MESSAGE_SOURCE,
        type: 'art:get-metadata',
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
    default:
      return null;
  }
}

export function isCharacterArtOperationType(value: unknown):
boolean {
  return (
    value === 'art:delete'
    || value === 'art:get-image-data'
    || value === 'art:get-metadata'
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

export function createGetCharacterArtMetadataSuccessResponse(
    metadata: CharacterArtMetadata | null,
): GetCharacterArtMetadataSuccessResponse {
  return {
    metadata,
    source: CHARACTER_ART_MESSAGE_SOURCE,
    type: 'art:get-metadata:success',
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
