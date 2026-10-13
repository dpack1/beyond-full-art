import type {CharacterId} from '../character-art/art-types';
import {
  deleteCharacterJournalEntry,
  getCharacterJournalEntries,
  setCharacterJournalEntry,
} from '../../platform/chrome/storage';
import type {
  CharacterJournalEntry,
  CharacterJournalTextEntryDraft,
} from './character-journal-types';
import {
  CHARACTER_JOURNAL_SCHEMA_VERSION,
  normalizeJournalEntryTitle,
} from './character-journal-types';

export interface CharacterJournalService {
  deleteEntry(characterId: CharacterId, entryId: string): Promise<void>;
  listEntries(characterId: CharacterId): Promise<CharacterJournalEntry[]>;
  saveTextEntry(draft: CharacterJournalTextEntryDraft): Promise<CharacterJournalEntry>;
}

interface CharacterJournalServiceOptions {
  createId?: () => string;
  now?: () => Date;
}

export function createCharacterJournalService(
    options: CharacterJournalServiceOptions = {},
): CharacterJournalService {
  const createId = options.createId ?? createRandomId;
  const now = options.now ?? (() => new Date());

  return {
    async deleteEntry(
        characterId: CharacterId,
        entryId: string,
    ): Promise<void> {
      await deleteCharacterJournalEntry(characterId, entryId);
    },

    async listEntries(
        characterId: CharacterId,
    ): Promise<CharacterJournalEntry[]> {
      return getCharacterJournalEntries(characterId);
    },

    async saveTextEntry(
        draft: CharacterJournalTextEntryDraft,
    ): Promise<CharacterJournalEntry> {
      const existingEntries = await getCharacterJournalEntries(draft.characterId);
      const existingEntry = draft.entryId === undefined
        ? undefined
        : existingEntries.find((entry) => entry.id === draft.entryId);
      const timestamp = now().toISOString();
      const entryId = existingEntry?.id ?? draft.entryId ?? createId();
      const textBlockId = existingEntry?.blocks[0]?.id ?? createId();
      const entry: CharacterJournalEntry = {
        blocks: [
          {
            id: textBlockId,
            text: draft.text,
            type: 'text',
          },
        ],
        characterId: draft.characterId,
        createdAt: existingEntry?.createdAt ?? timestamp,
        id: entryId,
        schemaVersion: CHARACTER_JOURNAL_SCHEMA_VERSION,
        title: normalizeJournalEntryTitle(draft.title),
        updatedAt: timestamp,
      };

      await setCharacterJournalEntry(entry);
      return entry;
    },
  };
}

function createRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `journal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
