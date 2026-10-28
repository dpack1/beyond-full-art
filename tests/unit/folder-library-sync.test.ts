// @vitest-environment node

import {IDBFactory} from 'fake-indexeddb';
import {beforeEach, describe, expect, it} from 'vitest';
import type {JournalNote} from '../../src/features/character-journal/character-journal-types';
import {
  deleteFolderArt,
  keepFolderArtVersion,
  readCommit,
  readFolderArtBytes,
  readFolderCropBytes,
  readFolderArtMetadata,
  readFolderJournalImage,
  libraryDirectoryIsOpen,
  readFolderNotes,
  restoreFolderNote,
  saveFolderFullArt,
  saveFolderCrop,
  writeFolderJournalImage,
  writeFolderNotes,
} from '../../src/platform/chrome/folder-library';
import {
  compareLibrarySnapshots,
  type FolderLibrarySnapshot,
  type LibrarySyncRecord,
} from '../../src/platform/chrome/folder-library-compare';
import {
  browserLibraryRecords,
  readFolderLibrarySnapshot,
} from '../../src/platform/chrome/folder-library-snapshot';
import {readFolderLibraryStatus} from '../../src/platform/chrome/folder-library-status';
import {
  mergeBrowserAdditionsIntoFolder,
  unionBrowserLibraryIntoFolder,
} from '../../src/platform/chrome/folder-library-union';
import {LIBRARY_MODE_KEY} from '../../src/platform/chrome/library-mode';
import {putStoredCharacterArtBlob} from '../../src/platform/chrome/indexed-db';
import {
  getCharacterArtMetadataKey,
  getCharacterJournalEntriesKey,
  getCharacterPortraitCropMetadataKey,
} from '../../src/platform/chrome/storage';
import {resolveFolderNoteConflicts} from '../../src/platform/chrome/folder-library-conflicts';

beforeEach(() => {
  (globalThis as {chrome?: unknown}).chrome = {runtime: {lastError: undefined}};
});

describe('folder library permission', () => {
  it('opens a folder the worker still reports as prompting', async () => {
    const opened = await libraryDirectoryIsOpen({
      async getDirectoryHandle() {
        return {} as FileSystemDirectoryHandle;
      },
    }, 'prompt');

    expect(opened).toBe(true);
  });

  it('stays closed when the prompt folder cannot be opened', async () => {
    const opened = await libraryDirectoryIsOpen({
      async getDirectoryHandle() {
        throw new DOMException('Not allowed', 'NotAllowedError');
      },
    }, 'prompt');

    expect(opened).toBe(false);
  });

  it('does not open a folder this browser denied', async () => {
    let touched = false;
    const opened = await libraryDirectoryIsOpen({
      async getDirectoryHandle() {
        touched = true;
        return {} as FileSystemDirectoryHandle;
      },
    }, 'denied');

    expect(touched).toBe(false);
    expect(opened).toBe(false);
  });
});

describe('folder library tombstones', () => {
  it('keeps a deleted note and its photos deleted until explicit restore', async () => {
    const root = preparedFolder();
    const note = sessionNote();
    const photo = note.images[0];
    if (photo === undefined) {
      throw new Error('The fixture photo is missing.');
    }
    const photoBytes = Uint8Array.from([4, 5, 6]);

    await writeFolderJournalImage(
        root.asHandle(),
        note.characterId,
        photo.blobKey,
        photoBytes,
        'image/png',
        '2026-10-23T12:00:00.000Z',
    );
    await writeFolderNotes(
        root.asHandle(),
        note.characterId,
        [note],
        '2026-10-23T12:00:00.000Z',
    );
    await writeFolderNotes(
        root.asHandle(),
        note.characterId,
        [],
        '2026-10-23T13:00:00.000Z',
    );

    const deletedCommit = await readCommit(root.asHandle(), note.characterId);
    expect(deletedCommit?.tombstones.map(({id, kind}) => ({id, kind}))).toEqual([
      {id: 'note-1', kind: 'note'},
      {id: 'photo-1', kind: 'image'},
    ]);
    expect(deletedCommit?.tombstones.every((entry) => entry.sha256.length === 64)).toBe(true);
    expect(await readFolderNotes(root.asHandle(), note.characterId)).toEqual([]);
    expect(await readFolderJournalImage(root.asHandle(), photo.blobKey)).toBeNull();
    expect(root.find(['characters', note.characterId, 'journal', 'images']).files.has('photo-1.png'))
        .toBe(true);
    expect(root.find(['characters', note.characterId, 'journal', 'notes']).files.has('note-1.json'))
        .toBe(false);

    await expect(writeFolderNotes(
        root.asHandle(),
        note.characterId,
        [note],
        '2026-10-23T14:00:00.000Z',
    )).rejects.toThrow('Restore it before saving');

    await restoreFolderNote(
        root.asHandle(),
        note,
        '2026-10-23T15:00:00.000Z',
    );

    expect((await readFolderNotes(root.asHandle(), note.characterId)).map(({id}) => id))
        .toEqual(['note-1']);
    expect([...(new Uint8Array((await readFolderJournalImage(
        root.asHandle(),
        photo.blobKey,
    ))?.byteBuffer ?? new ArrayBuffer()))]).toEqual([4, 5, 6]);
    expect((await readCommit(root.asHandle(), note.characterId))?.tombstones).toEqual([]);
    expect(root.find(['characters', note.characterId, 'journal', 'tombstones']).files.size)
        .toBe(0);
  });

  it('preserves tombstones when another note is rewritten', async () => {
    const root = preparedFolder();
    const deleted = sessionNote();
    const kept = {...sessionNote(), id: 'note-2', images: [], title: 'Kept'};
    await writeFolderNotes(root.asHandle(), deleted.characterId, [deleted, kept]);
    await writeFolderNotes(root.asHandle(), deleted.characterId, [kept]);

    await writeFolderNotes(root.asHandle(), deleted.characterId, [
      {...kept, body: 'Updated', updatedAt: '2026-10-23T16:00:00.000Z'},
    ]);

    expect((await readCommit(root.asHandle(), deleted.characterId))?.tombstones)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({id: 'note-1', kind: 'note'}),
          expect.objectContaining({id: 'photo-1', kind: 'image'}),
        ]));
  });

  it('records art deletion and preserves note tombstones through an art write', async () => {
    const root = preparedFolder();
    const deleted = sessionNote();
    await writeFolderNotes(root.asHandle(), deleted.characterId, [deleted]);
    await writeFolderNotes(root.asHandle(), deleted.characterId, []);
    await saveFolderFullArt(
        root.asHandle(),
        artMetadata(deleted.characterId),
        Uint8Array.from([8, 9]),
        '2026-10-23T17:00:00.000Z',
    );

    expect((await readCommit(root.asHandle(), deleted.characterId))?.tombstones)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({id: 'note-1', kind: 'note'}),
          expect.objectContaining({id: 'photo-1', kind: 'image'}),
        ]));

    await deleteFolderArt(root.asHandle(), deleted.characterId);

    expect(await readFolderArtMetadata(root.asHandle(), deleted.characterId)).toBeNull();
    expect((await readCommit(root.asHandle(), deleted.characterId))?.tombstones)
        .toEqual(expect.arrayContaining([
          expect.objectContaining({
            fileName: 'tombstones/full-art.json',
            id: 'full-art',
            kind: 'full-art',
          }),
        ]));
  });
});

describe('folder library kept art', () => {
  it('tracks a conflicting art copy and preserves it through later saves', async () => {
    const root = preparedFolder();
    const characterId = '172153137';
    const keptBytes = Uint8Array.from([3, 1, 4]);

    const kept = await keepFolderArtVersion(
        root.asHandle(),
        characterId,
        'full-art',
        keptBytes,
        'image/png',
        '2026-10-26T14:15:16.000Z',
    );
    await saveFolderFullArt(
        root.asHandle(),
        artMetadata(characterId),
        Uint8Array.from([8, 9]),
        '2026-10-26T14:16:00.000Z',
    );

    expect(kept.fileName).toBe('full-art-kept-20261026T141516Z.png');
    expect(kept.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect((await readCommit(root.asHandle(), characterId))?.kept).toEqual([kept]);
    expect(root.find(['characters', characterId]).files.get(kept.fileName)).toEqual(keptBytes);
  });

  it('does not overwrite two kept copies created in the same second', async () => {
    const root = preparedFolder();
    const now = '2026-10-26T14:15:16.000Z';

    const first = await keepFolderArtVersion(
        root.asHandle(), '172153137', 'crop', Uint8Array.from([1]), 'image/png', now,
    );
    const second = await keepFolderArtVersion(
        root.asHandle(), '172153137', 'crop', Uint8Array.from([2]), 'image/png', now,
    );

    expect(first.fileName).toBe('portrait-crop-kept-20261026T141516Z.png');
    expect(second.fileName).toBe('portrait-crop-kept-20261026T141516Z-2.png');
  });

  it('refuses full-art bytes when the page loaded an older folder hash', async () => {
    const root = preparedFolder();
    const characterId = '172153137';
    const currentBytes = Uint8Array.from([1, 2]);
    await saveFolderFullArt(root.asHandle(), artMetadata(characterId), currentBytes);

    await expect(saveFolderFullArt(
        root.asHandle(),
        {...artMetadata(characterId), blobKey: 'new-art'},
        Uint8Array.from([8, 9]),
        '2026-10-26T19:00:00.000Z',
        '0'.repeat(64),
    )).rejects.toThrow('Full art changed in the folder');

    expect(await readFolderArtBytes(root.asHandle(), characterId)).toEqual(currentBytes);
  });
});

describe('folder library comparison', () => {
  it('hashes browser image bytes instead of comparing metadata previews', async () => {
    const records = await browserLibraryRecords([{
      art: {bytes: Uint8Array.from([1, 2, 3]), metadata: artMetadata('172153137')},
      characterId: '172153137',
      crop: null,
      images: [],
      notes: [],
      problem: null,
    }]);

    expect(records).toEqual([
      expect.objectContaining({id: 'full-art', kind: 'full-art'}),
    ]);
    expect(records[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it('keeps the shipped match path when every browser record matches', () => {
    const browser = [syncRecord('note-1', 'same')];
    const folder = folderSnapshot([
      syncRecord('note-1', 'same'),
      syncRecord('folder-only', 'extra'),
    ]);

    expect(compareLibrarySnapshots(browser, folder)).toEqual({kind: 'match', siblings: []});
  });

  it('classifies browser and folder additions without treating them as conflicts', () => {
    const browser = [
      syncRecord('shared', 'same'),
      syncRecord('browser-only', 'browser'),
    ];
    const folder = folderSnapshot([
      syncRecord('shared', 'same'),
      syncRecord('folder-only', 'folder'),
    ]);

    const result = compareLibrarySnapshots(browser, folder);
    expect(result.kind).toBe('additions');
    expect(result.kind === 'additions' ? result.additions.map(({record, side}) => ({
      id: record.id,
      side,
    })) : []).toEqual([
      {id: 'browser-only', side: 'browser'},
      {id: 'folder-only', side: 'folder'},
    ]);
  });

  it('classifies changed shared ids and folder tombstones as conflicts', () => {
    const changed = compareLibrarySnapshots(
        [syncRecord('note-1', 'browser')],
        folderSnapshot([syncRecord('note-1', 'folder')]),
    );
    expect(changed.kind === 'conflicts' ? changed.conflicts[0]?.reason : null).toBe('changed');

    const deleted = compareLibrarySnapshots(
        [syncRecord('note-1', 'browser')],
        {
          ...folderSnapshot([]),
          tombstones: [{
            characterId: '172153137',
            deletedAt: '2026-10-23T18:00:00.000Z',
            id: 'note-1',
            kind: 'note',
          }],
        },
    );
    expect(deleted.kind === 'conflicts' ? deleted.conflicts[0]?.reason : null)
        .toBe('deleted-in-folder');
  });

  it('lists Drive conflict siblings without opening them as notes', async () => {
    const root = preparedFolder();
    const note = sessionNote();
    await writeFolderNotes(root.asHandle(), note.characterId, [note]);
    const notes = root.find(['characters', note.characterId, 'journal', 'notes']);
    notes.files.set('note-1 (1).json', new TextEncoder().encode('not a note'));

    const snapshot = await readFolderLibrarySnapshot(root.asHandle());

    expect(snapshot.siblings).toEqual([{
      characterId: note.characterId,
      directory: 'journal/notes',
      fileName: 'note-1 (1).json',
      managedFileName: 'note-1.json',
    }]);
    expect(root.openedFiles.has('note-1 (1).json')).toBe(false);
  });

  it('reports the newest committed folder change without opening Drive siblings', async () => {
    const root = preparedFolder();
    const note = sessionNote();
    await writeFolderNotes(
        root.asHandle(), note.characterId, [note], '2026-10-26T17:18:19.000Z',
    );
    root.find(['characters', note.characterId, 'journal', 'notes'])
        .files.set('note-1 (1).json', new TextEncoder().encode('conflict copy'));

    const status = await readFolderLibraryStatus(
        root.asHandle(), () => '2026-10-26T18:00:00.000Z',
    );

    expect(status).toEqual({
      characterCount: 1,
      checkedAt: '2026-10-26T18:00:00.000Z',
      newestAt: '2026-10-26T17:18:19.000Z',
      siblingCount: 1,
    });
    expect(root.openedFiles.has('note-1 (1).json')).toBe(false);
  });
});

describe('folder library union', () => {
  it('adds a browser-only note without rewriting a folder-only note', async () => {
    const root = preparedFolder();
    const folderOnly = {
      ...sessionNote(),
      featuredImageId: null,
      id: 'folder-note',
      images: [],
      title: 'Folder',
    };
    const browserOnly = {
      ...sessionNote(),
      featuredImageId: null,
      id: 'browser-note',
      images: [],
      title: 'Browser',
    };
    await writeFolderNotes(root.asHandle(), folderOnly.characterId, [folderOnly]);
    const folderNoteBytes = Uint8Array.from(
        root.find(['characters', folderOnly.characterId, 'journal', 'notes'])
            .files.get('folder-note.json') ?? [],
    );

    const result = await mergeBrowserAdditionsIntoFolder(root.asHandle(), [{
      art: null,
      characterId: browserOnly.characterId,
      crop: null,
      images: [],
      notes: [browserOnly],
      problem: null,
    }], () => '2026-10-23T19:00:00.000Z');

    expect(result).toEqual({
      additions: 1,
      characters: 1,
      kind: 'merged',
      notes: 1,
      photos: 0,
    });
    expect((await readFolderNotes(root.asHandle(), browserOnly.characterId)).map((note) => note.id))
        .toEqual(['folder-note', 'browser-note']);
    expect(root.find(['characters', folderOnly.characterId, 'journal', 'notes'])
        .files.get('folder-note.json')).toEqual(folderNoteBytes);
  });

  it('does not write when a shared note is different', async () => {
    const root = preparedFolder();
    const folder = sessionNote();
    const browser = {...folder, body: 'Changed locally'};
    await writeFolderNotes(root.asHandle(), folder.characterId, [folder]);

    const result = await mergeBrowserAdditionsIntoFolder(root.asHandle(), [{
      art: null,
      characterId: browser.characterId,
      crop: null,
      images: [],
      notes: [browser],
      problem: null,
    }]);

    expect(result).toEqual({conflicts: 1, kind: 'conflicts'});
    expect((await readFolderNotes(root.asHandle(), folder.characterId))[0]?.body).toBe('Met Voss.');
  });

  it('removes browser records only after the merged folder matches', async () => {
    const root = preparedFolder();
    root.files.set('beyond-full-art.json', new TextEncoder().encode(`${JSON.stringify({
      createdAt: '2026-10-23T00:00:00.000Z',
      format: 'beyond-full-art-folder',
      schemaVersion: 2,
    }, null, 2)}\n`));
    const folderOnly = {
      ...sessionNote(),
      featuredImageId: null,
      id: 'folder-note',
      images: [],
      title: 'Folder',
    };
    const browserOnly = {
      ...sessionNote(),
      featuredImageId: null,
      id: 'browser-note',
      images: [],
      title: 'Browser',
    };
    await writeFolderNotes(root.asHandle(), folderOnly.characterId, [folderOnly]);
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(browserOnly.characterId)] = [browserOnly];

    const result = await unionBrowserLibraryIntoFolder(
        root.asHandle(),
        {storageArea: storage as never},
        () => '2026-10-23T20:00:00.000Z',
    );

    expect(result).toEqual({
      additions: 1,
      characters: 1,
      kind: 'complete',
      notes: 1,
      photos: 0,
    });
    expect(storage.values[LIBRARY_MODE_KEY]).toBe('folder');
    expect(storage.values[getCharacterJournalEntriesKey(browserOnly.characterId)]).toBeUndefined();
    expect((await readFolderNotes(root.asHandle(), browserOnly.characterId)).map((note) => note.id))
        .toEqual(['folder-note', 'browser-note']);
  });
});

describe('folder note conflict resolution', () => {
  it('keeps both photo byte versions and remaps the losing note references', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const folder = {
      ...sessionNote(),
      body: 'Camp photo\n\n![[img:photo-1|Camp]]',
    };
    await writeFolderJournalImage(
        root.asHandle(),
        folder.characterId,
        folder.images[0]?.blobKey ?? '',
        Uint8Array.from([1, 2, 3]),
        'image/png',
    );
    await writeFolderNotes(root.asHandle(), folder.characterId, [folder]);

    const indexedDb = new IDBFactory();
    await putStoredCharacterArtBlob(
        folder.images[0]?.blobKey ?? '',
        new Blob([Uint8Array.from([8, 9, 10])], {type: 'image/png'}),
        indexedDb,
    );
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(folder.characterId)] = [folder];

    const ids = ['photo-other', 'note-other'];
    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {[`${folder.characterId}\u0000image\u0000photo-1`]: 'both'},
        {factory: indexedDb, storageArea: storage as never},
        () => ids.shift() ?? 'unexpected',
        () => '2026-10-26T22:00:00.000Z',
    );

    expect(result).toEqual({characters: 1, kind: 'complete', notes: 1, photos: 1});
    const notes = await readFolderNotes(root.asHandle(), folder.characterId);
    expect(notes.map((note) => ({
      body: note.body,
      featuredImageId: note.featuredImageId,
      id: note.id,
      imageId: note.images[0]?.id,
    }))).toEqual([
      {
        body: 'Camp photo\n\n![[img:photo-1|Camp]]',
        featuredImageId: 'photo-1',
        id: 'note-1',
        imageId: 'photo-1',
      },
      {
        body: 'Camp photo\n\n![[img:photo-other|Camp]]',
        featuredImageId: 'photo-other',
        id: 'note-other',
        imageId: 'photo-other',
      },
    ]);
    expect(new Uint8Array((await readFolderJournalImage(
        root.asHandle(), 'bfa.journal.image.photo-1',
    ))?.byteBuffer ?? new ArrayBuffer(0))).toEqual(Uint8Array.from([1, 2, 3]));
    expect(new Uint8Array((await readFolderJournalImage(
        root.asHandle(), 'bfa.journal.image.photo-other',
    ))?.byteBuffer ?? new ArrayBuffer(0))).toEqual(Uint8Array.from([8, 9, 10]));
  });

  it('lets the newer browser note keep the shared photo id', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const folder = {
      ...sessionNote(),
      body: 'Folder\n\n![[img:photo-1|Camp]]',
    };
    const browser = {
      ...folder,
      body: 'Browser\n\n![[img:photo-1|Camp]]',
      updatedAt: '2026-10-26T23:00:00.000Z',
    };
    await writeFolderJournalImage(
        root.asHandle(),
        folder.characterId,
        folder.images[0]?.blobKey ?? '',
        Uint8Array.from([1, 2, 3]),
        'image/png',
    );
    await writeFolderNotes(root.asHandle(), folder.characterId, [folder]);
    const indexedDb = new IDBFactory();
    await putStoredCharacterArtBlob(
        browser.images[0]?.blobKey ?? '',
        new Blob([Uint8Array.from([8, 9, 10])], {type: 'image/png'}),
        indexedDb,
    );
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(browser.characterId)] = [browser];
    const ids = ['photo-folder', 'note-browser-copy'];

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {
          [`${browser.characterId}\u0000image\u0000photo-1`]: 'both',
          [`${browser.characterId}\u0000note\u0000note-1`]: 'both',
        },
        {factory: indexedDb, storageArea: storage as never},
        () => ids.shift() ?? 'unexpected',
        () => '2026-10-26T23:30:00.000Z',
    );

    expect(result).toEqual({characters: 1, kind: 'complete', notes: 1, photos: 1});
    expect((await readFolderNotes(root.asHandle(), browser.characterId)).map((note) => ({
      body: note.body,
      id: note.id,
      imageId: note.images[0]?.id,
    }))).toEqual([
      {
        body: 'Folder\n\n![[img:photo-folder|Camp]]',
        id: 'note-1',
        imageId: 'photo-folder',
      },
      {
        body: 'Browser\n\n![[img:photo-1|Camp]]',
        id: 'note-browser-copy',
        imageId: 'photo-1',
      },
    ]);
    expect(new Uint8Array((await readFolderJournalImage(
        root.asHandle(), 'bfa.journal.image.photo-1',
    ))?.byteBuffer ?? new ArrayBuffer(0))).toEqual(Uint8Array.from([8, 9, 10]));
    expect(new Uint8Array((await readFolderJournalImage(
        root.asHandle(), 'bfa.journal.image.photo-folder',
    ))?.byteBuffer ?? new ArrayBuffer(0))).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it('restores a tombstoned note and photo only after both choices are explicit', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const browser = sessionNote();
    const browserBytes = Uint8Array.from([7, 8, 9]);
    await writeFolderJournalImage(
        root.asHandle(),
        browser.characterId,
        browser.images[0]?.blobKey ?? '',
        Uint8Array.from([1, 2, 3]),
        'image/png',
    );
    await writeFolderNotes(root.asHandle(), browser.characterId, [browser]);
    await writeFolderNotes(root.asHandle(), browser.characterId, []);
    const indexedDb = new IDBFactory();
    await putStoredCharacterArtBlob(
        browser.images[0]?.blobKey ?? '',
        new Blob([browserBytes], {type: 'image/png'}),
        indexedDb,
    );
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(browser.characterId)] = [browser];

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {
          [`${browser.characterId}\u0000image\u0000photo-1`]: 'restore',
          [`${browser.characterId}\u0000note\u0000note-1`]: 'restore',
        },
        {factory: indexedDb, storageArea: storage as never},
    );

    expect(result).toEqual({characters: 1, kind: 'complete', notes: 0});
    expect((await readFolderNotes(root.asHandle(), browser.characterId)).map(({id}) => id))
        .toEqual(['note-1']);
    expect((await readCommit(root.asHandle(), browser.characterId))?.tombstones).toEqual([]);
    expect(new Uint8Array((await readFolderJournalImage(
        root.asHandle(), 'bfa.journal.image.photo-1',
    ))?.byteBuffer ?? new ArrayBuffer(0))).toEqual(browserBytes);
  });

  it('keeps the chosen browser note and only then removes browser records', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const folder = imageLessNote('Folder body');
    const browser = {...imageLessNote('Browser body'), updatedAt: '2026-10-23T21:00:00.000Z'};
    await writeFolderNotes(root.asHandle(), folder.characterId, [folder]);
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(browser.characterId)] = [browser];

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {[`${browser.characterId}\u0000note\u0000${browser.id}`]: 'browser'},
        {storageArea: storage as never},
    );

    expect(result).toEqual({characters: 1, kind: 'complete', notes: 1});
    expect((await readFolderNotes(root.asHandle(), browser.characterId))[0]?.body)
        .toBe('Browser body');
    expect(storage.values[getCharacterJournalEntriesKey(browser.characterId)]).toBeUndefined();
    expect(storage.values[LIBRARY_MODE_KEY]).toBe('folder');
  });

  it('keeps both note versions under distinct ids', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const folder = imageLessNote('Folder body');
    const browser = {...imageLessNote('Browser body'), updatedAt: '2026-10-23T21:00:00.000Z'};
    await writeFolderNotes(root.asHandle(), folder.characterId, [folder]);
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(browser.characterId)] = [browser];

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {[`${browser.characterId}\u0000note\u0000${browser.id}`]: 'both'},
        {storageArea: storage as never},
        () => 'note-other',
        () => '2026-10-23T22:00:00.000Z',
    );

    expect(result.kind).toBe('complete');
    expect((await readFolderNotes(root.asHandle(), browser.characterId)).map((note) => ({
      body: note.body,
      id: note.id,
      title: note.title,
    }))).toEqual([
      {body: 'Folder body', id: 'note-1', title: 'Session'},
      {body: 'Browser body', id: 'note-other', title: 'Session (other computer)'},
    ]);
  });

  it('does not write when a note conflict has no choice', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const folder = imageLessNote('Folder body');
    const browser = imageLessNote('Browser body');
    await writeFolderNotes(root.asHandle(), folder.characterId, [folder]);
    const storage = createFakeStorageArea();
    storage.values[getCharacterJournalEntriesKey(browser.characterId)] = [browser];

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {},
        {storageArea: storage as never},
    );

    expect(result).toEqual({
      kind: 'failed',
      message: 'Choose what to keep for every conflict.',
    });
    expect((await readFolderNotes(root.asHandle(), folder.characterId))[0]?.body).toBe('Folder body');
    expect(storage.values[getCharacterJournalEntriesKey(browser.characterId)]).toEqual([browser]);
  });
});

describe('folder art conflict resolution', () => {
  it('uses browser full art while preserving the folder bytes as a checked spare', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const characterId = '172153137';
    const folderBytes = Uint8Array.from([1, 2]);
    const browserBytes = Uint8Array.from([8, 9]);
    await saveFolderFullArt(
        root.asHandle(),
        {...artMetadata(characterId), blobKey: 'folder-art'},
        folderBytes,
    );
    const indexedDb = new IDBFactory();
    await putStoredCharacterArtBlob(
        'browser-art', new Blob([browserBytes], {type: 'image/png'}), indexedDb,
    );
    const storage = createFakeStorageArea();
    storage.values[getCharacterArtMetadataKey(characterId)] = {
      ...artMetadata(characterId),
      blobKey: 'browser-art',
    };

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {[`${characterId}\u0000full-art\u0000full-art`]: 'browser'},
        {factory: indexedDb, storageArea: storage as never},
        () => 'unused',
        () => '2026-10-26T15:16:17.000Z',
    );

    expect(result).toEqual({characters: 1, kind: 'complete', notes: 0});
    expect(await readFolderArtBytes(root.asHandle(), characterId)).toEqual(browserBytes);
    const commit = await readCommit(root.asHandle(), characterId);
    expect(commit?.kept).toEqual([
      expect.objectContaining({
        fileName: 'full-art-kept-20261026T151617Z.png',
        kind: 'full-art',
      }),
    ]);
    expect(root.find(['characters', characterId]).files.get(commit?.kept[0]?.fileName ?? ''))
        .toEqual(folderBytes);
    expect(storage.values[getCharacterArtMetadataKey(characterId)]).toBeUndefined();
    expect(storage.values[LIBRARY_MODE_KEY]).toBe('folder');
  });

  it('uses a browser crop while preserving the folder crop beside it', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const characterId = '172153137';
    const artBytes = Uint8Array.from([5, 5]);
    const folderCropBytes = Uint8Array.from([1, 2]);
    const browserCropBytes = Uint8Array.from([8, 9]);
    const folderArt = {...artMetadata(characterId), blobKey: 'folder-art'};
    await saveFolderFullArt(root.asHandle(), folderArt, artBytes);
    await saveFolderCrop(
        root.asHandle(),
        cropMetadata(characterId, 'folder-crop', 'folder-art'),
        folderCropBytes,
    );
    const indexedDb = new IDBFactory();
    await putStoredCharacterArtBlob('browser-art', new Blob([artBytes]), indexedDb);
    await putStoredCharacterArtBlob('browser-crop', new Blob([browserCropBytes]), indexedDb);
    const storage = createFakeStorageArea();
    storage.values[getCharacterArtMetadataKey(characterId)] = {
      ...artMetadata(characterId),
      blobKey: 'browser-art',
    };
    storage.values[getCharacterPortraitCropMetadataKey(characterId)] = cropMetadata(
        characterId, 'browser-crop', 'browser-art',
    );

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {[`${characterId}\u0000crop\u0000crop`]: 'browser'},
        {factory: indexedDb, storageArea: storage as never},
        () => 'unused',
        () => '2026-10-26T16:17:18.000Z',
    );

    expect(result.kind).toBe('complete');
    expect(await readFolderCropBytes(root.asHandle(), characterId)).toEqual(browserCropBytes);
    const commit = await readCommit(root.asHandle(), characterId);
    expect(commit?.crop?.metadata.sourceArtBlobKey).toBe('folder-art');
    expect(commit?.kept).toEqual([
      expect.objectContaining({
        fileName: 'portrait-crop-kept-20261026T161718Z.png',
        kind: 'crop',
      }),
    ]);
    expect(root.find(['characters', characterId]).files.get(commit?.kept[0]?.fileName ?? ''))
        .toEqual(folderCropBytes);
  });

  it('restores browser art only after an explicit tombstone choice', async () => {
    const root = preparedFolder();
    markFolderReady(root);
    const characterId = '172153137';
    await saveFolderFullArt(
        root.asHandle(), artMetadata(characterId), Uint8Array.from([1, 2]),
    );
    await deleteFolderArt(root.asHandle(), characterId);
    const indexedDb = new IDBFactory();
    const browserBytes = Uint8Array.from([8, 9]);
    await putStoredCharacterArtBlob('blob-art', new Blob([browserBytes]), indexedDb);
    const storage = createFakeStorageArea();
    storage.values[getCharacterArtMetadataKey(characterId)] = artMetadata(characterId);

    const result = await resolveFolderNoteConflicts(
        root.asHandle(),
        {[`${characterId}\u0000full-art\u0000full-art`]: 'restore'},
        {factory: indexedDb, storageArea: storage as never},
    );

    expect(result).toEqual({characters: 1, kind: 'complete', notes: 0});
    expect(await readFolderArtBytes(root.asHandle(), characterId)).toEqual(browserBytes);
    expect((await readCommit(root.asHandle(), characterId))?.tombstones)
        .not.toEqual(expect.arrayContaining([expect.objectContaining({kind: 'full-art'})]));
  });
});

class MemoryDirectory {
  readonly kind = 'directory' as const;
  readonly directories = new Map<string, MemoryDirectory>();
  readonly files = new Map<string, Uint8Array<ArrayBuffer>>();

  constructor(
      readonly name: string,
      readonly openedFiles: Set<string> = new Set(),
  ) {}

  asHandle(): FileSystemDirectoryHandle {
    return this as unknown as FileSystemDirectoryHandle;
  }

  find(names: readonly string[]): MemoryDirectory {
    let current: MemoryDirectory = this;
    for (const name of names) {
      const next = current.directories.get(name);
      if (next === undefined) {
        throw new Error(`Missing directory ${name}`);
      }
      current = next;
    }
    return current;
  }

  async *entries(): AsyncGenerator<[string, FileSystemHandle]> {
    for (const [name, directory] of this.directories) {
      yield [name, directory.asHandle()];
    }
    for (const name of this.files.keys()) {
      yield [name, {kind: 'file'} as FileSystemHandle];
    }
  }

  async getDirectoryHandle(
      name: string,
      options?: {create?: boolean},
  ): Promise<FileSystemDirectoryHandle> {
    const existing = this.directories.get(name);
    if (existing !== undefined) {
      return existing.asHandle();
    }
    if (options?.create !== true) {
      throw new DOMException('Missing directory', 'NotFoundError');
    }
    const created = new MemoryDirectory(name, this.openedFiles);
    this.directories.set(name, created);
    return created.asHandle();
  }

  async getFileHandle(
      name: string,
      options?: {create?: boolean},
  ): Promise<FileSystemFileHandle> {
    if (options?.create !== true) {
      this.openedFiles.add(name);
    }
    if (!this.files.has(name)) {
      if (options?.create !== true) {
        throw new DOMException('Missing file', 'NotFoundError');
      }
      this.files.set(name, new Uint8Array());
    }
    const directory = this;
    return {
      async getFile() {
        return new File([directory.files.get(name) ?? new Uint8Array()], name);
      },
      async createWritable() {
        let next: Uint8Array<ArrayBuffer> = new Uint8Array();
        return {
          async close() {
            directory.files.set(name, next);
          },
          async write(data: ArrayBuffer | string | Uint8Array) {
            next = toBytes(data);
          },
        } as unknown as FileSystemWritableFileStream;
      },
    } as unknown as FileSystemFileHandle;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.directories.delete(name)) {
      throw new DOMException('Missing entry', 'NotFoundError');
    }
  }
}

function preparedFolder(): MemoryDirectory {
  const root = new MemoryDirectory('Beyond-Full-Art');
  root.directories.set('characters', new MemoryDirectory('characters', root.openedFiles));
  return root;
}

function syncRecord(id: string, fingerprint: string): LibrarySyncRecord {
  return {
    characterId: '172153137',
    fingerprint,
    id,
    kind: 'note',
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

function folderSnapshot(records: LibrarySyncRecord[]): FolderLibrarySnapshot {
  return {records, siblings: [], tombstones: []};
}

function sessionNote(): JournalNote {
  return {
    body: 'Met Voss.',
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
      mimeType: 'image/png',
      width: null,
    }],
    needsDetails: false,
    questStatus: null,
    schemaVersion: 2,
    sessionDate: null,
    title: 'Session',
    type: 'session',
    updatedAt: '2026-10-23T00:00:00.000Z',
  };
}

function artMetadata(characterId: string) {
  return {
    blobKey: 'blob-art',
    byteSize: 2,
    characterId,
    createdAt: '2026-10-23T17:00:00.000Z',
    fileName: 'portrait.png',
    height: 32,
    mimeType: 'image/png' as const,
    schemaVersion: 1 as const,
    updatedAt: '2026-10-23T17:00:00.000Z',
    width: 32,
  };
}

function cropMetadata(characterId: string, blobKey: string, sourceArtBlobKey: string) {
  return {
    blobKey,
    byteSize: 2,
    characterId,
    createdAt: '2026-10-26T00:00:00.000Z',
    cropRect: {height: 16, width: 16, x: 0, y: 0},
    fileName: 'portrait-crop.png',
    height: 512,
    mimeType: 'image/png' as const,
    schemaVersion: 1 as const,
    sourceArtBlobKey,
    updatedAt: '2026-10-26T00:00:00.000Z',
    width: 512,
  };
}

function imageLessNote(body: string): JournalNote {
  return {...sessionNote(), body, featuredImageId: null, images: []};
}

function markFolderReady(root: MemoryDirectory): void {
  root.files.set('beyond-full-art.json', new TextEncoder().encode(`${JSON.stringify({
    createdAt: '2026-10-23T00:00:00.000Z',
    format: 'beyond-full-art-folder',
    schemaVersion: 2,
  }, null, 2)}\n`));
}

function toBytes(data: ArrayBuffer | string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  if (data instanceof Uint8Array) {
    return Uint8Array.from(data);
  }
  return new Uint8Array(data.slice(0));
}

function createFakeStorageArea() {
  const values: Record<string, unknown> = {};
  return {
    values,
    get(key: string | null, callback: (value: Record<string, unknown>) => void) {
      if (key === null) {
        callback({...values});
        return;
      }
      callback({[key]: values[key]});
    },
    remove(key: string, callback: () => void) {
      delete values[key];
      callback();
    },
    set(nextValues: Record<string, unknown>, callback: () => void) {
      Object.assign(values, nextValues);
      callback();
    },
  };
}
