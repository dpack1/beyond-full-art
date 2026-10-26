import type {JournalNote} from './character-journal-types';
import {JOURNAL_IMAGE_BLOB_KEY_PREFIX} from './character-journal-types';

export function remapJournalNoteImages(
    note: JournalNote,
    replacements: ReadonlyMap<string, string>,
): JournalNote {
  if (replacements.size === 0) {
    return note;
  }

  let body = note.body;
  for (const [previousId, nextId] of replacements) {
    body = body.replace(
        new RegExp(`(!\\[\\[img:)${escapeRegExp(previousId)}(?=\\||\\]\\])`, 'g'),
        `$1${nextId}`,
    );
  }

  return {
    ...note,
    body,
    featuredImageId: note.featuredImageId === null
      ? null
      : replacements.get(note.featuredImageId) ?? note.featuredImageId,
    images: note.images.map((image) => {
      const nextId = replacements.get(image.id);
      return nextId === undefined
        ? image
        : {
          ...image,
          blobKey: `${JOURNAL_IMAGE_BLOB_KEY_PREFIX}${nextId}`,
          id: nextId,
        };
    }),
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
