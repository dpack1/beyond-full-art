import {describe, expect, it} from 'vitest';

import {
  decideLibraryConnection,
  libraryDecisionMessage,
  type LibraryItem,
} from '../../src/platform/chrome/backup-folder-decision';

const art = (id: string, detail: string): LibraryItem => ({
  characterId: id,
  detail,
  id: 'full-art',
  kind: 'art',
  revision: '2026-10-23T00:00:00.000Z',
});

const note = (characterId: string, id: string, body: string): LibraryItem => ({
  characterId,
  detail: body,
  id,
  kind: 'note',
  revision: '2026-10-23T00:00:00.000Z',
});

describe('backup folder connection decisions', () => {
  it('prepares a blank folder when this browser has nothing saved', () => {
    expect(decideLibraryConnection('blank', [], [])).toEqual({kind: 'blank-empty'});
  });

  it('reports local art before a blank folder is copied', () => {
    const decision = decideLibraryConnection('blank', [
      art('172153137', '10:2026-10-23T00:00:00.000Z'),
      note('172153137', 'note-1', 'Met Voss.'),
    ], []);
    expect(decision).toEqual({
      characters: 1,
      kind: 'blank-with-local',
      notes: 1,
      photos: 0,
    });
    expect(libraryDecisionMessage('Campaign art', decision))
        .toContain('copies can be removed');
    expect(libraryDecisionMessage('Campaign art', decision))
        .toContain('new art and notes save in the folder');
    expect(libraryDecisionMessage('Campaign art', decision))
        .not.toContain('not available yet');
  });

  it('uses an existing folder when this browser is empty', () => {
    expect(decideLibraryConnection('owned', [], [art('172153137', '10:a')]))
        .toEqual({characters: 1, kind: 'use-folder'});
  });

  it('matches when every record agrees', () => {
    const items = [note('172153137', 'note-1', 'Met Voss.')];
    expect(decideLibraryConnection('owned', items, items))
        .toEqual({characters: 1, kind: 'matches'});
  });

  it('lists additions when records do not overlap', () => {
    const decision = decideLibraryConnection(
        'owned',
        [note('172153137', 'note-1', 'Local only.')],
        [note('172153138', 'note-2', 'Folder only.')],
    );
    expect(decision).toEqual({fromBrowser: 1, fromFolder: 1, kind: 'additions'});
    expect(libraryDecisionMessage('Campaign art', decision))
        .toContain('That merge is not available yet.');
  });

  it('offers a checked copy when the folder has no records of its own', () => {
    const decision = decideLibraryConnection(
        'owned',
        [note('172153137', 'note-1', 'Local only.')],
        [],
    );
    expect(decision).toEqual({fromBrowser: 1, fromFolder: 0, kind: 'additions'});
    expect(libraryDecisionMessage('Campaign art', decision))
        .toContain('sheet keeps using them');
  });

  it('stops on a real conflict and does not describe a deletion', () => {
    const decision = decideLibraryConnection(
        'owned',
        [note('172153137', 'note-1', 'Browser edit.')],
        [note('172153137', 'note-1', 'Folder edit.')],
    );
    expect(decision.kind).toBe('conflicts');
    expect(libraryDecisionMessage('Campaign art', decision))
        .toContain('Nothing was changed.');
  });
});
