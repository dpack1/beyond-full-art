import type {Cleanup} from '../../shared/types';

export const CHARACTER_ART_SCHEMA_VERSION = 1 as const;
export const MAX_CHARACTER_ART_FILE_BYTES = 3 * 1024 * 1024;
export const SUPPORTED_CHARACTER_ART_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type CharacterId = string;
export type SupportedCharacterArtMimeType =
  typeof SUPPORTED_CHARACTER_ART_MIME_TYPES[number];

export interface CharacterArtMetadata {
  blobKey: string;
  byteSize: number;
  characterId: CharacterId;
  createdAt: string;
  fileName: string;
  height: number | null;
  mimeType: SupportedCharacterArtMimeType;
  schemaVersion: typeof CHARACTER_ART_SCHEMA_VERSION;
  updatedAt: string;
  width: number | null;
}

export interface SaveCharacterArtInput {
  byteBuffer: ArrayBuffer;
  byteSize: number;
  characterId: CharacterId;
  fileName: string;
  height: number | null;
  mimeType: SupportedCharacterArtMimeType;
  width: number | null;
}

export interface StoredCharacterArtData {
  byteBuffer: ArrayBuffer;
  fileName: string;
  mimeType: SupportedCharacterArtMimeType;
}

export interface ViewerImageResolution {
  altText: string;
  imageUrl: string;
  releaseImageUrl?: Cleanup;
  usingStoredArt: boolean;
  warningMessage: string | null;
}

export function isSupportedCharacterArtMimeType(
    value: string,
): value is SupportedCharacterArtMimeType {
  return SUPPORTED_CHARACTER_ART_MIME_TYPES.includes(
      value as SupportedCharacterArtMimeType,
  );
}

export function isCharacterArtMetadata(
    value: unknown,
): value is CharacterArtMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.blobKey === 'string'
    && typeof value.byteSize === 'number'
    && typeof value.characterId === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.fileName === 'string'
    && isNullableNumber(value.height)
    && isSupportedCharacterArtMimeTypeValue(value.mimeType)
    && value.schemaVersion === CHARACTER_ART_SCHEMA_VERSION
    && typeof value.updatedAt === 'string'
    && isNullableNumber(value.width)
  );
}

export function isStoredCharacterArtData(
    value: unknown,
): value is StoredCharacterArtData {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isBinaryBuffer(value.byteBuffer)
    && typeof value.fileName === 'string'
    && isSupportedCharacterArtMimeTypeValue(value.mimeType)
  );
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSupportedCharacterArtMimeTypeValue(
    value: unknown,
): value is SupportedCharacterArtMimeType {
  return typeof value === 'string' && isSupportedCharacterArtMimeType(value);
}

function isBinaryBuffer(value: unknown): boolean {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value);
}
