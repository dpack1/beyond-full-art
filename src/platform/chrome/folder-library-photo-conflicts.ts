import {remapJournalNoteImages} from '../../features/character-journal/journal-image-remap';
import type {
  JournalImage,
  JournalNote,
} from '../../features/character-journal/character-journal-types';
import type {BrowserLibraryCharacter} from './backup-folder-copy';
import {
  readFolderJournalImage,
  readFolderNotes,
  restoreFolderJournalImage,
  writeFolderJournalImage,
} from './folder-library';
import type {LibrarySyncConflict} from './folder-library-compare';

type ConflictChoice = 'both' | 'browser' | 'deleted' | 'folder' | 'restore';

interface PhotoWrite {
  bytes: Uint8Array;
  characterId: string;
  image: JournalImage;
}

export interface PhotoConflictPlan {
  browserRemaps: Map<string, Map<string, string>>;
  folderRemaps: Map<string, Map<string, string>>;
  implicitBoth: {
    browserNote: JournalNote;
    characterId: string;
    folderNote: JournalNote;
    winner: 'browser' | 'folder';
  }[];
  remapped: number;
  writes: PhotoWrite[];
}

export async function preparePhotoConflictPlan(
    directory: FileSystemDirectoryHandle,
    conflicts: readonly LibrarySyncConflict[],
    choices: Readonly<Record<string, ConflictChoice>>,
    characters: ReadonlyMap<string, BrowserLibraryCharacter>,
    createId: () => string,
): Promise<PhotoConflictPlan> {
  const changed = conflicts.filter((conflict) => (
    conflict.browser.kind === 'image' && conflict.reason === 'changed'
  ));
  const folderNotes = new Map<string, JournalNote[]>();
  const browserRemaps = new Map<string, Map<string, string>>();
  const folderRemaps = new Map<string, Map<string, string>>();
  const writes: PhotoWrite[] = [];
  const pairSeeds = new Map<string, {
    browserNote: JournalNote;
    characterId: string;
    folderNote: JournalNote;
    winner: 'browser' | 'folder';
  }>();

  for (const conflict of changed) {
    if (choices[choiceKey(conflict)] !== 'both') {
      throw new Error('Both photo versions must be kept.');
    }
    const character = characters.get(conflict.browser.characterId);
    const browserVersion = character?.images.find(
        (candidate) => candidate.image.id === conflict.browser.id,
    );
    if (character === undefined || browserVersion === undefined) {
      throw new Error('The browser photo for this conflict could not be found.');
    }
    let notes = folderNotes.get(character.characterId);
    if (notes === undefined) {
      notes = await readFolderNotes(directory, character.characterId);
      folderNotes.set(character.characterId, notes);
    }
    const browserNote = character.notes.find((note) => (
      note.images.some((image) => image.id === conflict.browser.id)
    ));
    const folderNote = notes.find((note) => (
      note.images.some((image) => image.id === conflict.browser.id)
    ));
    const folderImage = folderNote?.images.find((image) => image.id === conflict.browser.id);
    if (browserNote === undefined || folderNote === undefined || folderImage === undefined) {
      throw new Error('The note that owns a conflicting photo could not be found.');
    }
    const folderVersion = await readFolderJournalImage(directory, folderImage.blobKey);
    if (folderVersion === null) {
      throw new Error(`The folder photo “${folderImage.fileName}” could not be read.`);
    }
    const nextId = createId();
    const browserWins = browserNote.updatedAt > folderNote.updatedAt;
    if (browserWins) {
      addRemap(folderRemaps, character.characterId, conflict.browser.id, nextId);
      writes.push({
        bytes: new Uint8Array(folderVersion.byteBuffer),
        characterId: character.characterId,
        image: remappedImage(folderImage, nextId),
      });
      writes.push({
        bytes: browserVersion.bytes,
        characterId: character.characterId,
        image: browserVersion.image,
      });
    } else {
      addRemap(browserRemaps, character.characterId, conflict.browser.id, nextId);
      writes.push({
        bytes: browserVersion.bytes,
        characterId: character.characterId,
        image: remappedImage(browserVersion.image, nextId),
      });
    }
    if (browserNote.id === folderNote.id && !hasNoteConflict(
        conflicts, character.characterId, browserNote.id,
    )) {
      pairSeeds.set(`${character.characterId}\u0000${browserNote.id}`, {
        browserNote,
        characterId: character.characterId,
        folderNote,
        winner: browserWins ? 'browser' : 'folder',
      });
    }
  }

  const implicitBoth = [...pairSeeds.values()].map((pair) => ({
    ...pair,
    browserNote: remapJournalNoteImages(
        pair.browserNote,
        browserRemaps.get(pair.characterId) ?? new Map(),
    ),
    folderNote: remapJournalNoteImages(
        pair.folderNote,
        folderRemaps.get(pair.characterId) ?? new Map(),
    ),
  }));
  return {
    browserRemaps,
    folderRemaps,
    implicitBoth,
    remapped: changed.length,
    writes,
  };
}

export async function writePhotoConflictPlan(
    directory: FileSystemDirectoryHandle,
    plan: PhotoConflictPlan,
    now: () => string,
): Promise<void> {
  for (const write of plan.writes) {
    await writeFolderJournalImage(
        directory,
        write.characterId,
        write.image.blobKey,
        write.bytes,
        write.image.mimeType,
        now(),
    );
  }
}

export async function restoreDeletedImages(
    directory: FileSystemDirectoryHandle,
    conflicts: readonly LibrarySyncConflict[],
    choices: Readonly<Record<string, ConflictChoice>>,
    characters: ReadonlyMap<string, BrowserLibraryCharacter>,
    now: () => string,
): Promise<void> {
  for (const conflict of conflicts) {
    if (conflict.browser.kind !== 'image'
      || conflict.reason !== 'deleted-in-folder'
      || choices[choiceKey(conflict)] !== 'restore') {
      continue;
    }
    const character = characters.get(conflict.browser.characterId);
    const image = character?.images.find(
        (candidate) => candidate.image.id === conflict.browser.id,
    );
    if (character === undefined || image === undefined) {
      throw new Error('The deleted browser photo could not be found.');
    }
    await restoreFolderJournalImage(
        directory,
        character.characterId,
        image.image.blobKey,
        image.bytes,
        image.image.mimeType,
        now(),
    );
  }
}

function addRemap(
    remaps: Map<string, Map<string, string>>,
    characterId: string,
    previousId: string,
    nextId: string,
): void {
  const current = remaps.get(characterId) ?? new Map<string, string>();
  current.set(previousId, nextId);
  remaps.set(characterId, current);
}

function remappedImage(image: JournalImage, nextId: string): JournalImage {
  return {
    ...image,
    blobKey: `bfa.journal.image.${nextId}`,
    id: nextId,
  };
}

function hasNoteConflict(
    conflicts: readonly LibrarySyncConflict[],
    characterId: string,
    noteId: string,
): boolean {
  return conflicts.some((conflict) => (
    conflict.browser.characterId === characterId
    && conflict.browser.kind === 'note'
    && conflict.browser.id === noteId
  ));
}

function choiceKey(conflict: LibrarySyncConflict): string {
  return `${conflict.browser.characterId}\u0000${conflict.browser.kind}\u0000${conflict.browser.id}`;
}
