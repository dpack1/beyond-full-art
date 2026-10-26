import {
  loadBrowserLibraryCharacters,
  type BrowserLibraryCharacter,
  type CopyBrowserLibrarySources,
} from './backup-folder-copy';
import {adoptFolderLibrary} from './folder-library-adopt';
import {
  readFolderNotes,
  saveFolderCrop,
  saveFolderFullArt,
  writeFolderJournalImage,
  writeFolderNotes,
} from './folder-library';
import {
  compareLibrarySnapshots,
  type LibraryAddition,
} from './folder-library-compare';
import {
  browserLibraryRecords,
  readFolderLibrarySnapshot,
} from './folder-library-snapshot';

export type MergeBrowserAdditionsResult =
  | {additions: number; characters: number; kind: 'merged'; notes: number; photos: number}
  | {conflicts: number; kind: 'conflicts'}
  | {kind: 'failed'; message: string}
  | {kind: 'match'};

export type UnionFolderLibraryResult =
  | {additions: number; characters: number; kind: 'complete'; notes: number; photos: number}
  | {conflicts: number; kind: 'conflicts'}
  | {kind: 'failed'; message: string};

export async function unionBrowserLibraryIntoFolder(
    directory: FileSystemDirectoryHandle,
    sources: CopyBrowserLibrarySources = {},
    now: () => string = () => new Date().toISOString(),
): Promise<UnionFolderLibraryResult> {
  let characters: BrowserLibraryCharacter[];
  try {
    characters = await loadBrowserLibraryCharacters(sources);
  } catch {
    return {kind: 'failed', message: 'This browser’s saved files could not be read.'};
  }
  const problem = characters.find((character) => character.problem !== null)?.problem;
  if (problem != null) {
    return {kind: 'failed', message: problem};
  }
  const merged = await mergeBrowserAdditionsIntoFolder(directory, characters, now);
  if (merged.kind === 'conflicts' || merged.kind === 'failed') {
    return merged;
  }
  const adopted = await adoptFolderLibrary(directory, sources);
  if (adopted.kind === 'mismatch' || adopted.kind === 'unavailable') {
    return {kind: 'failed', message: adopted.message};
  }
  return merged.kind === 'match'
    ? {additions: 0, characters: adopted.characters, kind: 'complete', notes: 0, photos: 0}
    : {...merged, kind: 'complete'};
}

export async function mergeBrowserAdditionsIntoFolder(
    directory: FileSystemDirectoryHandle,
    characters: readonly BrowserLibraryCharacter[],
    now: () => string = () => new Date().toISOString(),
): Promise<MergeBrowserAdditionsResult> {
  const browserRecords = await browserLibraryRecords(characters);
  const before = compareLibrarySnapshots(
      browserRecords,
      await readFolderLibrarySnapshot(directory),
  );
  if (before.kind === 'conflicts') {
    return {conflicts: before.conflicts.length, kind: 'conflicts'};
  }
  if (before.kind === 'match') {
    return {kind: 'match'};
  }
  const additions = before.additions.filter((addition) => addition.side === 'browser');
  const additionKeys = new Set(additions.map(additionKey));
  let notes = 0;
  let photos = 0;
  const changedCharacters = new Set<string>();

  try {
    for (const character of characters) {
      const has = (kind: string, id: string): boolean => (
        additionKeys.has(recordKey(character.characterId, kind, id))
      );
      if (character.art !== null && has('full-art', 'full-art')) {
        await saveFolderFullArt(directory, character.art.metadata, character.art.bytes, now());
        changedCharacters.add(character.characterId);
      }
      if (character.crop !== null && has('crop', 'crop')) {
        await saveFolderCrop(directory, character.crop.metadata, character.crop.bytes, now());
        changedCharacters.add(character.characterId);
      }
      for (const image of character.images) {
        if (!has('image', image.image.id)) {
          continue;
        }
        await writeFolderJournalImage(
            directory,
            character.characterId,
            image.image.blobKey,
            image.bytes,
            image.image.mimeType,
            now(),
        );
        photos += 1;
        changedCharacters.add(character.characterId);
      }
      const addedNotes = character.notes.filter((note) => has('note', note.id));
      if (addedNotes.length > 0) {
        const folderNotes = await readFolderNotes(directory, character.characterId);
        await writeFolderNotes(
            directory,
            character.characterId,
            [...folderNotes, ...addedNotes],
            now(),
        );
        notes += addedNotes.length;
        changedCharacters.add(character.characterId);
      }
    }
  } catch (error) {
    return {
      kind: 'failed',
      message: error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'The additions could not be written to the folder.',
    };
  }

  const after = compareLibrarySnapshots(
      browserRecords,
      await readFolderLibrarySnapshot(directory),
  );
  if (after.kind !== 'match') {
    return {kind: 'failed', message: 'The added files did not match after they were written.'};
  }
  return {
    additions: additions.length,
    characters: changedCharacters.size,
    kind: 'merged',
    notes,
    photos,
  };
}

export function describeUnionResult(
    folderName: string,
    result: UnionFolderLibraryResult,
): string {
  switch (result.kind) {
    case 'complete':
      return `Added ${result.additions} ${result.additions === 1 ? 'record' : 'records'} to “${folderName}”. The files were checked, and this browser now uses the folder.`;
    case 'conflicts':
      return `“${folderName}” disagrees with this browser in ${result.conflicts} ${result.conflicts === 1 ? 'place' : 'places'}. Nothing was changed.`;
    case 'failed':
      return `${result.message} This browser’s copies were kept.`;
  }
}

function additionKey(addition: LibraryAddition): string {
  return recordKey(addition.record.characterId, addition.record.kind, addition.record.id);
}

function recordKey(characterId: string, kind: string, id: string): string {
  return `${characterId}\u0000${kind}\u0000${id}`;
}
