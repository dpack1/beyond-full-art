import {
  SUPPORTED_CHARACTER_ART_MIME_TYPES,
  type CharacterId,
  type SupportedCharacterArtMimeType,
} from '../character-art/art-types';

export const CHARACTER_JOURNAL_SCHEMA_VERSION = 1 as const;
export const JOURNAL_IMAGE_BLOB_KEY_PREFIX = 'bfa.journal.image.';
export const MAX_JOURNAL_IMAGE_BYTES = 3 * 1024 * 1024;
export const UNTITLED_JOURNAL_ENTRY_TITLE = 'Untitled entry';

export interface CharacterJournalEntry {
  blocks: CharacterJournalBlock[];
  characterId: CharacterId;
  createdAt: string;
  id: string;
  schemaVersion: typeof CHARACTER_JOURNAL_SCHEMA_VERSION;
  title: string;
  updatedAt: string;
}

export type CharacterJournalBlock =
  | CharacterJournalImageBlock
  | CharacterJournalTextBlock;

export interface CharacterJournalTextBlock {
  id: string;
  text: string;
  type: 'text';
}

export interface CharacterJournalImageBlock {
  blobKey: string;
  byteSize: number;
  fileName: string;
  height: number | null;
  id: string;
  mimeType: SupportedCharacterArtMimeType;
  type: 'image';
  width: number | null;
}

export interface CharacterJournalTextEntryDraft {
  characterId: CharacterId;
  entryId?: string;
  imageBlocks?: CharacterJournalImageBlock[];
  text: string;
  title: string;
}

export interface JournalImageFileInfo {
  name: string;
  size: number;
  type: string;
}

export function isCharacterJournalEntry(
    value: unknown,
): value is CharacterJournalEntry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.blocks)
    && value.blocks.every(isCharacterJournalBlock)
    && typeof value.characterId === 'string'
    && typeof value.createdAt === 'string'
    && typeof value.id === 'string'
    && value.schemaVersion === CHARACTER_JOURNAL_SCHEMA_VERSION
    && typeof value.title === 'string'
    && typeof value.updatedAt === 'string'
  );
}

export function isCharacterJournalImageBlock(
    value: unknown,
): value is CharacterJournalImageBlock {
  return isCharacterJournalBlock(value) && value.type === 'image';
}

export function getTextFromJournalEntry(
    entry: CharacterJournalEntry,
): string {
  return entry.blocks
      .filter((block): block is CharacterJournalTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');
}

export function getImageBlocks(
    entry: CharacterJournalEntry,
): CharacterJournalImageBlock[] {
  return entry.blocks.filter(
      (block): block is CharacterJournalImageBlock => block.type === 'image',
  );
}

export function normalizeJournalEntryTitle(title: string): string {
  const trimmedTitle = title.trim();
  return trimmedTitle === '' ? UNTITLED_JOURNAL_ENTRY_TITLE : trimmedTitle;
}

export function normalizeJournalImageFileName(fileName: string): string {
  const trimmedName = fileName.trim();
  return trimmedName === '' ? 'Photo' : trimmedName;
}

export function isJournalImageBlobKey(blobKey: string): boolean {
  return /^bfa\.journal\.image\.[A-Za-z0-9-]+$/.test(blobKey);
}

export function validateJournalImageFile(file: JournalImageFileInfo): string | null {
  if (!isSupportedJournalImageMimeType(file.type)) {
    return 'Choose a PNG, JPEG, or WebP photo.';
  }

  if (file.size <= 0) {
    return 'The selected photo is empty.';
  }

  if (file.size > MAX_JOURNAL_IMAGE_BYTES) {
    return 'Choose a photo smaller than 3 MB.';
  }

  return null;
}

export function isSupportedJournalImageMimeType(
    value: string,
): value is SupportedCharacterArtMimeType {
  return SUPPORTED_CHARACTER_ART_MIME_TYPES.includes(
      value as SupportedCharacterArtMimeType,
  );
}

function isCharacterJournalBlock(
    value: unknown,
): value is CharacterJournalBlock {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return false;
  }

  if (value.type === 'text') {
    return typeof value.text === 'string';
  }

  if (value.type !== 'image') {
    return false;
  }

  return (
    typeof value.blobKey === 'string'
    && isJournalImageBlobKey(value.blobKey)
    && typeof value.byteSize === 'number'
    && typeof value.fileName === 'string'
    && isNullableNumber(value.height)
    && isSupportedJournalImageMimeTypeValue(value.mimeType)
    && isNullableNumber(value.width)
  );
}

function isSupportedJournalImageMimeTypeValue(
    value: unknown,
): value is SupportedCharacterArtMimeType {
  return typeof value === 'string' && isSupportedJournalImageMimeType(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
