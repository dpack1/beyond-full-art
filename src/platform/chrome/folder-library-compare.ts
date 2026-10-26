import type {JournalNote} from '../../features/character-journal/character-journal-types';
import type {FolderTombstoneKind} from './folder-library';

export type LibrarySyncRecordKind = 'crop' | 'full-art' | 'image' | 'note';

export interface LibrarySyncRecord {
  characterId: string;
  fingerprint: string;
  id: string;
  kind: LibrarySyncRecordKind;
  updatedAt: string | null;
}

export interface LibrarySyncTombstone {
  characterId: string;
  deletedAt: string;
  id: string;
  kind: FolderTombstoneKind;
}

export interface DriveConflictSibling {
  characterId: string;
  directory: string;
  fileName: string;
  managedFileName: string;
}

export interface FolderLibrarySnapshot {
  records: LibrarySyncRecord[];
  siblings: DriveConflictSibling[];
  tombstones: LibrarySyncTombstone[];
}

export interface LibraryAddition {
  record: LibrarySyncRecord;
  side: 'browser' | 'folder';
}

export interface LibrarySyncConflict {
  browser: LibrarySyncRecord;
  folder: LibrarySyncRecord | null;
  reason: 'changed' | 'deleted-in-folder';
  tombstone: LibrarySyncTombstone | null;
}

export type LibraryComparison =
  | {kind: 'match'; siblings: DriveConflictSibling[]}
  | {additions: LibraryAddition[]; kind: 'additions'; siblings: DriveConflictSibling[]}
  | {
    additions: LibraryAddition[];
    conflicts: LibrarySyncConflict[];
    kind: 'conflicts';
    siblings: DriveConflictSibling[];
  };

export function compareLibrarySnapshots(
    browserRecords: readonly LibrarySyncRecord[],
    folder: FolderLibrarySnapshot,
): LibraryComparison {
  const folderByKey = recordMap(folder.records);
  const browserByKey = recordMap(browserRecords);
  const tombstonesByKey = new Map(
      folder.tombstones.map((entry) => [recordKey(entry), entry]),
  );
  const additions: LibraryAddition[] = [];
  const conflicts: LibrarySyncConflict[] = [];

  for (const browser of browserByKey.values()) {
    const key = recordKey(browser);
    const tombstone = tombstonesByKey.get(key);
    if (tombstone !== undefined) {
      conflicts.push({
        browser,
        folder: folderByKey.get(key) ?? null,
        reason: 'deleted-in-folder',
        tombstone,
      });
      continue;
    }
    const folderRecord = folderByKey.get(key);
    if (folderRecord === undefined) {
      additions.push({record: browser, side: 'browser'});
      continue;
    }
    if (folderRecord.fingerprint !== browser.fingerprint) {
      conflicts.push({
        browser,
        folder: folderRecord,
        reason: 'changed',
        tombstone: null,
      });
    }
  }

  for (const folderRecord of folderByKey.values()) {
    if (!browserByKey.has(recordKey(folderRecord))) {
      additions.push({record: folderRecord, side: 'folder'});
    }
  }

  if (conflicts.length > 0) {
    return {
      additions: sortAdditions(additions),
      conflicts: sortConflicts(conflicts),
      kind: 'conflicts',
      siblings: folder.siblings,
    };
  }
  if (additions.some((addition) => addition.side === 'browser')) {
    return {additions: sortAdditions(additions), kind: 'additions', siblings: folder.siblings};
  }
  return {kind: 'match', siblings: folder.siblings};
}

export function journalNoteFingerprint(note: JournalNote): string {
  return JSON.stringify({
    body: note.body,
    characterId: note.characterId,
    createdAt: note.createdAt,
    featuredImageId: note.featuredImageId,
    id: note.id,
    images: note.images.map((image) => ({
      altText: image.altText,
      blobKey: image.blobKey,
      byteSize: image.byteSize,
      fileName: image.fileName,
      height: image.height,
      id: image.id,
      mimeType: image.mimeType,
      orphanedAt: image.orphanedAt ?? null,
      width: image.width,
    })),
    needsDetails: note.needsDetails,
    questStatus: note.questStatus,
    schemaVersion: note.schemaVersion,
    sessionDate: note.sessionDate,
    title: note.title,
    type: note.type,
    updatedAt: note.updatedAt,
  });
}

function recordMap(records: readonly LibrarySyncRecord[]): Map<string, LibrarySyncRecord> {
  return new Map(records.map((record) => [recordKey(record), record]));
}

function recordKey(record: {characterId: string; id: string; kind: string}): string {
  return `${record.characterId}\u0000${record.kind}\u0000${record.id}`;
}

function sortAdditions(additions: LibraryAddition[]): LibraryAddition[] {
  return [...additions].sort((left, right) => {
    const side = left.side.localeCompare(right.side);
    return side !== 0 ? side : recordKey(left.record).localeCompare(recordKey(right.record));
  });
}

function sortConflicts(conflicts: LibrarySyncConflict[]): LibrarySyncConflict[] {
  return [...conflicts].sort((left, right) => (
    recordKey(left.browser).localeCompare(recordKey(right.browser))
  ));
}
