import type {CharacterId} from '../character-art/art-types';

export const CHARACTER_JOURNAL_SCHEMA_VERSION = 1 as const;
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

export type CharacterJournalBlock = CharacterJournalTextBlock;

export interface CharacterJournalTextBlock {
  id: string;
  text: string;
  type: 'text';
}

export interface CharacterJournalTextEntryDraft {
  characterId: CharacterId;
  entryId?: string;
  text: string;
  title: string;
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

export function getTextFromJournalEntry(
    entry: CharacterJournalEntry,
): string {
  return entry.blocks
      .filter((block): block is CharacterJournalTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n');
}

export function normalizeJournalEntryTitle(title: string): string {
  const trimmedTitle = title.trim();
  return trimmedTitle === '' ? UNTITLED_JOURNAL_ENTRY_TITLE : trimmedTitle;
}

function isCharacterJournalBlock(
    value: unknown,
): value is CharacterJournalBlock {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string'
    && value.type === 'text'
    && typeof value.text === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
