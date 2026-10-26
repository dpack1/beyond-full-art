import {
  getAllRawCharacterJournalRecords,
  getAllStoredCharacterArtMetadata,
  getAllStoredCharacterPortraitCropMetadata,
} from './storage';
import {isJournalNote} from '../../features/character-journal/character-journal-types';

export type LibraryItemKind = 'art' | 'crop' | 'note' | 'photo';

export interface LibraryItem {
  characterId: string;
  detail: string;
  id: string;
  kind: LibraryItemKind;
  revision: string;
}

export type LibraryDecision =
  | {kind: 'blank-empty'}
  | {characters: number; kind: 'blank-with-local'; notes: number; photos: number}
  | {characters: number; kind: 'use-folder'}
  | {characters: number; kind: 'matches'}
  | {
    fromBrowser: number;
    fromFolder: number;
    kind: 'additions';
  }
  | {conflicts: LibraryConflict[]; kind: 'conflicts'};

export interface LibraryConflict {
  characterId: string;
  id: string;
  kind: LibraryItemKind;
}

export function decideLibraryConnection(
    folder: 'blank' | 'owned',
    browserItems: readonly LibraryItem[],
    folderItems: readonly LibraryItem[],
): LibraryDecision {
  if (folder === 'blank') {
    if (browserItems.length === 0) {
      return {kind: 'blank-empty'};
    }
    return {
      characters: characterCount(browserItems),
      kind: 'blank-with-local',
      notes: countKind(browserItems, 'note'),
      photos: countKind(browserItems, 'photo'),
    };
  }

  if (browserItems.length === 0) {
    return {characters: characterCount(folderItems), kind: 'use-folder'};
  }

  const folderByKey = indexItems(folderItems);
  const browserByKey = indexItems(browserItems);
  const conflicts: LibraryConflict[] = [];
  let fromBrowser = 0;
  let fromFolder = 0;
  const keys = new Set([...browserByKey.keys(), ...folderByKey.keys()]);
  for (const key of keys) {
    const browserItem = browserByKey.get(key);
    const folderItem = folderByKey.get(key);
    if (browserItem === undefined) {
      fromFolder += 1;
      continue;
    }
    if (folderItem === undefined) {
      fromBrowser += 1;
      continue;
    }
    if (browserItem.detail !== folderItem.detail) {
      conflicts.push({
        characterId: browserItem.characterId,
        id: browserItem.id,
        kind: browserItem.kind,
      });
    }
  }

  if (conflicts.length > 0) {
    return {conflicts, kind: 'conflicts'};
  }
  if (fromBrowser > 0 || fromFolder > 0) {
    return {fromBrowser, fromFolder, kind: 'additions'};
  }
  return {characters: characterCount(browserItems), kind: 'matches'};
}

export function libraryDecisionMessage(
    folderName: string,
    decision: LibraryDecision,
): string {
  switch (decision.kind) {
    case 'blank-empty':
      return `“${folderName}” is ready. New art and notes can be saved in this folder instead of this browser. Nothing has been moved yet.`;
    case 'blank-with-local':
      return `“${folderName}” is empty and this browser has ${countLabel(decision)}. Copying writes checked files. After they match, this browser's copies can be removed and new art and notes save in the folder.`;
    case 'use-folder':
      return decision.characters === 0
        ? `“${folderName}” is already set up, and this browser has no art or notes. Nothing was changed.`
        : `“${folderName}” already has art for ${decision.characters} ${decision.characters === 1 ? 'character' : 'characters'}. This browser has nothing saved, so it can use the folder once reading from the folder is turned on. Nothing was copied.`;
    case 'matches':
      return `“${folderName}” matches this browser. Removing the browser copy is not available yet. Nothing was removed.`;
    case 'additions':
      return decision.fromFolder === 0
        ? `“${folderName}” is already set up and this browser has ${decision.fromBrowser} ${decision.fromBrowser === 1 ? 'record' : 'records'} to copy. The files are checked after writing. They stay in this browser, so the sheet keeps using them. Nothing was removed from this browser.`
        : `“${folderName}” and this browser have ${decision.fromBrowser} ${decision.fromBrowser === 1 ? 'record' : 'records'} to add from this browser and ${decision.fromFolder} from the folder. That merge is not available yet. Nothing was changed.`;
    case 'conflicts':
      return `“${folderName}” disagrees with this browser in ${decision.conflicts.length} ${decision.conflicts.length === 1 ? 'place' : 'places'}. Nothing was changed. Choose which copy to keep when conflict review is available.`;
  }
}

export async function readBrowserLibraryItems(): Promise<LibraryItem[]> {
  const [art, crops, journals] = await Promise.all([
    getAllStoredCharacterArtMetadata(),
    getAllStoredCharacterPortraitCropMetadata(),
    getAllRawCharacterJournalRecords(),
  ]);
  const items: LibraryItem[] = [];
  for (const metadata of art) {
    items.push({
      characterId: metadata.characterId,
      detail: `${metadata.byteSize}:${metadata.updatedAt}`,
      id: 'full-art',
      kind: 'art',
      revision: metadata.updatedAt,
    });
  }
  for (const crop of crops) {
    items.push({
      characterId: crop.characterId,
      detail: `${crop.byteSize}:${crop.updatedAt}`,
      id: 'portrait-crop',
      kind: 'crop',
      revision: crop.updatedAt,
    });
  }
  for (const journal of journals) {
    for (const record of journal.records) {
      if (!isJournalNote(record)) {
        continue;
      }
      items.push({
        characterId: record.characterId,
        detail: record.body,
        id: record.id,
        kind: 'note',
        revision: record.updatedAt,
      });
      for (const image of record.images) {
        items.push({
          characterId: record.characterId,
          detail: `${image.byteSize}`,
          id: image.id,
          kind: 'photo',
          revision: record.updatedAt,
        });
      }
    }
  }
  return items;
}

function indexItems(items: readonly LibraryItem[]): Map<string, LibraryItem> {
  const indexed = new Map<string, LibraryItem>();
  for (const item of items) {
    indexed.set(`${item.kind}\u0000${item.characterId}\u0000${item.id}`, item);
  }
  return indexed;
}

function characterCount(items: readonly LibraryItem[]): number {
  return new Set(items.map((item) => item.characterId)).size;
}

function countKind(items: readonly LibraryItem[], kind: LibraryItemKind): number {
  return items.filter((item) => item.kind === kind).length;
}

function countLabel(decision: {characters: number; notes: number; photos: number}): string {
  return `${decision.characters} ${decision.characters === 1 ? 'character' : 'characters'}, ${decision.notes} ${decision.notes === 1 ? 'note' : 'notes'}, and ${decision.photos} ${decision.photos === 1 ? 'photo' : 'photos'}`;
}
