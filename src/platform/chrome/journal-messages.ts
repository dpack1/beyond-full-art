import type {SupportedCharacterArtMimeType} from '../../features/character-art/art-types';
import {journalImageTooLargeMessage} from '../../features/character-journal/character-journal-image-fit';
import {
  MAX_JOURNAL_IMAGE_BYTES,
  isJournalImageBlobKey,
  isSupportedJournalImageMimeType,
} from '../../features/character-journal/character-journal-types';

export const JOURNAL_IMAGE_MESSAGE_SOURCE = 'beyond-full-art';

export type JournalImageOperation =
  | 'journal:delete-image'
  | 'journal:get-image'
  | 'journal:put-image';

interface JournalImageEnvelope {
  source: typeof JOURNAL_IMAGE_MESSAGE_SOURCE;
}

export interface PutJournalImageRequest extends JournalImageEnvelope {
  blobKey: string;
  byteBase64?: string;
  byteBuffer?: ArrayBuffer;
  byteSize: number;
  characterId?: string;
  mimeType: SupportedCharacterArtMimeType;
  type: 'journal:put-image';
}

export interface GetJournalImageRequest extends JournalImageEnvelope {
  blobKey: string;
  type: 'journal:get-image';
}

export interface DeleteJournalImageRequest extends JournalImageEnvelope {
  blobKey: string;
  type: 'journal:delete-image';
}

export type JournalImageRequest =
  | DeleteJournalImageRequest
  | GetJournalImageRequest
  | PutJournalImageRequest;

export interface JournalImageErrorResponse extends JournalImageEnvelope {
  message: string;
  operation: JournalImageOperation;
  type: 'journal:error';
}

export interface PutJournalImageSuccessResponse extends JournalImageEnvelope {
  type: 'journal:put-image:success';
}

export interface DeleteJournalImageSuccessResponse extends JournalImageEnvelope {
  type: 'journal:delete-image:success';
}

export interface GetJournalImageSuccessResponse extends JournalImageEnvelope {
  image: {
    byteBase64: string;
    mimeType: SupportedCharacterArtMimeType;
  } | null;
  type: 'journal:get-image:success';
}

export type JournalImageResponse =
  | DeleteJournalImageSuccessResponse
  | GetJournalImageSuccessResponse
  | JournalImageErrorResponse
  | PutJournalImageSuccessResponse;

export interface StoredJournalImage {
  byteBuffer: ArrayBuffer;
  mimeType: SupportedCharacterArtMimeType;
}

export function asJournalImageRequest(
    value: unknown,
): JournalImageRequest | null {
  if (!isRecord(value) || value.source !== JOURNAL_IMAGE_MESSAGE_SOURCE) {
    return null;
  }

  if (!isJournalImageBlobKeyValue(value.blobKey)) {
    return null;
  }

  switch (value.type) {
    case 'journal:delete-image':
    case 'journal:get-image':
      return {
        blobKey: value.blobKey,
        source: JOURNAL_IMAGE_MESSAGE_SOURCE,
        type: value.type,
      };
    case 'journal:put-image': {
      const byteBuffer = readByteBuffer(value);
      if (
        byteBuffer === null
        || typeof value.byteSize !== 'number'
        || byteBuffer.byteLength !== value.byteSize
        || byteBuffer.byteLength > MAX_JOURNAL_IMAGE_BYTES
        || !isSupportedJournalImageMimeTypeValue(value.mimeType)
      ) {
        return null;
      }

      const request: PutJournalImageRequest = {
        blobKey: value.blobKey,
        byteBase64: typeof value.byteBase64 === 'string' ? value.byteBase64 : '',
        byteBuffer,
        byteSize: value.byteSize,
        mimeType: value.mimeType,
        source: JOURNAL_IMAGE_MESSAGE_SOURCE,
        type: 'journal:put-image',
      };
      if (typeof value.characterId === 'string' && /^[A-Za-z0-9_-]+$/.test(value.characterId)) {
        request.characterId = value.characterId;
      }
      return request;
    }
    default:
      return null;
  }
}

export function describeRejectedJournalImage(value: unknown): string | null {
  if (!isRecord(value) || value.type !== 'journal:put-image') {
    return null;
  }

  const byteBuffer = readByteBuffer(value);
  if (byteBuffer !== null && byteBuffer.byteLength > MAX_JOURNAL_IMAGE_BYTES) {
    return journalImageTooLargeMessage(byteBuffer.byteLength, MAX_JOURNAL_IMAGE_BYTES);
  }

  return null;
}

export function isMalformedJournalImageMessage(
    value: unknown,
): value is {type: JournalImageOperation} {
  return (
    isRecord(value)
    && value.source === JOURNAL_IMAGE_MESSAGE_SOURCE
    && (
      value.type === 'journal:delete-image'
      || value.type === 'journal:get-image'
      || value.type === 'journal:put-image'
    )
    && asJournalImageRequest(value) === null
  );
}

export function createJournalImageErrorResponse(
    operation: JournalImageOperation,
    message: string,
): JournalImageErrorResponse {
  return {
    message,
    operation,
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:error',
  };
}

export function createPutJournalImageSuccessResponse():
PutJournalImageSuccessResponse {
  return {
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:put-image:success',
  };
}

export function createDeleteJournalImageSuccessResponse():
DeleteJournalImageSuccessResponse {
  return {
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:delete-image:success',
  };
}

export function createGetJournalImageSuccessResponse(
    image: StoredJournalImage | null,
): GetJournalImageSuccessResponse {
  return {
    image: image === null
      ? null
      : {
        byteBase64: encodeArrayBufferToBase64(image.byteBuffer),
        mimeType: image.mimeType,
      },
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:get-image:success',
  };
}

export async function putStoredJournalImage(input: {
  blobKey: string;
  byteBuffer: ArrayBuffer;
  characterId?: string;
  mimeType: SupportedCharacterArtMimeType;
}): Promise<void> {
  // Extension messages do not keep an ArrayBuffer intact. Chromium delivers
  // that field as a plain object, so the base64 copy is the one the worker reads.
  const message: PutJournalImageRequest = {
    blobKey: input.blobKey,
    byteBase64: encodeArrayBufferToBase64(input.byteBuffer),
    byteSize: input.byteBuffer.byteLength,
    mimeType: input.mimeType,
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:put-image',
  };
  if (input.characterId !== undefined) {
    message.characterId = input.characterId;
  }
  const response = await sendJournalImageMessage(message);
  if (response.type !== 'journal:put-image:success') {
    throw new Error(response.type === 'journal:error'
      ? response.message
      : 'Journal photo could not be saved.');
  }
}

export async function getStoredJournalImage(
    blobKey: string,
): Promise<StoredJournalImage | null> {
  const response = await sendJournalImageMessage({
    blobKey,
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:get-image',
  });
  if (response.type !== 'journal:get-image:success') {
    throw new Error(response.type === 'journal:error'
      ? response.message
      : 'Journal photo could not be loaded.');
  }

  if (response.image === null) {
    return null;
  }

  return {
    byteBuffer: decodeBase64ToArrayBuffer(response.image.byteBase64),
    mimeType: response.image.mimeType,
  };
}

export async function deleteStoredJournalImage(blobKey: string): Promise<void> {
  const response = await sendJournalImageMessage({
    blobKey,
    source: JOURNAL_IMAGE_MESSAGE_SOURCE,
    type: 'journal:delete-image',
  });
  if (response.type !== 'journal:delete-image:success') {
    throw new Error(response.type === 'journal:error'
      ? response.message
      : 'Journal photo could not be deleted.');
  }
}

function sendJournalImageMessage(
    message: JournalImageRequest,
): Promise<JournalImageResponse> {
  if (typeof chrome === 'undefined' || chrome.runtime?.sendMessage === undefined) {
    throw new Error('chrome.runtime.sendMessage is unavailable');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: unknown) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError !== undefined) {
        reject(new Error(runtimeError.message));
        return;
      }

      if (!isJournalImageResponse(response)) {
        reject(new Error('Journal photo storage did not respond.'));
        return;
      }

      resolve(response);
    });
  });
}

function readByteBuffer(value: Record<string, unknown>): ArrayBuffer | null {
  if (value.byteBuffer instanceof ArrayBuffer) {
    return value.byteBuffer;
  }

  if (typeof value.byteBase64 === 'string' && value.byteBase64 !== '') {
    return decodeBase64ToArrayBuffer(value.byteBase64);
  }

  return null;
}

function isJournalImageResponse(value: unknown): value is JournalImageResponse {
  if (!isRecord(value) || value.source !== JOURNAL_IMAGE_MESSAGE_SOURCE) {
    return false;
  }

  return (
    value.type === 'journal:delete-image:success'
    || value.type === 'journal:put-image:success'
    || value.type === 'journal:error'
    || (
      value.type === 'journal:get-image:success'
      && (
        value.image === null
        || (
          isRecord(value.image)
          && typeof value.image.byteBase64 === 'string'
          && isSupportedJournalImageMimeTypeValue(value.image.mimeType)
        )
      )
    )
  );
}

function isJournalImageBlobKeyValue(value: unknown): value is string {
  return typeof value === 'string' && isJournalImageBlobKey(value);
}

function isSupportedJournalImageMimeTypeValue(
    value: unknown,
): value is SupportedCharacterArtMimeType {
  return typeof value === 'string' && isSupportedJournalImageMimeType(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
