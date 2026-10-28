import {describe, expect, it} from 'vitest';

import {
  libraryEmptyMessage,
  mergePhotoCatalog,
  notesUsingPhoto,
  photoDeleteQuestion,
  unlinkPhotoFromNote,
  visibleLibraryPhotos,
} from '../../src/features/character-journal/character-journal-library';
import type {JournalImage, JournalNote} from '../../src/features/character-journal/character-journal-types';

describe('journal photo library', () => {
  it('keeps the first copy of an id and drops the orphan mark', () => {
    const merged = mergePhotoCatalog(
        [image('photo-1', {orphanedAt: '2026-10-13T11:00:00.000Z'})],
        [image('photo-1', {fileName: 'newer.png'}), image('photo-2')],
    );
    expect(merged.map((photo) => photo.id)).toEqual(['photo-1', 'photo-2']);
    expect(merged[0]?.fileName).toBe('photo-1.png');
    expect(merged[0]?.orphanedAt).toBeUndefined();
  });

  it('filters by file name and by whether a note uses the photo', () => {
    const photos = [image('door'), image('camp')];
    const notes = [note('Camp', 'camp')];
    expect(visibleLibraryPhotos(photos, notes, 'doo', 'all').map((photo) => photo.id))
        .toEqual(['door']);
    expect(visibleLibraryPhotos(photos, notes, '', 'in-note').map((photo) => photo.id))
        .toEqual(['camp']);
    expect(visibleLibraryPhotos(photos, notes, '', 'not-in-note').map((photo) => photo.id))
        .toEqual(['door']);
    expect(notesUsingPhoto(notes, 'camp')).toHaveLength(1);
  });

  it('names the empty grid and the notes a delete will change', () => {
    expect(libraryEmptyMessage(0, 0, '', 'all')).toBe('No photos yet.');
    expect(libraryEmptyMessage(2, 0, 'zzz', 'all')).toBe('No photos match that search.');
    expect(libraryEmptyMessage(2, 0, '', 'not-in-note')).toBe('Every photo is in a note.');
    expect(libraryEmptyMessage(2, 0, '', 'in-note')).toBe('No photo is in a note yet.');
    expect(photoDeleteQuestion([])).toBe('Delete this photo? This cannot be undone.');
    expect(photoDeleteQuestion(['Camp', 'Chapel']))
        .toBe('Delete this photo? It will be removed from: Camp, Chapel. Those notes stay.');
  });

  it('takes a photo out of one note without dropping the id from the record shape', () => {
    const next = unlinkPhotoFromNote(note('Camp', 'camp'), 'camp');
    expect(next.images).toEqual([]);
    expect(next.body).toBe('Body');
    expect(next.featuredImageId).toBeNull();
    expect(next.id).toBe('note-1');
  });
});

function image(id: string, overrides: Partial<JournalImage> = {}): JournalImage {
  return {
    altText: `${id}.png`,
    blobKey: `bfa.journal.image.${id}`,
    byteSize: 4,
    fileName: `${id}.png`,
    height: null,
    id,
    mimeType: 'image/png',
    width: null,
    ...overrides,
  };
}

function note(title: string, imageId: string): JournalNote {
  return {
    body: `Body\n\n![[img:${imageId}]]`,
    characterId: '169418374',
    createdAt: '2026-10-13T12:00:00.000Z',
    featuredImageId: imageId,
    id: 'note-1',
    images: [image(imageId)],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title,
    type: 'session',
    updatedAt: '2026-10-13T12:00:00.000Z',
  };
}
