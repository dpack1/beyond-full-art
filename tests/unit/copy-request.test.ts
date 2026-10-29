import {describe, expect, it} from 'vitest';

import {
  characterCopyTarget,
  characterIdFromCopyResponse,
} from '../../src/features/character-copy/copy-request';
import {
  createCopyTrackerState,
  noteCopyClicked,
  noteCopyObserved,
} from '../../src/features/character-copy/copy-correlation';
import {planJournalDuplicate} from '../../src/features/character-copy/duplicate-journal';

describe('character copy request', () => {
  it('reads the source id from a copy path', () => {
    expect(characterCopyTarget(
        'POST',
        'https://character-service.dndbeyond.com/character/v5/character/172153137/copy',
    )).toEqual({
      matched: true,
      requiresSource: false,
      sourceFromPath: true,
      sourceId: '172153137',
    });
  });

  it('accepts a trailing slash on the collection copy url', () => {
    expect(characterCopyTarget(
        'POST',
        'https://character-service.dndbeyond.com/character/v5/character/copy/',
    )).toMatchObject({
      matched: true,
      requiresSource: false,
      sourceFromPath: false,
      sourceId: null,
    });
  });

  it('requires a source id before a bare character post counts', () => {
    expect(characterCopyTarget(
        'POST',
        'https://character-service.dndbeyond.com/character/v5/character',
    )).toMatchObject({matched: true, requiresSource: true, sourceId: null});
  });

  it('does not treat the delete url as a copy', () => {
    expect(characterCopyTarget(
        'DELETE',
        'https://character-service.dndbeyond.com/character/v5/character',
    ).matched).toBe(false);
  });

  it('reads one new character id from the response', () => {
    expect(characterIdFromCopyResponse('{"data":{"id":900000003,"userId":42}}'))
        .toBe('900000003');
    expect(characterIdFromCopyResponse('{"data":{"id":1,"characterId":2}}')).toBeNull();
  });
});

describe('character copy pairing', () => {
  it('signals a path copy without a click', () => {
    const paired = noteCopyObserved(createCopyTrackerState(), {
      at: 1_000,
      destinationId: '900000003',
      sourceFromPath: true,
      sourceId: '172153137',
      tabId: 4,
    }, 1_000);
    expect(paired.signal).toEqual({
      destinationId: '900000003',
      sourceId: '172153137',
      tabId: 4,
    });
  });

  it('signals a request-body copy without a click', () => {
    const paired = noteCopyObserved(createCopyTrackerState(), {
      at: 1_000,
      destinationId: '172948676',
      sourceFromPath: false,
      sourceId: '900000002',
      tabId: 4,
    }, 1_000);
    expect(paired.signal).toEqual({
      destinationId: '172948676',
      sourceId: '900000002',
      tabId: 4,
    });
  });

  it('pairs one Copy click with a response that has no source id', () => {
    const clicked = noteCopyClicked(createCopyTrackerState(), {
      at: 1_000,
      sourceId: '172153137',
      tabId: 4,
    }, 1_000);
    const paired = noteCopyObserved(clicked.state, {
      at: 1_200,
      destinationId: '900000003',
      sourceFromPath: false,
      sourceId: null,
      tabId: 4,
    }, 1_200);
    expect(paired.signal?.sourceId).toBe('172153137');
    expect(paired.signal?.destinationId).toBe('900000003');
  });

  it('does not guess when two characters were clicked', () => {
    let state = createCopyTrackerState();
    state = noteCopyClicked(state, {at: 1_000, sourceId: '172153137', tabId: 4}, 1_000).state;
    state = noteCopyClicked(state, {at: 1_100, sourceId: '169418374', tabId: 4}, 1_100).state;
    const paired = noteCopyObserved(state, {
      at: 1_200,
      destinationId: '900000003',
      sourceFromPath: false,
      sourceId: null,
      tabId: 4,
    }, 1_200);
    expect(paired.signal).toBeNull();
  });
});

describe('journal duplicate plan', () => {
  it('gives the new character its own note and photo ids', () => {
    const ids = ['photo-copy', 'library-copy', 'note-copy'];
    const planned = planJournalDuplicate([note()], [catalogPhoto()], '200', () => {
      const next = ids.shift();
      if (next === undefined) {
        throw new Error('The test ran out of ids.');
      }
      return next;
    });
    expect(planned.notes.map((item) => item.id)).toEqual(['note-copy']);
    expect(planned.notes[0]?.characterId).toBe('200');
    expect(planned.notes[0]?.featuredImageId).toBe('photo-copy');
    expect(planned.notes[0]?.body).toBe('See ![[img:photo-copy|Camp|300]]');
    expect(planned.notes[0]?.images[0]?.blobKey).toBe('bfa.journal.image.photo-copy');
    expect(planned.imageCopies.map((item) => item.fromBlobKey)).toEqual([
      'bfa.journal.image.photo-1',
      'bfa.journal.image.library-1',
    ]);
    expect(planned.catalog.map((item) => item.id)).toEqual(['photo-copy', 'library-copy']);
  });
});

function note() {
  return {
    body: 'See ![[img:photo-1|Camp|300]]',
    characterId: '172153137',
    createdAt: '2026-10-23T00:00:00.000Z',
    featuredImageId: 'photo-1',
    id: 'note-1',
    images: [{
      altText: 'Camp',
      blobKey: 'bfa.journal.image.photo-1',
      byteSize: 3,
      fileName: 'camp.png',
      height: null,
      id: 'photo-1',
      mimeType: 'image/png' as const,
      width: null,
    }],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2 as const,
    sessionDate: null,
    title: 'Session',
    type: 'session' as const,
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

function catalogPhoto() {
  return {
    altText: 'Map',
    blobKey: 'bfa.journal.image.library-1',
    byteSize: 4,
    fileName: 'map.png',
    height: null,
    id: 'library-1',
    mimeType: 'image/png' as const,
    width: null,
  };
}
