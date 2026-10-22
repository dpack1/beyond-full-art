import {describe, expect, it} from 'vitest';

import {
  buildJournalMarkdownArchive,
  JOURNAL_EXPORT_FORMAT,
  JOURNAL_EXPORT_VERSION,
  journalExportImageReferences,
  parseJournalExportJson,
} from '../../src/features/character-journal/character-journal-export';

describe('character journal export', () => {
  const characters = [{
    characterId: '169418374',
    records: [{
      body: 'Met <script>alert(1)</script>.',
      characterId: '169418374',
      createdAt: '2026-10-20T00:00:00.000Z',
      featuredImageId: 'image-1',
      id: 'note-1',
      images: [{
        altText: '',
        blobKey: 'bfa.journal.image.image-1',
        byteSize: 3,
        fileName: 'gate.png',
        height: 20,
        id: 'image-1',
        mimeType: 'image/png',
        width: 20,
      }],
      needsDetails: false,
      questStatus: null,
      schemaVersion: 2,
      sessionDate: null,
      title: 'Gate <Arrival>',
      type: 'place',
      updatedAt: '2026-10-21T00:00:00.000Z',
    }, {id: 'unreadable-record'}],
  }];

  it('deduplicates image references across notes', () => {
    const character = characters[0];
    if (character === undefined || character.records[0] === undefined) {
      throw new Error('Missing test journal');
    }
    const duplicated = [{
      ...character,
      records: [character.records[0], character.records[0]],
    }];

    expect(journalExportImageReferences(duplicated)).toEqual([{
      blobKey: 'bfa.journal.image.image-1',
      fileName: 'gate.png',
      mimeType: 'image/png',
    }]);
  });

  it('keeps photo references from a future record shape', () => {
    expect(journalExportImageReferences([{
      characterId: '169418374',
      records: [{attachments: [{
        blobKey: 'bfa.journal.image.future-photo',
        fileName: 'future.webp',
        mimeType: 'image/webp',
      }], schemaVersion: 99}],
    }])).toEqual([{
      blobKey: 'bfa.journal.image.future-photo',
      fileName: 'future.webp',
      mimeType: 'image/webp',
    }]);
  });

  it('rejects files that are not the supported backup format', () => {
    expect(() => parseJournalExportJson('{"format":"something-else"}'))
        .toThrow('This journal backup format is not supported.');
    expect(() => parseJournalExportJson('not json'))
        .toThrow('This file does not contain a valid journal backup.');
  });

  it('builds Markdown notes with portable photo links', () => {
    const archive = buildJournalMarkdownArchive({
      characters,
      exportedAt: '2026-10-22T12:00:00.000Z',
      format: JOURNAL_EXPORT_FORMAT,
      images: [{
        blobKey: 'bfa.journal.image.image-1',
        byteBase64: 'AQID',
        error: null,
        fileName: 'gate.png',
        mimeType: 'image/png',
      }],
      version: JOURNAL_EXPORT_VERSION,
    });

    expect(archive.markdownFiles[0]?.path).toMatch(
        /^characters\/169418374\/notes\/Gate-Arrival\.md$/,
    );
    expect(archive.markdownFiles[0]?.text)
        .toContain('![ ](../photos/gate.png)'.replace('[ ]', '[]'));
    expect(archive.backup.images[0]?.byteBase64).toBeNull();
    expect(archive.backup.images[0]?.zipPath)
        .toBe('characters/169418374/photos/gate.png');
    expect(archive.backup.characters).toEqual(characters);
  });

  it('adds a suffix only when note titles collide', () => {
    const first = characters[0]?.records[0];
    if (first === undefined) {
      throw new Error('Missing test note');
    }
    const archive = buildJournalMarkdownArchive({
      characters: [{
        characterId: '169418374',
        records: [
          {...first, title: 'My Beginning'},
          {...first, id: 'note-2', title: 'My Beginning'},
        ],
      }],
      exportedAt: '2026-10-22T12:00:00.000Z',
      format: JOURNAL_EXPORT_FORMAT,
      images: [],
      version: JOURNAL_EXPORT_VERSION,
    });

    expect(archive.markdownFiles.map((file) => file.path)).toEqual([
      'characters/169418374/notes/My Beginning.md',
      'characters/169418374/notes/My Beginning-2.md',
    ]);
  });

  it('uses photo filenames and suffixes only duplicate names', () => {
    const first = characters[0]?.records[0];
    if (first === undefined || !('images' in first) || !Array.isArray(first.images)) {
      throw new Error('Missing test photo');
    }
    const secondImage = {
      ...first.images[0],
      blobKey: 'bfa.journal.image.image-2',
      id: 'image-2',
    };
    const archive = buildJournalMarkdownArchive({
      characters: [{
        characterId: '169418374',
        records: [first, {
          ...first,
          body: '![[img:image-2]]',
          id: 'note-2',
          images: [secondImage],
        }],
      }],
      exportedAt: '2026-10-22T12:00:00.000Z',
      format: JOURNAL_EXPORT_FORMAT,
      images: [
        {
          blobKey: 'bfa.journal.image.image-1',
          byteBase64: 'AQID',
          error: null,
          fileName: 'gate.png',
          mimeType: 'image/png',
        },
        {
          blobKey: 'bfa.journal.image.image-2',
          byteBase64: 'BAUG',
          error: null,
          fileName: 'gate.png',
          mimeType: 'image/png',
        },
      ],
      version: JOURNAL_EXPORT_VERSION,
    });

    expect(archive.backup.images.map((image) => image.zipPath)).toEqual([
      'characters/169418374/photos/gate.png',
      'characters/169418374/photos/gate-2.png',
    ]);
  });
});
