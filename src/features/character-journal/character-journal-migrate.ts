import type {CharacterJournalEntry, JournalImage, JournalNote} from './character-journal-types';
import {
  getImageBlocks,
  getTextFromJournalEntry,
  isCharacterJournalEntry,
  isJournalNote,
} from './character-journal-types';

export interface ReadableJournalV1 {
  blobKeys: string[];
  id: string;
}

export interface JournalMigrationPlan {
  hasVersion1: boolean;
  nextRecords: unknown[];
  readable: ReadableJournalV1[];
}

export function planJournalMigration(
    records: readonly unknown[],
): JournalMigrationPlan {
  const readable: ReadableJournalV1[] = [];
  const nextRecords = records.map((record) => {
    if (!isCharacterJournalEntry(record)) {
      return record;
    }

    const note = mapJournalV1Entry(record);
    readable.push({
      blobKeys: note.images.map((image) => image.blobKey),
      id: note.id,
    });
    return note;
  });

  return {
    hasVersion1: readable.length > 0,
    nextRecords,
    readable,
  };
}

export function mapJournalV1Entry(entry: CharacterJournalEntry): JournalNote {
  const images = getImageBlocks(entry).map(mapJournalImage);
  const text = getTextFromJournalEntry(entry).trim();
  const imageMarkdown = images
      .map((image) => journalImageMarkdown(image))
      .join('\n');
  const body = [text, imageMarkdown].filter((part) => part !== '').join('\n\n');

  return {
    body,
    characterId: entry.characterId,
    createdAt: entry.createdAt,
    featuredImageId: images[0]?.id ?? null,
    id: entry.id,
    images,
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title: entry.title,
    type: 'unset',
    updatedAt: entry.updatedAt,
  };
}

export function journalMigrationConfirmed(
    readable: readonly ReadableJournalV1[],
    records: readonly unknown[],
): boolean {
  return readable.every((expected) => {
    const note = records.find((record) =>
      isJournalNote(record) && record.id === expected.id,
    );
    if (!isJournalNote(note)) {
      return false;
    }

    const blobKeys = note.images.map((image) => image.blobKey);
    return blobKeys.length === expected.blobKeys.length
      && blobKeys.every((blobKey, index) => blobKey === expected.blobKeys[index]);
  });
}

function mapJournalImage(
    block: ReturnType<typeof getImageBlocks>[number],
): JournalImage {
  return {
    altText: block.fileName,
    blobKey: block.blobKey,
    byteSize: block.byteSize,
    fileName: block.fileName,
    height: block.height,
    id: block.id,
    mimeType: block.mimeType,
    width: block.width,
  };
}

function journalImageMarkdown(image: JournalImage): string {
  const fileName = image.fileName.replace(/[\[\]]/g, '').trim() || 'Photo';
  return `![${fileName}](bfa-journal-image:${image.id})`;
}
