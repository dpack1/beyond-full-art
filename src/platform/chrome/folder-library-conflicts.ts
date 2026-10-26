import {remapJournalNoteImages} from '../../features/character-journal/journal-image-remap';
import type {JournalNote} from '../../features/character-journal/character-journal-types';
import {
  loadBrowserLibraryCharacters,
  type BrowserLibraryCharacter,
  type CopyBrowserLibrarySources,
} from './backup-folder-copy';
import {adoptResolvedFolderLibrary} from './folder-library-adopt';
import {
  keepFolderArtVersion,
  readFolderArtBytes,
  readFolderArtMetadata,
  readFolderCropBytes,
  readFolderCropMetadata,
  readFolderNotes,
  restoreFolderNote,
  saveFolderCrop,
  saveFolderFullArt,
  writeFolderJournalImage,
  writeFolderNotes,
} from './folder-library';
import type {
  LibraryAddition,
  LibrarySyncConflict,
} from './folder-library-compare';
import {
  preparePhotoConflictPlan,
  restoreDeletedImages,
  writePhotoConflictPlan,
} from './folder-library-photo-conflicts';
import {compareBrowserLibraryToFolder} from './folder-library-snapshot';

export type ConflictChoice = 'both' | 'browser' | 'deleted' | 'folder' | 'restore';
export type NoteConflictChoice = ConflictChoice;

export type ResolveFolderConflictsResult =
  | {characters: number; kind: 'complete'; notes: number; photos?: number}
  | {kind: 'failed'; message: string};

export function conflictChoiceKey(conflict: LibrarySyncConflict): string {
  return `${conflict.browser.characterId}\u0000${conflict.browser.kind}\u0000${conflict.browser.id}`;
}

export function conflictChoices(
    conflict: LibrarySyncConflict,
): readonly ConflictChoice[] {
  if (conflict.reason === 'deleted-in-folder') {
    return ['deleted', 'restore'];
  }
  if (conflict.browser.kind === 'image') {
    return ['both'];
  }
  return conflict.browser.kind === 'note'
    ? ['folder', 'browser', 'both']
    : ['folder', 'browser'];
}

export function noteConflictChoices(
    conflict: LibrarySyncConflict,
): readonly NoteConflictChoice[] {
  return conflict.browser.kind === 'note' ? conflictChoices(conflict) : [];
}

export async function resolveFolderConflicts(
    directory: FileSystemDirectoryHandle,
    choices: Readonly<Record<string, ConflictChoice>>,
    sources: CopyBrowserLibrarySources = {},
    createId: () => string = () => crypto.randomUUID(),
    now: () => string = () => new Date().toISOString(),
): Promise<ResolveFolderConflictsResult> {
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
  const comparison = await compareBrowserLibraryToFolder(directory, sources);
  if (comparison.kind !== 'conflicts') {
    return {kind: 'failed', message: 'The folder no longer has the conflicts shown.'};
  }
  for (const conflict of comparison.conflicts) {
    const choice = choices[conflictChoiceKey(conflict)];
    if (choice === undefined || !conflictChoices(conflict).includes(choice)) {
      return {kind: 'failed', message: 'Choose what to keep for every conflict.'};
    }
  }
  const invalidPair = findInvalidArtPair(comparison.conflicts, choices);
  if (invalidPair !== null) {
    return {kind: 'failed', message: invalidPair};
  }
  const invalidRestore = findInvalidRestorePair(
      comparison.conflicts,
      choices,
      new Map(characters.map((character) => [character.characterId, character])),
  );
  if (invalidRestore !== null) {
    return {kind: 'failed', message: invalidRestore};
  }

  const charactersById = new Map(characters.map((character) => [character.characterId, character]));
  try {
    const photoPlan = await preparePhotoConflictPlan(
        directory,
        comparison.conflicts,
        choices,
        charactersById,
        createId,
    );
    const folderVersions = await readFolderArtVersions(directory, comparison.conflicts);
    await writeNonNoteAdditions(
        directory, comparison.additions, charactersById, now, 'full-art',
    );
    await resolveArtConflicts(
        directory, comparison.conflicts, choices, charactersById, folderVersions, now, 'full-art',
    );
    await writeNonNoteAdditions(directory, comparison.additions, charactersById, now, 'crop');
    await resolveArtConflicts(
        directory, comparison.conflicts, choices, charactersById, folderVersions, now, 'crop',
    );
    await writeNonNoteAdditions(directory, comparison.additions, charactersById, now, 'image');
    await restoreDeletedImages(
        directory, comparison.conflicts, choices, charactersById, now,
    );
    await writePhotoConflictPlan(directory, photoPlan, now);
    for (const conflict of comparison.conflicts) {
      if (conflict.browser.kind !== 'note'
        || conflict.reason !== 'deleted-in-folder'
        || choices[conflictChoiceKey(conflict)] !== 'restore') {
        continue;
      }
      const note = findBrowserNote(charactersById, conflict);
      await restoreFolderNote(directory, note, now());
    }

    const affected = new Set([
      ...comparison.conflicts
          .filter((conflict) => conflict.browser.kind === 'note'
            || conflict.browser.kind === 'image')
          .map((conflict) => conflict.browser.characterId),
      ...comparison.additions
          .filter((addition) => addition.side === 'browser' && addition.record.kind === 'note')
          .map((addition) => addition.record.characterId),
    ]);
    let writtenNotes = 0;
    for (const characterId of affected) {
      const character = charactersById.get(characterId);
      if (character === undefined) {
        throw new Error(`Character ${characterId} is missing from this browser.`);
      }
      let next = (await readFolderNotes(directory, characterId)).map(
          (note) => remapJournalNoteImages(note, photoPlan.folderRemaps.get(characterId) ?? EMPTY_REMAP),
      );
      for (const conflict of comparison.conflicts.filter(
          (candidate) => candidate.browser.characterId === characterId
            && candidate.browser.kind === 'note',
      )) {
        const choice = choices[conflictChoiceKey(conflict)];
        if (conflict.reason === 'deleted-in-folder') {
          continue;
        }
        const browserNote = remapJournalNoteImages(
            findBrowserNote(charactersById, conflict),
            photoPlan.browserRemaps.get(characterId) ?? EMPTY_REMAP,
        );
        if (choice === 'browser') {
          next = replaceNote(next, browserNote);
          writtenNotes += 1;
        } else if (choice === 'both') {
          next.push({
            ...browserNote,
            id: createId(),
            title: `${browserNote.title} (other computer)`,
            updatedAt: now(),
          });
          writtenNotes += 1;
        }
      }
      for (const addition of comparison.additions.filter((candidate) => (
        candidate.side === 'browser'
        && candidate.record.kind === 'note'
        && candidate.record.characterId === characterId
      ))) {
        const stored = character.notes.find((candidate) => candidate.id === addition.record.id);
        const note = stored === undefined
          ? undefined
          : remapJournalNoteImages(
              stored,
              photoPlan.browserRemaps.get(characterId) ?? EMPTY_REMAP,
          );
        if (note !== undefined && !next.some((candidate) => candidate.id === note.id)) {
          next.push(note);
          writtenNotes += 1;
        }
      }
      for (const pair of photoPlan.implicitBoth.filter(
          (candidate) => candidate.characterId === characterId,
      )) {
        if (pair.winner === 'browser') {
          next = replaceNote(next, pair.browserNote);
          next.push(copyNote(pair.folderNote, createId(), now()));
        } else {
          next.push(copyNote(pair.browserNote, createId(), now()));
        }
        writtenNotes += 1;
      }
      await writeFolderNotes(directory, characterId, next, now());
    }
    const adopted = await adoptResolvedFolderLibrary(directory, sources);
    if (adopted.kind === 'mismatch' || adopted.kind === 'unavailable') {
      return {kind: 'failed', message: adopted.message};
    }
    return {
      characters: adopted.characters,
      kind: 'complete',
      notes: writtenNotes,
      ...(photoPlan.remapped === 0 ? {} : {photos: photoPlan.remapped}),
    };
  } catch (error) {
    return {
      kind: 'failed',
      message: error instanceof Error && error.message.trim() !== ''
        ? error.message
        : 'The conflict choices could not be applied.',
    };
  }
}

// Kept as a compatibility name for the setup and tests that predate art/photo choices.
export const resolveFolderNoteConflicts = resolveFolderConflicts;

const EMPTY_REMAP = new Map<string, string>();

function copyNote(note: JournalNote, id: string, updatedAt: string): JournalNote {
  return {
    ...note,
    id,
    title: `${note.title} (other computer)`,
    updatedAt,
  };
}

async function writeNonNoteAdditions(
    directory: FileSystemDirectoryHandle,
    additions: readonly LibraryAddition[],
    characters: ReadonlyMap<string, BrowserLibraryCharacter>,
    now: () => string,
    kind: 'crop' | 'full-art' | 'image',
): Promise<void> {
  for (const addition of additions) {
    if (addition.side !== 'browser' || addition.record.kind !== kind) {
      continue;
    }
    const character = characters.get(addition.record.characterId);
    if (character === undefined) {
      throw new Error(`Character ${addition.record.characterId} is missing from this browser.`);
    }
    if (addition.record.kind === 'full-art' && character.art !== null) {
      await saveFolderFullArt(directory, character.art.metadata, character.art.bytes, now());
    } else if (addition.record.kind === 'crop' && character.crop !== null) {
      await saveFolderCrop(directory, character.crop.metadata, character.crop.bytes, now());
    } else if (addition.record.kind === 'image') {
      const image = character.images.find((candidate) => candidate.image.id === addition.record.id);
      if (image !== undefined) {
        await writeFolderJournalImage(
            directory,
            character.characterId,
            image.image.blobKey,
            image.bytes,
            image.image.mimeType,
            now(),
        );
      }
    }
  }
}

interface FolderArtVersion {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface FolderArtVersions {
  crop: Map<string, FolderArtVersion>;
  fullArt: Map<string, FolderArtVersion>;
}

async function readFolderArtVersions(
    directory: FileSystemDirectoryHandle,
    conflicts: readonly LibrarySyncConflict[],
): Promise<FolderArtVersions> {
  const versions: FolderArtVersions = {crop: new Map(), fullArt: new Map()};
  const characterIds = new Set(
      conflicts
          .filter((conflict) => conflict.browser.kind === 'crop'
            || conflict.browser.kind === 'full-art')
          .map((conflict) => conflict.browser.characterId),
  );
  for (const characterId of characterIds) {
    const [artMetadata, artBytes, cropMetadata, cropBytes] = await Promise.all([
      readFolderArtMetadata(directory, characterId),
      readFolderArtBytes(directory, characterId),
      readFolderCropMetadata(directory, characterId),
      readFolderCropBytes(directory, characterId),
    ]);
    if (artMetadata !== null && artBytes !== null) {
      versions.fullArt.set(characterId, {bytes: artBytes, mimeType: artMetadata.mimeType});
    }
    if (cropMetadata !== null && cropBytes !== null) {
      versions.crop.set(characterId, {bytes: cropBytes, mimeType: cropMetadata.mimeType});
    }
  }
  return versions;
}

async function resolveArtConflicts(
    directory: FileSystemDirectoryHandle,
    conflicts: readonly LibrarySyncConflict[],
    choices: Readonly<Record<string, ConflictChoice>>,
    characters: ReadonlyMap<string, BrowserLibraryCharacter>,
    folderVersions: FolderArtVersions,
    now: () => string,
    kind: 'crop' | 'full-art',
): Promise<void> {
  for (const conflict of conflicts.filter((candidate) => candidate.browser.kind === kind)) {
    const character = characters.get(conflict.browser.characterId);
    if (character === undefined) {
      throw new Error(`Character ${conflict.browser.characterId} is missing from this browser.`);
    }
    const local = kind === 'full-art' ? character.art : character.crop;
    if (local === null) {
      throw new Error(`The browser ${kind === 'full-art' ? 'full art' : 'crop'} is missing.`);
    }
    const choice = choices[conflictChoiceKey(conflict)];
    if (choice === 'deleted') {
      continue;
    }
    if (choice === 'folder') {
      await keepFolderArtVersion(
          directory,
          character.characterId,
          kind,
          local.bytes,
          local.metadata.mimeType,
          now(),
      );
      continue;
    }
    if (choice === 'browser') {
      const folder = kind === 'full-art'
        ? folderVersions.fullArt.get(character.characterId)
        : folderVersions.crop.get(character.characterId);
      if (folder === undefined) {
        throw new Error(`The folder ${kind === 'full-art' ? 'full art' : 'crop'} changed before it could be kept.`);
      }
      await keepFolderArtVersion(
          directory, character.characterId, kind, folder.bytes, folder.mimeType, now(),
      );
    }
    if (kind === 'full-art') {
      if (character.art === null) {
        throw new Error('The browser full art is missing.');
      }
      await preserveUnresolvedFolderCrop(
          directory, character.characterId, conflicts, folderVersions, now,
      );
      await saveFolderFullArt(directory, character.art.metadata, character.art.bytes, now());
    } else {
      if (character.crop === null) {
        throw new Error('The browser crop is missing.');
      }
      const currentArt = await readFolderArtMetadata(directory, character.characterId);
      if (currentArt === null) {
        throw new Error('Stored full art is required before restoring a portrait crop.');
      }
      await saveFolderCrop(
          directory,
          {...character.crop.metadata, sourceArtBlobKey: currentArt.blobKey},
          character.crop.bytes,
          now(),
      );
    }
  }
}

async function preserveUnresolvedFolderCrop(
    directory: FileSystemDirectoryHandle,
    characterId: string,
    conflicts: readonly LibrarySyncConflict[],
    folderVersions: FolderArtVersions,
    now: () => string,
): Promise<void> {
  const hasCropConflict = conflicts.some((conflict) => (
    conflict.browser.characterId === characterId && conflict.browser.kind === 'crop'
  ));
  const crop = folderVersions.crop.get(characterId);
  if (!hasCropConflict && crop !== undefined) {
    await keepFolderArtVersion(
        directory, characterId, 'crop', crop.bytes, crop.mimeType, now(),
    );
  }
}

function findInvalidArtPair(
    conflicts: readonly LibrarySyncConflict[],
    choices: Readonly<Record<string, ConflictChoice>>,
): string | null {
  const byCharacter = new Map<string, LibrarySyncConflict[]>();
  for (const conflict of conflicts.filter((candidate) => (
    candidate.browser.kind === 'full-art' || candidate.browser.kind === 'crop'
  ))) {
    const current = byCharacter.get(conflict.browser.characterId) ?? [];
    current.push(conflict);
    byCharacter.set(conflict.browser.characterId, current);
  }
  for (const characterConflicts of byCharacter.values()) {
    const art = characterConflicts.find((conflict) => conflict.browser.kind === 'full-art');
    const crop = characterConflicts.find((conflict) => conflict.browser.kind === 'crop');
    if (art === undefined || crop === undefined) {
      continue;
    }
    const artChoice = choices[conflictChoiceKey(art)];
    const cropChoice = choices[conflictChoiceKey(crop)];
    if (artChoice !== cropChoice) {
      return 'Full art and its portrait crop must use the same side.';
    }
  }
  return null;
}

function findInvalidRestorePair(
    conflicts: readonly LibrarySyncConflict[],
    choices: Readonly<Record<string, ConflictChoice>>,
    characters: ReadonlyMap<string, BrowserLibraryCharacter>,
): string | null {
  const imageConflicts = new Map(
      conflicts
          .filter((conflict) => conflict.browser.kind === 'image')
          .map((conflict) => [
            `${conflict.browser.characterId}\u0000${conflict.browser.id}`,
            conflict,
          ]),
  );
  for (const conflict of conflicts) {
    if (conflict.browser.kind !== 'note'
      || conflict.reason !== 'deleted-in-folder'
      || choices[conflictChoiceKey(conflict)] !== 'restore') {
      continue;
    }
    const note = characters.get(conflict.browser.characterId)?.notes.find(
        (candidate) => candidate.id === conflict.browser.id,
    );
    if (note === undefined) {
      continue;
    }
    for (const image of note.images) {
      const imageConflict = imageConflicts.get(`${note.characterId}\u0000${image.id}`);
      if (imageConflict !== undefined
        && choices[conflictChoiceKey(imageConflict)] !== 'restore') {
        return 'Restore every photo in a restored note, or leave the note deleted.';
      }
    }
  }
  return null;
}

function findBrowserNote(
    characters: ReadonlyMap<string, BrowserLibraryCharacter>,
    conflict: LibrarySyncConflict,
): JournalNote {
  const note = characters.get(conflict.browser.characterId)?.notes.find(
      (candidate) => candidate.id === conflict.browser.id,
  );
  if (note === undefined) {
    throw new Error('The browser note for this conflict could not be found.');
  }
  return note;
}

function replaceNote(notes: readonly JournalNote[], replacement: JournalNote): JournalNote[] {
  return notes.map((note) => note.id === replacement.id ? replacement : note);
}
