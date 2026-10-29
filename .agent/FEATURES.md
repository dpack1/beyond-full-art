# Feature List

This file tracks completed, user-facing features that are already part of the extension. The human runbook is `README.md`. Agent instructions are `AGENTS.md`. The D&D Beyond sheet reference is `docs/ddb-reference/`.

Future work belongs in `.agent/plans/` until it ships.

## Shipped Features

### Character journal copy

Status: implemented; live request and folder-backed journal duplication verified

- After D&D Beyond copies a character, asks **Copy stored journal?** when that character has notes or photos and the new character does not.
- **Copy journal** gives the new character its own note ids, photo ids, and photo bytes. Deleting one character does not remove the other's journal.
- **Skip**, Escape, the close button, and the backdrop write nothing. A destination that already has a journal is left alone. Full art is not copied.
- A missing photo or a blocked library writes nothing. The dialog stays open and says what failed.
- The live request is `POST /character/v5/character/copy` with the source
  `characterId` in its JSON body and the destination id in response `id`.
  Defensive request shapes without a source id still need exactly one Copy
  click in that tab.

### Character deletion cleanup

Status: implemented, pending a live delete check

- After D&D Beyond deletes a character and that character has stored full art or a journal, asks whether to delete that stored data or keep it.
- When that character has both, the dialog says the journal and photos will be deleted too and to export them first. Delete art then removes them. A journal with no full art asks to delete the journal and says to export first. **Export** on that dialog downloads the journal zip and leaves the choice open.
- Can remember Delete art or Keep art, and the popup can return the choice to asking each time. A remembered delete still asks when a journal exists.
- Leaves the stored data in place when the delete fails, the character id is unclear, or nothing is stored. A character-sheet delete navigates away, and the next page in that tab shows the dialog.
- A successful delete is HTTP 200 or 204 on the character-service character DELETE. The 2026-08-06 headers screenshot shows 200 OK.
- Confirming delete removes that character's `characters/<character id>` folder and the copy on this browser. Other character folders stay. Deleting one photo from the journal still leaves that photo file and hides it with a tombstone.

### Fullscreen portrait viewer

Status: complete

- Enhances the existing D&D Beyond character-sheet portrait experience without replacing the page UI.
- Opens the current character art in an accessible fullscreen viewer.
- Supports keyboard-friendly close behavior, focus restore, and backdrop dismissal.

### Local full-art storage

Status: complete

- Watches D&D Beyond portrait upload flows and preserves one original full-art image per character locally.
- Stores image bytes in extension-owned storage.
- Uses stored full art in the fullscreen viewer when available.
- Allows stored full art to be removed from the viewer.
- Allows stored full art to be downloaded from the fullscreen viewer.
- Lists stored full-art records in the extension popup with per-item open, download, and delete actions.
- The popup reports notes-and-settings usage against Chrome's extension cap and the browser's IndexedDB estimate for images.

### Folder library and cross-computer sync

Status: complete

- The popup can prepare one empty backup folder, or reconnect a folder this extension already prepared. Setup writes a marker and a `characters/` directory. A confirmed copy writes checked character files into that folder. When they match, the setup window can remove this browser's copies and save new art and notes in the folder. A mismatch leaves both copies in place.
- Folder-library deletes write hashed tombstones into `character.json`. Deleted notes and photos stay hidden, accidental saves of the same note id are refused, and photo bytes remain available when setup restores a retained browser note.
- The folder comparator classifies matching records, additions, changed shared IDs, and tombstoned browser records using note fingerprints and image hashes. Setup can union non-conflicting browser-only records, re-check the combined folder, and only then remove browser copies. Drive conflict siblings are reported without opening them.
- Choosing a different directory while folder mode is active requires confirmation before the stored handle can be replaced. Cancelling keeps the current library.
- Setup resolves every conflict only after each row has a choice. Notes support Keep folder, Keep browser, Keep both, Leave deleted, and Restore. Full-art and crop conflicts select the current image while storing the other bytes as a checked `kept` file. Photo conflicts retain both byte versions, give the losing version a new id, and remap its owning note.
- **Check folder** in the popup refreshes folder status and inventory. The Journal's icon-only **Sync folder** action refreshes an open character without replacing a dirty draft. A stale draft can be retried, discarded, or copied with independent photo ids before loading the folder note. Full-art saves refuse to overwrite a folder revision different from the SHA-256 the page loaded.
- While the folder is the library, `settings.json` keeps the popup toggles, journal list details, companion choices, and the deleted-character art choice. The newer copy wins, so another browser that opens the same folder picks them up.

### Portrait crop workflow

Status: complete

- Lets a user keep full art locally while creating a separate D&D Beyond portrait crop.
- Supports crop creation and editing from the extension workflow.
- Keeps D&D Beyond portrait updates and extension full-art viewing aligned without overwriting the original full art.
- Supports both character-sheet and builder flows with extension-aware UI enhancements.

### Campaign card portrait quality upgrade

Status: complete

- Improves D&D Beyond campaign character-card portrait clarity by swapping eligible avatar URLs to higher-resolution requests.
- Keeps D&D Beyond's card layout, links, and portrait choices intact.
- Preloads upgraded images before swapping them into the page.
- Includes a popup setting so the enhancement can be enabled or disabled.

### Character journal

Status: shipped (beta)

Dylan approved this after live testing. It is on main as `acd760c`.
Journal ZIP backup and restore were approved after live export/import QA on
2026-10-22.

- Adds a Journal tab on the character sheet, after Extras.
- Opens each note in a slide-in panel that mirrors D&D Beyond's Information Sidebar.
- Closes a note when the user clicks outside the slide-in panel, while protecting unsaved edits with the existing discard confirmation.
- Searches, filters, and creates notes from a toolbar with search, Filter, and New Note.
- Supports typed notes, Needs details markers, wiki-link autocomplete, unresolved-link placeholders, and backlinks between notes.
- Shows compact title-and-created-date rows by default. Popup controls can add
  updated dates, text previews, and image thumbnails without changing what
  full note content search can find.
- Reads markdown, and edits it with an icon toolbar and an edit toggle.
- Autosaves edits, merges writes by note ID, preserves unreadable stored records, and refuses stale same-note saves.
- Preserves progress through long notes when switching between reading and editing.
- Exports every local journal as a ZIP with Markdown notes, photo files, and versioned `backup.json` recovery data.
- Imports that backup globally or for one matching character while preserving newer local notes and existing photos.
- Embeds photos inline as `![[img:<id>|caption|width]]`. The image button, paste, and drop insert one at the cursor. Large photos are resized automatically. The bytes stay in IndexedDB.
- Follows the sheet's light and dark theme.

Known caveats:

- Journal ZIP folders use the character ID until full-name capture is reliable.
- A long title is cut off in the edit-mode input.
- A plain line right after a list item joins that bullet. That is ordinary markdown.

Deferred follow-ups:

- Companion portrait manual visual QA. The portrait slice is in the product; `.agent/plans/extras-images.md` stays until that pass.
- Companion name, stats, health, and controls below the character header
- Journal photo export of photos that are not in a note, and conflict choices for `photos.json`. `.agent/plans/photo-library.md` tracks that remainder.
