import {listCommittedCharacterIds} from './backup-folder-copy';
import {readCommit} from './folder-library';
import {readFolderLibrarySnapshot} from './folder-library-snapshot';

export interface FolderLibraryStatus {
  characterCount: number;
  checkedAt: string;
  newestAt: string | null;
  siblingCount: number;
}

export async function readFolderLibraryStatus(
    directory: FileSystemDirectoryHandle,
    now: () => string = () => new Date().toISOString(),
): Promise<FolderLibraryStatus> {
  const characterIds = [...await listCommittedCharacterIds(directory)];
  const [snapshot, commits] = await Promise.all([
    readFolderLibrarySnapshot(directory),
    Promise.all(characterIds.map((characterId) => readCommit(directory, characterId))),
  ]);
  const timestamps = [
    ...snapshot.records.map((record) => record.updatedAt),
    ...snapshot.tombstones.map((tombstone) => tombstone.deletedAt),
    ...commits.map((commit) => commit?.copiedAt ?? null),
  ].filter(isTimestamp);
  timestamps.sort((left, right) => right.localeCompare(left));
  return {
    characterCount: characterIds.length,
    checkedAt: now(),
    newestAt: timestamps[0] ?? null,
    siblingCount: snapshot.siblings.length,
  };
}

function isTimestamp(value: string | null): value is string {
  return value !== null && !Number.isNaN(new Date(value).getTime());
}
