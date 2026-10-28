import {journalImageIdsInBody} from './character-journal-embeds';
import {removeJournalImageLine} from './character-journal-markdown';
import type {JournalImage, JournalNote} from './character-journal-types';

export type JournalPhotoUse = 'all' | 'in-note' | 'not-in-note';

export function mergePhotoCatalog(
    catalog: readonly JournalImage[],
    incoming: readonly JournalImage[],
): JournalImage[] {
  const byId = new Map<string, JournalImage>();
  for (const image of catalog) {
    byId.set(image.id, libraryImage(image));
  }
  for (const image of incoming) {
    if (!byId.has(image.id)) {
      byId.set(image.id, libraryImage(image));
    }
  }
  return [...byId.values()];
}

export function samePhotoCatalog(
    left: readonly JournalImage[],
    right: readonly JournalImage[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightById = new Map(right.map((image) => [image.id, image]));
  return left.every((image) => {
    const other = rightById.get(image.id);
    return other !== undefined
      && other.blobKey === image.blobKey
      && other.fileName === image.fileName
      && other.byteSize === image.byteSize;
  });
}

export function notesUsingPhoto(
    notes: readonly JournalNote[],
    imageId: string,
): JournalNote[] {
  return notes.filter((note) =>
    note.images.some((image) => image.id === imageId)
    || journalImageIdsInBody(note.body).has(imageId),
  );
}

export function visibleLibraryPhotos(
    photos: readonly JournalImage[],
    notes: readonly JournalNote[],
    query: string,
    use: JournalPhotoUse,
): JournalImage[] {
  const needle = query.trim().toLowerCase();
  return photos.filter((photo) => {
    if (needle !== '' && !photo.fileName.toLowerCase().includes(needle)) {
      return false;
    }
    const used = notesUsingPhoto(notes, photo.id).length > 0;
    if (use === 'in-note') {
      return used;
    }
    if (use === 'not-in-note') {
      return !used;
    }
    return true;
  });
}

export function libraryEmptyMessage(
    storedCount: number,
    visibleCount: number,
    query: string,
    use: JournalPhotoUse,
): string | null {
  if (visibleCount > 0) {
    return null;
  }
  if (storedCount === 0) {
    return 'No photos yet.';
  }
  if (query.trim() !== '') {
    return 'No photos match that search.';
  }
  if (use === 'not-in-note') {
    return 'Every photo is in a note.';
  }
  if (use === 'in-note') {
    return 'No photo is in a note yet.';
  }
  return 'No photos yet.';
}

export function unlinkPhotoFromNote(note: JournalNote, imageId: string): JournalNote {
  const images = note.images.filter((image) => image.id !== imageId);
  return {
    ...note,
    body: removeJournalImageLine(note.body, imageId),
    featuredImageId: note.featuredImageId === imageId
      ? images[0]?.id ?? null
      : note.featuredImageId,
    images,
  };
}

export function photoDeleteQuestion(titles: readonly string[]): string {
  if (titles.length === 0) {
    return 'Delete this photo? This cannot be undone.';
  }
  return `Delete this photo? It will be removed from: ${titles.join(', ')}. Those notes stay.`;
}

export function libraryImage(image: JournalImage): JournalImage {
  if (image.orphanedAt === undefined || image.orphanedAt === null) {
    return image;
  }
  const next = {...image};
  delete next.orphanedAt;
  return next;
}
