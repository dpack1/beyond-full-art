import {
  isJournalImage,
  isJournalNote,
  JOURNAL_IMAGE_BLOB_KEY_PREFIX,
  type JournalImage,
  type JournalNote,
} from '../character-journal/character-journal-types';
import {remapJournalNoteImages} from '../character-journal/journal-image-remap';

export interface JournalImageCopy {
  fromBlobKey: string;
  image: JournalImage;
}

export interface DuplicatedJournal {
  catalog: JournalImage[];
  imageCopies: JournalImageCopy[];
  notes: JournalNote[];
}

export function planJournalDuplicate(
    records: readonly unknown[],
    catalog: readonly unknown[],
    characterId: string,
    createId: () => string,
): DuplicatedJournal {
  const notes = records.filter(isJournalNote);
  const images = new Map<string, JournalImage>();
  for (const note of notes) {
    for (const image of note.images) {
      images.set(image.id, image);
    }
  }
  for (const image of catalog) {
    if (isJournalImage(image) && !images.has(image.id)) {
      images.set(image.id, image);
    }
  }
  const replacements = new Map<string, string>();
  for (const id of images.keys()) {
    replacements.set(id, createId());
  }
  const copiedImages = new Map<string, JournalImage>();
  for (const [previousId, image] of images) {
    const nextId = replacements.get(previousId);
    if (nextId === undefined) {
      continue;
    }
    copiedImages.set(previousId, {
      ...image,
      blobKey: `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${nextId}`,
      id: nextId,
      orphanedAt: image.orphanedAt ?? null,
    });
  }
  return {
    catalog: [...copiedImages.values()].map(withoutEmptyOrphan),
    imageCopies: [...images.entries()].flatMap(([previousId, image]) => {
      const copied = copiedImages.get(previousId);
      return copied === undefined ? [] : [{fromBlobKey: image.blobKey, image: copied}];
    }),
    notes: notes.map((note) => ({
      ...remapJournalNoteImages(note, replacements),
      characterId,
      id: createId(),
    })),
  };
}

function withoutEmptyOrphan(image: JournalImage): JournalImage {
  if (image.orphanedAt === undefined || image.orphanedAt === null) {
    const next = {...image};
    delete next.orphanedAt;
    return next;
  }
  return image;
}
