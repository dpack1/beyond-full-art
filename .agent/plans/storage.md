# Move browser art into a backup folder

## Goal

After a player connects a folder, that folder is the library for full art, crops, journal notes, and journal photos. A second computer sees updates when it opens the sheet or uses Check folder, once Drive for Desktop has written the files to disk.

The approved screens and collision rules are in the session plan. This file tracks what is safe to build.

## Approved connect screens

Nothing is deleted until the player confirms, and a failed copy leaves the browser copy in place.

1. Foreign folder: stop.
2. Unreadable marker: stop.
3. Blank folder, empty browser: prepare the folder.
4. Blank folder, browser has data: copy, verify, then remove the browser copy.
5. Existing folder, empty browser: read the folder.
6. Existing folder, same records: use the folder and remove the redundant browser copy.
7. Additions only: union into the folder, verify, then remove the browser copy.
8. Conflicts: the player chooses per conflict before any write or delete. Same note edited on both sides can be kept as two notes. Differing full art keeps the other file beside the chosen one.

Computer B does not watch Drive. Opening the sheet reads the folder. Check folder repeats that read while a sheet is already open. An unsaved note is not replaced.

## Scope

Included:

- The eight connect screens above.
- After a confirmed copy, the folder is the library and the checked browser copy is removed.
- Sheet open and Check folder read newer folder files. An unsaved note stays on screen.

Excluded:

- A Google Drive API sign-in.
- `unlimitedStorage`.
- `FileSystemObserver` while a sheet sits open.
- Deleting a file the extension did not write, including a Drive conflict copy.

## Current state

Folder setup shipped on 2026-10-23. The popup opens `folder/setup.html`, the user chooses a directory, and the extension stores the handle in the IndexedDB `backupFolder` store.

A new folder must be empty. `.DS_Store`, `Thumbs.db`, and `desktop.ini` are ignored. Setup writes:

```text
beyond-full-art.json
characters/
```

`beyond-full-art.json` is format `beyond-full-art-folder`, schema version 1, with `createdAt`. A folder that already has a readable version 1 or 2 marker can be chosen again. `createdAt` is not rewritten. Any other file is refused.

Forgetting the folder deletes only the handle on this browser. A confirmed copy writes checked files. When those files still match this browser, a second confirmation removes the browser copies and later saves go to the folder. A mismatch leaves both copies in place.

The original note asked for a per-character Google Drive folder so a second computer can read the same data, and whether local image storage would hit a browser cap. The popup storage readout answers the cap question for a real profile. This plan is the copy that makes the prepared folder useful.

## External assumptions

- Chrome's File System Access API can read and write the stored directory handle after the user has granted it. A later visit may report `prompt`, and the existing setup window is how the user grants it again.
- Google Drive for Desktop syncs a normal folder. The extension does not talk to Google.
- Character IDs stay strings.
- The journal ZIP rules remain the conflict rules: same note id, newer `updatedAt` wins, and an existing local photo blob is not replaced.

Verify the permission prompt by choosing a folder, quitting Chrome, and opening the popup again.

## Approach

The folder is the working library after the player confirms a verified match. `bfa.library.mode` is set to `folder` before the browser art, crops, notes, and photos are removed. The sheet and popup then read and write that folder. A blank folder with an empty browser can be confirmed as the save location without a copy. An existing folder with an empty browser can be confirmed the same way.

```text
beyond-full-art.json
characters/<characterId>/character.json
characters/<characterId>/full-art.<png|jpg|webp>
characters/<characterId>/portrait-crop.<png|jpg|webp>
characters/<characterId>/journal/notes/<noteId>.json
characters/<characterId>/journal/images/<imageId>.<png|jpg|webp>
```

`character.json` is written last. It records the file name and SHA-256 of the full-art file, the crop, each note, and each photo. A directory without it is ignored. Notes JSON holds the versioned note and no image bytes.

Copy to folder, shipped:

1. The setup window offers **Copy into folder** when the folder has no `character.json` and this browser has art or notes. Permission `prompt` or `denied` asks the player to choose the folder again.
2. The player confirms. Declining changes nothing.
3. Each new character is written under `characters/<id>/`. Every file is read back and hashed before `character.json` is saved.
4. A character that already has `character.json` is skipped. A missing blob skips that character and leaves the browser data. A hash mismatch does not write `character.json`.
5. The marker becomes schema 2 only when no character failed and at least one was copied.
6. A second confirmation compares the browser records with the folder. On a full match, the browser copies are removed and new saves go to the folder. A changed note or a missing file leaves both copies in place.

Multi-computer storage is shipped. Tombstones, additions-only union, all-choice-first conflict review, guarded folder switching, Check folder, and stale-save protection extend the checked library above. Differing photo bytes are both retained under distinct ids, with note embeds and featured-photo references remapped. A dirty stale draft can be copied—with independent photo ids—before the newer folder note is loaded.

The marker becomes schema version 2 after a copy in which every character succeeds, and when an empty browser starts saving in a prepared folder. Version 1 folders that have only the marker and an empty `characters/` directory still reconnect. A folder that already has `character.json` is not overwritten by the copy.

## Milestones

- [x] Prepare an empty folder, or reconnect one this extension already prepared, without copying browser data.
- [x] Copy this browser's art, crops, and journals into `characters/<characterId>/` and check the read-back hashes.
- [x] When the folder matches this browser, remove the browser copies and save new art and notes in the folder. An empty browser can start saving there without a copy.
- [x] Multi-computer sync: tombstones, union, conflicts, Check folder, and stale saves.

## Validation

Automated:

- An empty folder becomes a marker plus `characters/`.
- A folder with unrelated files is refused and no handle is stored.
- A prepared folder reconnects without rewriting `createdAt`.
- Forgetting the handle leaves the marker file in place.
- Opening the database at version 2 still reads blobs written at version 1.
- A successful copy writes `character.json` last, checks the read-back hashes, and bumps the marker to schema 2.
- A missing blob or a mismatched read-back does not write that character's `character.json`, does not bump the marker, and does not delete the browser blob.
- Cleanup removes browser art, notes, and photos only when every one still matches the folder, and only after `bfa.library.mode` is `folder`. A changed note leaves the browser copy and the mode local.
- An empty browser and a prepared folder can switch the mode without deleting records. Preferences stay in `chrome.storage.local`.

Manual: `docs/TESTING.md` backup folder checklist. Repeat it after the copy milestone with one character that has full art and a journal photo, then on a second profile choose the same folder and copy it in.

## Risks and rollback

- A mixed folder is refused so the extension does not write beside someone else's files.
- `character.json` is written only after each file is read back and hashed. A character that already has `character.json` is not overwritten. Browser art is removed only after a later match.
- Forgetting the folder is local to this browser. The files remain.
- Removing the extension still deletes the browser copy. The folder copy remains only after the copy milestone exists.
- Rollback of folder setup is forgetting the folder and deleting `beyond-full-art.json` and `characters/` by hand if they are still empty.

## Progress log

- 2026-10-23: Popup storage readout shipped.
- 2026-10-23: Folder setup shipped. Copy and restore remain open.
- 2026-10-23: Connect screen decisions are shown after a folder is chosen. Copy, conflict review, and deleting the browser copy are not built. ADR-027 still keeps the browser as the working copy until those steps land.
- 2026-10-23: Copy into folder writes checked files for a folder that has no `character.json`. The browser copy stays, and the sheet still reads it. Conflict review and deleting the browser copy are still open.
- 2026-10-23: After a verified match, the setup window removes the browser copies and new art, crops, notes, and photos save in the folder. A mismatch leaves both copies. Union, conflict review, Check folder, and tombstones are still open.
- 2026-10-26: Multi-computer storage completed. Setup resolves notes, art, crops, photos, and tombstones only after every conflict has a choice. Photo collisions preserve both byte versions and remap the losing note references. Popup and Journal folder checks landed with stale note and full-art guards; stale Journal drafts support Save, Discard draft, and Keep both.

## Decision log

- 2026-10-23: The working copy stays in the browser until the copy step ships. See ADR-027.
- 2026-10-23: The folder is the library once the player confirms a verified match. Browser copies are removed only then. Divergent copies stay until conflict review exists.
- 2026-10-23: Approved workflow replaces the mirror. The folder becomes the library after a confirmed, verified copy. Computer B reads the folder on sheet open and from Check folder. Content differences are conflicts until the player chooses.
- 2026-10-23: The first folder must be blank, aside from OS junk files. A second computer reconnects by choosing the folder that already has the marker, which will not be blank.
