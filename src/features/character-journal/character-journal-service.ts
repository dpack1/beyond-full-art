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
import {
  prepareJournalImageFile,
  type PreparedJournalImage,
} from './character-journal-image';
import {
  embedMissingJournalImages,
  insertJournalImageEmbed,
  journalImageEmbed,
  journalImageIdsInBody,
  reconcileJournalImageRecords,
} from './character-journal-embeds';
import {journalImageTooLargeMessage} from './character-journal-image-fit';
import {rewriteUniqueTitle} from './character-journal-links';
import {
  libraryImage,
  mergePhotoCatalog,
  notesUsingPhoto,
  samePhotoCatalog,
  unlinkPhotoFromNote,
} from './character-journal-library';
import {remapJournalNoteImages} from './journal-image-remap';
import {
  readJournalPhotoCatalog,
  writeJournalPhotoCatalog,
} from '../../platform/chrome/journal-photo-catalog';
import {removeJournalImageLine} from './character-journal-markdown';
import {
  journalMigrationConfirmed,
  planJournalMigration,
} from './character-journal-migrate';
import {planQuickNote} from './character-journal-quick-note';
import {mergeJournalRecord} from './character-journal-records';
import type {JournalImage, JournalNote} from './character-journal-types';
import {
  JOURNAL_IMAGE_BLOB_KEY_PREFIX,
  MAX_JOURNAL_IMAGE_STORED_BYTES,
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
    characterId?: string;
    mimeType: JournalImage['mimeType'];
  }): Promise<void>;
}

export interface JournalOpenResult {
  migration: 'current' | 'failed' | 'migrated';
  notes: JournalNote[];
  photos: JournalImage[];
  unreadableCount: number;
}

export type JournalSaveResult =
  | {kind: 'saved'; note: JournalNote}
  | {kind: 'stale'; note: JournalNote};

export interface CharacterJournalService {
  addPhoto(characterId: CharacterId, file: File): Promise<JournalImage>;
  attachImage(
    note: JournalNote,
    file: File,
    position?: {end: number; start: number},
  ): Promise<JournalNote>;
  countUnreadableEntries(characterId: CharacterId): Promise<number>;
  createPlaceholder(characterId: CharacterId, title: string): Promise<JournalNote>;
  deleteEntry(characterId: CharacterId, entryId: string): Promise<void>;
  deletePhoto(characterId: CharacterId, imageId: string): Promise<JournalOpenResult>;
  fileQuickNote(characterId: CharacterId, text: string): Promise<JournalNote>;
  getImage(blobKey: string): Promise<StoredJournalImage | null>;
  insertPhoto(
    note: JournalNote,
    imageId: string,
    position?: {end: number; start: number},
  ): Promise<JournalNote>;
  keepBoth(note: JournalNote): Promise<JournalNote>;
  listPhotos(characterId: CharacterId): Promise<JournalImage[]>;
  open(characterId: CharacterId): Promise<JournalOpenResult>;
  removeImage(note: JournalNote, imageId: string): Promise<JournalNote>;
  save(note: JournalNote, loadedUpdatedAt: string | null): Promise<JournalSaveResult>;
}

interface CharacterJournalServiceOptions {
  catalog?: {
    read(characterId: CharacterId): Promise<JournalImage[]>;
    write(characterId: CharacterId, images: readonly JournalImage[]): Promise<void>;
  };
  createId?: () => string;
  imageStore?: JournalImageStore;
  now?: () => Date;
  prepareImage?: (file: File) => Promise<PreparedJournalImage>;
}

export function createCharacterJournalService(
    options: CharacterJournalServiceOptions = {},
): CharacterJournalService {
  const catalog = options.catalog ?? {
    read: readJournalPhotoCatalog,
    write: writeJournalPhotoCatalog,
  };
  const createId = options.createId ?? createRandomId;
  const imageStore = options.imageStore ?? createExtensionImageStore();
  const now = options.now ?? (() => new Date());
  const prepareImage = options.prepareImage ?? prepareJournalImageFile;

  return {
    addPhoto,
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
      if (entry !== undefined) {
        await rememberPhotos(characterId, entry.images);
      }
      await updateJournalNoteRecords(characterId, (records) =>
        records.filter((record) => !isJournalNote(record) || record.id !== entryId),
      );
    },
    deletePhoto,
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
    insertPhoto,
    keepBoth,
    listPhotos,
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
          photos: [],
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
          photos: [],
          unreadableCount: await countUnreadableCharacterJournalEntries(characterId),
        };
      }

      migration = 'migrated';
    }

    const notes = await repairStoredImages(await readNotes(characterId));
    return {
      migration,
      notes,
      photos: await syncCatalog(characterId, notes),
      unreadableCount: await countUnreadableCharacterJournalEntries(characterId),
    };
  }

  async function repairStoredImages(notes: JournalNote[]): Promise<JournalNote[]> {
    let current = notes;
    for (const note of notes) {
      const body = embedMissingJournalImages(note.body, note.images);
      const reconciled = reconcileJournalImageRecords(note.images, body, now());
      const changed = body !== note.body || journalImagesChanged(note.images, reconciled);
      if (!changed) {
        continue;
      }

      const saved = await save({...note, body}, note.updatedAt);
      if (saved.kind === 'saved') {
        current = current.map((item) => item.id === saved.note.id ? saved.note : item);
      }
    }

    return current;
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

    const clock = now();
    const timestamp = clock.toISOString();
    const released = releaseUnlinkedImages(note.images, note.body);
    const featuredImageId = released.images.some((image) => image.id === note.featuredImageId)
      ? note.featuredImageId
      : released.images[0]?.id ?? null;
    const nextNote: JournalNote = {
      ...note,
      featuredImageId,
      images: released.images,
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
    await rememberPhotos(note.characterId, released.released);
    return {kind: 'saved', note: nextNote};
  }

  async function keepBoth(note: JournalNote): Promise<JournalNote> {
    const sources = await Promise.all(note.images.map(async (image) => {
      const stored = await imageStore.getImage(image.blobKey);
      if (stored === null) {
        throw new Error(`The photo “${image.fileName}” could not be copied.`);
      }
      return {image, stored};
    }));
    const replacements = new Map<string, string>();
    for (const {image} of sources) {
      replacements.set(image.id, createId());
    }
    const written: string[] = [];
    try {
      for (const {image, stored} of sources) {
        const nextId = replacements.get(image.id);
        if (nextId === undefined) {
          throw new Error('A copied photo id could not be created.');
        }
        const blobKey = `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${nextId}`;
        await imageStore.putImage({
          blobKey,
          byteBuffer: stored.byteBuffer,
          characterId: note.characterId,
          mimeType: stored.mimeType,
        });
        written.push(blobKey);
      }
      const copy = remapJournalNoteImages(note, replacements);
      const saved = await save({
        ...copy,
        id: createId(),
        title: `${note.title} (other computer)`,
      }, null);
      if (saved.kind !== 'saved') {
        throw new Error('The draft copy could not be saved.');
      }
      return saved.note;
    } catch (error) {
      await Promise.all(written.map((blobKey) => (
        imageStore.deleteImage(blobKey).catch(() => undefined)
      )));
      throw error;
    }
  }

  async function attachImage(
      note: JournalNote,
      file: File,
      position?: {end: number; start: number},
  ): Promise<JournalNote> {
    const validationError = validateJournalImageFile(file);
    if (validationError !== null) {
      throw new Error(validationError);
    }

    const prepared = await prepareImage(file);
    if (prepared.byteSize > MAX_JOURNAL_IMAGE_STORED_BYTES) {
      throw new Error(journalImageTooLargeMessage(
          prepared.byteSize,
          MAX_JOURNAL_IMAGE_STORED_BYTES,
          true,
      ));
    }

    const mimeType = prepared.mimeType;
    const imageId = createId();
    const blobKey = `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${imageId}`;
    const dimensions = prepared.width === null
      ? await readImageDimensions(file)
      : {height: prepared.height, width: prepared.width};
    await imageStore.putImage({
      blobKey,
      byteBuffer: prepared.byteBuffer,
      characterId: note.characterId,
      mimeType,
    });
    const fileName = normalizeJournalImageFileName(file.name);
    const image: JournalImage = {
      altText: fileName,
      blobKey,
      byteSize: prepared.byteSize,
      fileName,
      height: dimensions.height,
      id: imageId,
      mimeType,
      width: dimensions.width,
    };
    const body = position === undefined
      ? appendImageLine(note.body, journalImageEmbed(imageId, fileName))
      : insertJournalImageEmbed(
          note.body,
          position.start,
          position.end,
          imageId,
          fileName,
      ).value;
    const withImage: JournalNote = {
      ...note,
      body,
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
      await rememberPhotos(note.characterId, [removed]);
    }

    return saved.note;
  }

  async function addPhoto(characterId: CharacterId, file: File): Promise<JournalImage> {
    const image = await storeNewImage(characterId, file);
    try {
      await rememberPhotos(characterId, [image]);
      return image;
    } catch (error) {
      await imageStore.deleteImage(image.blobKey).catch(() => undefined);
      throw error;
    }
  }

  async function insertPhoto(
      note: JournalNote,
      imageId: string,
      position?: {end: number; start: number},
  ): Promise<JournalNote> {
    const photos = mergePhotoCatalog(
        await syncCatalog(note.characterId, await readNotes(note.characterId)),
        note.images,
    );
    const image = photos.find((candidate) => candidate.id === imageId);
    if (image === undefined) {
      throw new Error('That photo is not in the library.');
    }

    const images = note.images.some((candidate) => candidate.id === image.id)
      ? note.images
      : [...note.images, libraryImage(image)];
    const body = position === undefined
      ? appendImageLine(note.body, journalImageEmbed(image.id, image.fileName))
      : insertJournalImageEmbed(
          note.body,
          position.start,
          position.end,
          image.id,
          image.fileName,
      ).value;
    const saved = await save({
      ...note,
      body,
      featuredImageId: note.featuredImageId ?? image.id,
      images,
    }, note.updatedAt);
    if (saved.kind === 'stale') {
      throw new Error('This note was updated in another window. Your draft is still here.');
    }
    return saved.note;
  }

  async function deletePhoto(
      characterId: CharacterId,
      imageId: string,
  ): Promise<JournalOpenResult> {
    const notes = await readNotes(characterId);
    const photos = await syncCatalog(characterId, notes);
    const image = photos.find((candidate) => candidate.id === imageId);
    if (image === undefined) {
      throw new Error('That photo is not in the library.');
    }

    const targets = notesUsingPhoto(notes, imageId);
    for (const target of targets) {
      const saved = await save(unlinkPhotoFromNote(target, imageId), target.updatedAt);
      if (saved.kind === 'stale') {
        throw new Error('A note that uses this photo changed. The photo is still here.');
      }
    }

    const remaining = (await catalog.read(characterId))
        .filter((candidate) => candidate.id !== imageId);
    await catalog.write(characterId, remaining);
    try {
      await imageStore.deleteImage(image.blobKey);
    } catch (error) {
      await rememberPhotos(characterId, [image]);
      throw error instanceof Error
        ? error
        : new Error('Photo could not be removed.');
    }

    const nextNotes = await readNotes(characterId);
    return {
      migration: 'current',
      notes: nextNotes,
      photos: await syncCatalog(characterId, nextNotes),
      unreadableCount: await countUnreadableCharacterJournalEntries(characterId),
    };
  }

  async function listPhotos(characterId: CharacterId): Promise<JournalImage[]> {
    return syncCatalog(characterId, await readNotes(characterId));
  }

  async function syncCatalog(
      characterId: CharacterId,
      notes: readonly JournalNote[],
  ): Promise<JournalImage[]> {
    const stored = await catalog.read(characterId);
    const merged = mergePhotoCatalog(
        stored,
        notes.flatMap((note) => note.images),
    );
    if (!samePhotoCatalog(stored, merged)) {
      await catalog.write(characterId, merged);
    }
    return merged;
  }

  async function rememberPhotos(
      characterId: CharacterId,
      images: readonly JournalImage[],
  ): Promise<void> {
    if (images.length === 0) {
      return;
    }
    const stored = await catalog.read(characterId);
    const merged = mergePhotoCatalog(stored, images);
    if (!samePhotoCatalog(stored, merged)) {
      await catalog.write(characterId, merged);
    }
  }

  async function storeNewImage(characterId: CharacterId, file: File): Promise<JournalImage> {
    const validationError = validateJournalImageFile(file);
    if (validationError !== null) {
      throw new Error(validationError);
    }

    const prepared = await prepareImage(file);
    if (prepared.byteSize > MAX_JOURNAL_IMAGE_STORED_BYTES) {
      throw new Error(journalImageTooLargeMessage(
          prepared.byteSize,
          MAX_JOURNAL_IMAGE_STORED_BYTES,
          true,
      ));
    }

    const imageId = createId();
    const blobKey = `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${imageId}`;
    const dimensions = prepared.width === null
      ? await readImageDimensions(file)
      : {height: prepared.height, width: prepared.width};
    await imageStore.putImage({
      blobKey,
      byteBuffer: prepared.byteBuffer,
      characterId,
      mimeType: prepared.mimeType,
    });
    return {
      altText: normalizeJournalImageFileName(file.name),
      blobKey,
      byteSize: prepared.byteSize,
      fileName: normalizeJournalImageFileName(file.name),
      height: dimensions.height,
      id: imageId,
      mimeType: prepared.mimeType,
      width: dimensions.width,
    };
  }

  async function readNotes(characterId: CharacterId): Promise<JournalNote[]> {
    const records = await readRawCharacterJournalRecords(characterId);
    return records.filter(isJournalNote).filter((note) => note.characterId === characterId);
  }
}

function releaseUnlinkedImages(
    images: readonly JournalImage[],
    body: string,
): {images: JournalImage[]; released: JournalImage[]} {
  const referenced = journalImageIdsInBody(body);
  const kept: JournalImage[] = [];
  const released: JournalImage[] = [];
  for (const image of images) {
    if (referenced.has(image.id)) {
      kept.push(libraryImage(image));
    } else {
      released.push(libraryImage(image));
    }
  }
  return {images: kept, released};
}

function appendImageLine(body: string, line: string): string {
  return body.trim() === '' ? line : `${body.replace(/\s+$/, '')}\n\n${line}`;
}

function journalImagesChanged(
    images: readonly JournalImage[],
    reconciled: {images: JournalImage[]; removed: JournalImage[]},
): boolean {
  if (reconciled.removed.length > 0 || reconciled.images.length !== images.length) {
    return true;
  }

  return reconciled.images.some((image, index) =>
    (images[index]?.orphanedAt ?? null) !== (image.orphanedAt ?? null),
  );
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
