import type {CharacterId} from '../character-art/art-types';
import {
  deleteStoredJournalImage,
  getStoredJournalImage,
  putStoredJournalImage,
  type StoredJournalImage,
} from '../../platform/chrome/journal-messages';
import {
  countUnreadableCharacterJournalEntries,
  ensureJournalV1Backup,
  readRawCharacterJournalRecords,
  restoreJournalV1Backup,
  updateJournalNoteRecords,
} from '../../platform/chrome/storage';
import {rewriteUniqueTitle} from './character-journal-links';
import {
  journalImageReference,
  removeJournalImageLine,
} from './character-journal-markdown';
import {
  journalMigrationConfirmed,
  planJournalMigration,
} from './character-journal-migrate';
import {planQuickNote} from './character-journal-quick-note';
import {mergeJournalRecord} from './character-journal-records';
import type {JournalImage, JournalNote} from './character-journal-types';
import {
  JOURNAL_IMAGE_BLOB_KEY_PREFIX,
  isJournalNote,
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
    mimeType: JournalImage['mimeType'];
  }): Promise<void>;
}

export interface JournalOpenResult {
  migration: 'current' | 'failed' | 'migrated';
  notes: JournalNote[];
  unreadableCount: number;
}

export type JournalSaveResult =
  | {kind: 'saved'; note: JournalNote}
  | {kind: 'stale'; note: JournalNote};

export interface CharacterJournalService {
  attachImage(note: JournalNote, file: File): Promise<JournalNote>;
  countUnreadableEntries(characterId: CharacterId): Promise<number>;
  createPlaceholder(characterId: CharacterId, title: string): Promise<JournalNote>;
  deleteEntry(characterId: CharacterId, entryId: string): Promise<void>;
  fileQuickNote(characterId: CharacterId, text: string): Promise<JournalNote>;
  getImage(blobKey: string): Promise<StoredJournalImage | null>;
  open(characterId: CharacterId): Promise<JournalOpenResult>;
  removeImage(note: JournalNote, imageId: string): Promise<JournalNote>;
  save(note: JournalNote, loadedUpdatedAt: string | null): Promise<JournalSaveResult>;
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
    attachImage,
    countUnreadableEntries(characterId) {
      return countUnreadableCharacterJournalEntries(characterId);
    },
    async createPlaceholder(characterId, title) {
      const timestamp = now().toISOString();
      const note: JournalNote = {
        body: '',
        characterId,
        createdAt: timestamp,
        featuredImageId: null,
        id: createId(),
        images: [],
        needsDetails: true,
        questStatus: null,
        schemaVersion: 2,
        sessionDate: null,
        title: normalizeJournalEntryTitle(title),
        type: 'unset',
        updatedAt: timestamp,
      };
      const saved = await save(note, null);
      if (saved.kind !== 'saved') {
        throw new Error('This note could not be saved. Your text is still here.');
      }

      return saved.note;
    },
    async deleteEntry(characterId, entryId) {
      const notes = await readNotes(characterId);
      const entry = notes.find((candidate) => candidate.id === entryId);
      await updateJournalNoteRecords(characterId, (records) =>
        records.filter((record) => !isJournalNote(record) || record.id !== entryId),
      );
      if (entry === undefined) {
        return;
      }

      await Promise.all(entry.images.map(async (image) => {
        try {
          await imageStore.deleteImage(image.blobKey);
        } catch {
          // The note is already gone. A leftover blob is better than a
          // failed delete for a note the player can no longer see.
        }
      }));
    },
    async fileQuickNote(characterId, text) {
      const notes = await readNotes(characterId);
      const planned = planQuickNote(notes, text, now(), createId, characterId);
      const loaded = notes.find((note) => note.id === planned.id)?.updatedAt ?? null;
      const saved = await save(planned, loaded);
      if (saved.kind !== 'saved') {
        throw new Error('That note could not be filed. It is still in the field.');
      }

      return saved.note;
    },
    getImage(blobKey) {
      return imageStore.getImage(blobKey);
    },
    open,
    removeImage,
    save,
  };

  async function open(characterId: CharacterId): Promise<JournalOpenResult> {
    const records = await readRawCharacterJournalRecords(characterId);
    const plan = planJournalMigration(records);
    let migration: JournalOpenResult['migration'] = 'current';
    if (plan.hasVersion1) {
      const backup = await ensureJournalV1Backup(characterId, records);
      if (backup === 'failed') {
        return {
          migration: 'failed',
          notes: [],
          unreadableCount: await countUnreadableCharacterJournalEntries(characterId),
        };
      }

      await updateJournalNoteRecords(characterId, () => plan.nextRecords);
      const after = await readRawCharacterJournalRecords(characterId);
      if (!journalMigrationConfirmed(plan.readable, after)) {
        await restoreJournalV1Backup(characterId);
        return {
          migration: 'failed',
          notes: [],
          unreadableCount: await countUnreadableCharacterJournalEntries(characterId),
        };
      }

      migration = 'migrated';
    }

    return {
      migration,
      notes: await readNotes(characterId),
      unreadableCount: await countUnreadableCharacterJournalEntries(characterId),
    };
  }

  async function save(
      note: JournalNote,
      loadedUpdatedAt: string | null,
  ): Promise<JournalSaveResult> {
    const records = await readRawCharacterJournalRecords(note.characterId);
    const stored = records.find((record) =>
      isJournalNote(record) && record.id === note.id,
    );
    if (
      isJournalNote(stored)
      && loadedUpdatedAt !== null
      && stored.updatedAt > loadedUpdatedAt
    ) {
      return {kind: 'stale', note: stored};
    }

    const timestamp = now().toISOString();
    const nextNote: JournalNote = {
      ...note,
      title: normalizeJournalEntryTitle(note.title),
      updatedAt: timestamp,
    };
    const notes = records.filter(isJournalNote);
    const previous = notes.find((entry) => entry.id === note.id);
    let rewritten = notes.filter((entry) => entry.id !== note.id);
    if (
      previous !== undefined
      && previous.title !== nextNote.title
    ) {
      const unique = notes.filter((entry) => entry.title === previous.title).length === 1;
      if (unique) {
        rewritten = rewriteUniqueTitle(notes, previous.title, nextNote.title, note.id)
            .filter((entry) => entry.id !== note.id)
            .map((entry) => entry.body === notes.find((item) => item.id === entry.id)?.body
              ? entry
              : {...entry, updatedAt: timestamp});
      }
    }

    await updateJournalNoteRecords(note.characterId, (current) => {
      let next: unknown[] = [...current];
      for (const entry of [...rewritten, nextNote]) {
        next = mergeJournalRecord(next, entry);
      }

      return next;
    });
    return {kind: 'saved', note: nextNote};
  }

  async function attachImage(note: JournalNote, file: File): Promise<JournalNote> {
    const validationError = validateJournalImageFile(file);
    if (validationError !== null) {
      throw new Error(validationError);
    }

    const mimeType = file.type as JournalImage['mimeType'];
    const imageId = createId();
    const blobKey = `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${imageId}`;
    const dimensions = await readImageDimensions(file);
    await imageStore.putImage({
      blobKey,
      byteBuffer: await readFileBytes(file),
      mimeType,
    });
    const fileName = normalizeJournalImageFileName(file.name);
    const image: JournalImage = {
      altText: fileName,
      blobKey,
      byteSize: file.size,
      fileName,
      height: dimensions.height,
      id: imageId,
      mimeType,
      width: dimensions.width,
    };
    const withImage: JournalNote = {
      ...note,
      body: appendImageLine(note.body, journalImageReference(fileName, imageId)),
      featuredImageId: note.featuredImageId ?? imageId,
      images: [...note.images, image],
    };

    try {
      const saved = await save(withImage, note.updatedAt);
      if (saved.kind === 'stale') {
        await imageStore.deleteImage(blobKey).catch(() => undefined);
        throw new Error('This note was updated in another window. Your draft is still here.');
      }

      return saved.note;
    } catch (error) {
      await imageStore.deleteImage(blobKey).catch(() => undefined);
      throw error;
    }
  }

  async function removeImage(note: JournalNote, imageId: string): Promise<JournalNote> {
    const removed = note.images.find((image) => image.id === imageId);
    const images = note.images.filter((image) => image.id !== imageId);
    const next: JournalNote = {
      ...note,
      body: removeJournalImageLine(note.body, imageId),
      featuredImageId: note.featuredImageId === imageId
        ? images[0]?.id ?? null
        : note.featuredImageId,
      images,
    };
    const saved = await save(next, note.updatedAt);
    if (saved.kind === 'stale') {
      throw new Error('This note was updated in another window. Your draft is still here.');
    }

    if (removed !== undefined) {
      try {
        await imageStore.deleteImage(removed.blobKey);
      } catch {
        // The note no longer references the photo.
      }
    }

    return saved.note;
  }

  async function readNotes(characterId: CharacterId): Promise<JournalNote[]> {
    const records = await readRawCharacterJournalRecords(characterId);
    return records.filter(isJournalNote).filter((note) => note.characterId === characterId);
  }
}

function appendImageLine(body: string, line: string): string {
  return body.trim() === '' ? line : `${body.replace(/\s+$/, '')}\n\n${line}`;
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

const MAX_JOURNAL_BITMAP_DIMENSION = 4096;
const MAX_JOURNAL_BITMAP_FILE_BYTES = 1024 * 1024;

async function readImageDimensions(
    file: File,
): Promise<{height: number | null; width: number | null}> {
  if (
    typeof createImageBitmap !== 'function'
    || file.size > MAX_JOURNAL_BITMAP_FILE_BYTES
  ) {
    return {height: null, width: null};
  }

  try {
    const bitmap = await createImageBitmap(file);
    const tooLarge = bitmap.width > MAX_JOURNAL_BITMAP_DIMENSION
      || bitmap.height > MAX_JOURNAL_BITMAP_DIMENSION;
    const dimensions = tooLarge
      ? {height: null, width: null}
      : {height: bitmap.height, width: bitmap.width};
    bitmap.close();
    return dimensions;
  } catch {
    return {height: null, width: null};
  }
}
