import type {CharacterId} from '../character-art/art-types';
import {
  deleteStoredJournalImage,
  getStoredJournalImage,
  putStoredJournalImage,
  type StoredJournalImage,
} from '../../platform/chrome/journal-messages';
import {
  deleteCharacterJournalEntry,
  getCharacterJournalEntries,
  setCharacterJournalEntry,
} from '../../platform/chrome/storage';
import type {
  CharacterJournalEntry,
  CharacterJournalImageBlock,
  CharacterJournalTextEntryDraft,
} from './character-journal-types';
import {
  CHARACTER_JOURNAL_SCHEMA_VERSION,
  JOURNAL_IMAGE_BLOB_KEY_PREFIX,
  getImageBlocks,
  normalizeJournalEntryTitle,
  normalizeJournalImageFileName,
  validateJournalImageFile,
} from './character-journal-types';

export interface JournalImageStore {
  deleteImage(blobKey: string): Promise<void>;
  getImage(blobKey: string): Promise<StoredJournalImage | null>;
  putImage(input: {
    blobKey: string;
    byteBuffer: ArrayBuffer;
    mimeType: CharacterJournalImageBlock['mimeType'];
  }): Promise<void>;
}

export interface CharacterJournalService {
  attachImage(
      draft: CharacterJournalTextEntryDraft,
      file: File,
  ): Promise<CharacterJournalEntry>;
  deleteEntry(characterId: CharacterId, entryId: string): Promise<void>;
  getImage(blobKey: string): Promise<StoredJournalImage | null>;
  listEntries(characterId: CharacterId): Promise<CharacterJournalEntry[]>;
  removeImage(
      draft: CharacterJournalTextEntryDraft,
      imageId: string,
  ): Promise<CharacterJournalEntry>;
  saveTextEntry(
      draft: CharacterJournalTextEntryDraft,
  ): Promise<CharacterJournalEntry>;
}

interface CharacterJournalServiceOptions {
  createId?: () => string;
  imageStore?: JournalImageStore;
  now?: () => Date;
}

export function createCharacterJournalService(
    options: CharacterJournalServiceOptions = {},
): CharacterJournalService {
  const createId = options.createId ?? createRandomId;
  const imageStore = options.imageStore ?? createExtensionImageStore();
  const now = options.now ?? (() => new Date());

  return {
    async attachImage(draft, file) {
      const validationError = validateJournalImageFile(file);
      if (validationError !== null) {
        throw new Error(validationError);
      }

      const mimeType = file.type as CharacterJournalImageBlock['mimeType'];
      const imageId = createId();
      const blobKey = `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${imageId}`;
      const dimensions = await readImageDimensions(file);
      await imageStore.putImage({
        blobKey,
        byteBuffer: await readFileBytes(file),
        mimeType,
      });

      const imageBlock: CharacterJournalImageBlock = {
        blobKey,
        byteSize: file.size,
        fileName: normalizeJournalImageFileName(file.name),
        height: dimensions.height,
        id: imageId,
        mimeType,
        type: 'image',
        width: dimensions.width,
      };

      try {
        return await saveTextEntry({
          ...draft,
          imageBlocks: [
            ...(draft.imageBlocks ?? []),
            imageBlock,
          ],
        });
      } catch (error) {
        await imageStore.deleteImage(blobKey).catch(() => undefined);
        throw error;
      }
    },

    async deleteEntry(characterId, entryId) {
      const entries = await getCharacterJournalEntries(characterId);
      const entry = entries.find((candidate) => candidate.id === entryId);
      await deleteCharacterJournalEntry(characterId, entryId);
      if (entry === undefined) {
        return;
      }

      await Promise.all(getImageBlocks(entry).map(async (block) => {
        try {
          await imageStore.deleteImage(block.blobKey);
        } catch {
          // The note is already gone. A leftover blob is better than
          // reporting a failed delete for a note the user can no longer see.
        }
      }));
    },

    getImage(blobKey) {
      return imageStore.getImage(blobKey);
    },

    listEntries(characterId) {
      return getCharacterJournalEntries(characterId);
    },

    async removeImage(draft, imageId) {
      const imageBlocks = draft.imageBlocks ?? [];
      const removedBlock = imageBlocks.find((block) => block.id === imageId);
      const savedEntry = await saveTextEntry({
        ...draft,
        imageBlocks: imageBlocks.filter((block) => block.id !== imageId),
      });

      if (removedBlock !== undefined) {
        try {
          await imageStore.deleteImage(removedBlock.blobKey);
        } catch {
          // The note no longer references the photo.
        }
      }

      return savedEntry;
    },

    saveTextEntry,
  };

  async function saveTextEntry(
      draft: CharacterJournalTextEntryDraft,
  ): Promise<CharacterJournalEntry> {
    const existingEntries = await getCharacterJournalEntries(draft.characterId);
    const existingEntry = draft.entryId === undefined
      ? undefined
      : existingEntries.find((entry) => entry.id === draft.entryId);
    const timestamp = now().toISOString();
    const entryId = existingEntry?.id ?? draft.entryId ?? createId();
    const textBlockId = existingEntry?.blocks.find((block) => block.type === 'text')?.id
      ?? createId();
    const imageBlocks = draft.imageBlocks ?? (
      existingEntry === undefined ? [] : getImageBlocks(existingEntry)
    );
    const entry: CharacterJournalEntry = {
      blocks: [
        {
          id: textBlockId,
          text: draft.text,
          type: 'text',
        },
        ...imageBlocks,
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
  }
}

function createExtensionImageStore(): JournalImageStore {
  return {
    deleteImage: deleteStoredJournalImage,
    getImage: getStoredJournalImage,
    putImage: putStoredJournalImage,
  };
}

function createRandomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `journal-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('error', () => {
      reject(new Error('Photo bytes could not be read.'));
    });
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('Photo bytes could not be read.'));
    });
    reader.readAsArrayBuffer(file);
  });
}

async function readImageDimensions(
    file: File,
): Promise<{height: number | null; width: number | null}> {
  if (typeof createImageBitmap !== 'function') {
    return {height: null, width: null};
  }

  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = {
      height: bitmap.height,
      width: bitmap.width,
    };
    bitmap.close();
    return dimensions;
  } catch {
    return {height: null, width: null};
  }
}
