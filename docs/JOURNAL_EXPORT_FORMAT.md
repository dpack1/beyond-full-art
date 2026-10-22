# Character journal export format

The extension popup downloads `beyond-full-art-journals-YYYY-MM-DD.zip`, or
includes the character ID when exporting one journal. The ZIP is both a
human-readable archive and a versioned recovery container.

## Archive layout

```text
backup.json
characters/
  <character-id>/
    notes/
      <title>.md
    photos/
      <file-name>
```

Journal image embeds in each note are rewritten as relative Markdown image
links. The archive uses uncompressed ZIP entries so it can be created and read
without a runtime package or an additional Chrome permission.
Duplicate note titles or photo filenames receive a `-2`, `-3`, and so on only
when needed to keep every file distinct. Human-readable note and photo names
are not used as recovery keys; `backup.json` maps their paths to stable IDs.

## Version 1 recovery data

`backup.json` has this shape:

```ts
interface JournalExportV1 {
  format: 'beyond-full-art-journal-export';
  version: 1;
  exportedAt: string;
  characters: Array<{
    characterId: string;
    records: unknown[];
  }>;
  images: Array<{
    blobKey: string;
    fileName: string;
    mimeType: string;
    byteBase64: null;
    error: string | null;
    zipPath: string | null;
  }>;
}
```

`records` is the unmodified array from
`bfa.characterJournal.entries.<characterId>`. Consumers must validate each
record by its own schema version. Unknown records remain in the recovery data
even though they do not produce Markdown files.

A photo with `zipPath: null` was missing or could not be read. `error`
describes that failure. The rest of the export remains valid.

## Import safety

The importer treats the ZIP and JSON as untrusted input. It validates archive
paths, entry bounds and checksums, the container, each supported record, photo
key, MIME type, and decoded size. Notes merge by ID; the newest `updatedAt`
wins, so an older backup cannot replace a newer local note. Existing local
photo blobs are not overwritten. Unknown raw record shapes are skipped during
import. HTML backups from the earlier export implementation remain importable.
