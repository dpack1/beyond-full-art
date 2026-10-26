import type {JournalNote} from '../../features/character-journal/character-journal-types';
import {BACKUP_FOLDER_CHARACTERS_DIRECTORY} from './backup-folder';
import {
  loadBrowserLibraryCharacters,
  type BrowserLibraryCharacter,
  type CopyBrowserLibrarySources,
} from './backup-folder-copy';
import {
  compareLibrarySnapshots,
  journalNoteFingerprint,
  type DriveConflictSibling,
  type FolderLibrarySnapshot,
  type LibraryComparison,
  type LibrarySyncRecord,
  type LibrarySyncTombstone,
} from './folder-library-compare';
import {
  readCommit,
  readFolderNotes,
  type FolderCommit,
} from './folder-library';

export async function compareBrowserLibraryToFolder(
    directory: FileSystemDirectoryHandle,
    sources: CopyBrowserLibrarySources = {},
): Promise<LibraryComparison> {
  const characters = await loadBrowserLibraryCharacters(sources);
  const problem = characters.find((character) => character.problem !== null)?.problem;
  if (problem != null) {
    throw new Error(problem);
  }
  const [browserRecords, folder] = await Promise.all([
    browserLibraryRecords(characters),
    readFolderLibrarySnapshot(directory),
  ]);
  return compareLibrarySnapshots(browserRecords, folder);
}

export async function browserLibraryRecords(
    characters: readonly BrowserLibraryCharacter[],
): Promise<LibrarySyncRecord[]> {
  const records: LibrarySyncRecord[] = [];
  for (const character of characters) {
    if (character.art !== null) {
      records.push({
        characterId: character.characterId,
        fingerprint: await sha256Hex(character.art.bytes),
        id: 'full-art',
        kind: 'full-art',
        updatedAt: character.art.metadata.updatedAt,
      });
    }
    if (character.crop !== null) {
      records.push({
        characterId: character.characterId,
        fingerprint: await sha256Hex(character.crop.bytes),
        id: 'crop',
        kind: 'crop',
        updatedAt: character.crop.metadata.updatedAt,
      });
    }
    for (const note of character.notes) {
      records.push(noteRecord(note));
    }
    for (const image of character.images) {
      const owner = character.notes.find((note) => (
        note.images.some((candidate) => candidate.id === image.image.id)
      ));
      records.push({
        characterId: character.characterId,
        fingerprint: await sha256Hex(image.bytes),
        id: image.image.id,
        kind: 'image',
        updatedAt: owner?.updatedAt ?? null,
      });
    }
  }
  return records;
}

export async function readFolderLibrarySnapshot(
    directory: FileSystemDirectoryHandle,
): Promise<FolderLibrarySnapshot> {
  const records: LibrarySyncRecord[] = [];
  const siblings: DriveConflictSibling[] = [];
  const tombstones: LibrarySyncTombstone[] = [];
  for (const characterId of await listCharacterIds(directory)) {
    const commit = await readCommit(directory, characterId);
    if (commit === null) {
      continue;
    }
    addFolderArtRecords(records, commit);
    const notes = await readFolderNotes(directory, characterId);
    for (const note of notes) {
      records.push(noteRecord(note));
    }
    const deletedImageIds = new Set(
        commit.tombstones
            .filter((entry) => entry.kind === 'image')
            .map((entry) => entry.id),
    );
    for (const image of commit.images) {
      if (!deletedImageIds.has(image.id)) {
        const owner = notes.find((note) => (
          note.images.some((candidate) => candidate.id === image.id)
        ));
        records.push({
          characterId,
          fingerprint: image.sha256,
          id: image.id,
          kind: 'image',
          updatedAt: owner?.updatedAt ?? null,
        });
      }
    }
    tombstones.push(...commit.tombstones.map((entry) => ({
      characterId,
      deletedAt: entry.deletedAt,
      id: entry.id,
      kind: entry.kind,
    })));
    siblings.push(...await listDriveConflictSiblings(directory, characterId, commit));
  }
  return {records, siblings, tombstones};
}

function addFolderArtRecords(records: LibrarySyncRecord[], commit: FolderCommit): void {
  const deleted = new Set(commit.tombstones.map((entry) => `${entry.kind}:${entry.id}`));
  if (commit.fullArt !== null && !deleted.has('full-art:full-art')) {
    records.push({
      characterId: commit.characterId,
      fingerprint: commit.fullArt.sha256,
      id: 'full-art',
      kind: 'full-art',
      updatedAt: commit.fullArt.metadata.updatedAt,
    });
  }
  if (commit.crop !== null && !deleted.has('crop:crop')) {
    records.push({
      characterId: commit.characterId,
      fingerprint: commit.crop.sha256,
      id: 'crop',
      kind: 'crop',
      updatedAt: commit.crop.metadata.updatedAt,
    });
  }
}

function noteRecord(note: JournalNote): LibrarySyncRecord {
  return {
    characterId: note.characterId,
    fingerprint: journalNoteFingerprint(note),
    id: note.id,
    kind: 'note',
    updatedAt: note.updatedAt,
  };
}

async function listDriveConflictSiblings(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    commit: FolderCommit,
): Promise<DriveConflictSibling[]> {
  const characterDirectory = await nestedDirectory(directory, [
    BACKUP_FOLDER_CHARACTERS_DIRECTORY,
    characterId,
  ]);
  if (characterDirectory === null) {
    return [];
  }
  const locations = [
    {directory: '', handle: characterDirectory, managed: [
      commit.fullArt?.fileName,
      commit.crop?.fileName,
    ].filter(isString)},
    {
      directory: 'journal/notes',
      handle: await nestedDirectory(characterDirectory, ['journal', 'notes']),
      managed: commit.notes.map((file) => file.fileName),
    },
    {
      directory: 'journal/images',
      handle: await nestedDirectory(characterDirectory, ['journal', 'images']),
      managed: commit.images.map((file) => file.fileName),
    },
  ];
  const siblings: DriveConflictSibling[] = [];
  for (const location of locations) {
    if (location.handle === null) {
      continue;
    }
    for await (const [fileName, handle] of directoryEntries(location.handle)) {
      if (handle.kind !== 'file' || location.managed.includes(fileName)) {
        continue;
      }
      const managedFileName = conflictSiblingOf(fileName, location.managed);
      if (managedFileName !== null) {
        siblings.push({characterId, directory: location.directory, fileName, managedFileName});
      }
    }
  }
  return siblings;
}

function conflictSiblingOf(candidate: string, managedNames: readonly string[]): string | null {
  const extensionAt = candidate.lastIndexOf('.');
  if (extensionAt <= 0) {
    return null;
  }
  const stem = candidate.slice(0, extensionAt);
  const extension = candidate.slice(extensionAt);
  for (const managed of managedNames) {
    const managedExtensionAt = managed.lastIndexOf('.');
    if (managedExtensionAt <= 0 || managed.slice(managedExtensionAt) !== extension) {
      continue;
    }
    const managedStem = managed.slice(0, managedExtensionAt);
    if (!stem.startsWith(managedStem)) {
      continue;
    }
    const suffix = stem.slice(managedStem.length);
    if (/ \(\d+\)$/.test(suffix) || /conflicted copy/i.test(suffix)) {
      return managed;
    }
  }
  return null;
}

async function listCharacterIds(directory: FileSystemDirectoryHandle): Promise<string[]> {
  let characters: FileSystemDirectoryHandle;
  try {
    characters = await directory.getDirectoryHandle(BACKUP_FOLDER_CHARACTERS_DIRECTORY);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for await (const [name, handle] of directoryEntries(characters)) {
    if (handle.kind !== 'directory') {
      continue;
    }
    try {
      await (handle as FileSystemDirectoryHandle).getFileHandle('character.json');
      ids.push(name);
    } catch {
      // An unfinished character directory is not part of the library snapshot.
    }
  }
  return ids;
}

async function nestedDirectory(
    directory: FileSystemDirectoryHandle,
    names: readonly string[],
): Promise<FileSystemDirectoryHandle | null> {
  let current = directory;
  for (const name of names) {
    try {
      current = await current.getDirectoryHandle(name);
    } catch {
      return null;
    }
  }
  return current;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string';
}

async function* directoryEntries(
    directory: FileSystemDirectoryHandle,
): AsyncGenerator<[string, FileSystemHandle]> {
  const entries = (directory as FileSystemDirectoryHandle & {
    entries(): AsyncIterable<[string, FileSystemHandle]>;
  }).entries();
  yield* entries;
}
