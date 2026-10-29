# Photo library in the Journal

## Goal

From the Journal tab, open **Photos** and see every photo stored for this character. A photo can sit there with no note, or appear in one or many notes. Clicking a photo shows it full screen and lists the notes that use it.

## Scope

Included:

- A **Notes** / **Photos** switch inside the Journal, for the character whose sheet is open.
- A thumbnail grid of this character's journal photos.
- Add a photo that is not in a note.
- Full-screen view, with the notes that use the photo.
- Insert a stored photo into a note, or upload a new one from the note.
- Remove a photo from one note without deleting the file.
- Delete a photo on purpose, including its embeds, without deleting the notes.
- The same grid in browser mode and folder mode.

Explicitly excluded:

- Portraits, crops, and Extras companion images.
- Albums, tags, captions edited from the grid, reordering, or a multi-select delete.
- A photo library in the popup.
- Sharing one photo across two characters.
- Changing the embed syntax or the resize limits.

## Current state

The Journal has a **Notes** / **Photos** switch, a thumbnail grid, **Add photo**, **From photos**, **Remove from note**, and **Delete photo**. A photo belongs to the character. Unlinking it keeps the file. The catalog is `bfa.journal.library.<characterId>` on this browser and `characters/<characterId>/journal/photos.json` when the folder is the library. ADR-029 records that.

Still open:

- The live Inventory row was not captured into `docs/ddb-reference/`. The switch copies that row when **My Inventory** is on the page and otherwise uses the mapped tab-item classes.
- Export still collects photos from note records. A photo that is only in the catalog is not in the zip.
- Folder conflict handling does not offer a choice for `photos.json`.

## Previous state

Journal photos started as records on a note. The body places one with `![[img:<id>]]`, optionally `![[img:<id>|caption|300]]`. Bytes live in extension-origin IndexedDB until the folder is the library, then in `characters/<characterId>/journal/images/<imageId>.<ext>`. The old orphan delete, which removed an unlinked blob about 30 seconds after save, has stopped.

## External assumptions

- The Inventory secondary nav is the sheet's tab-item row, painted by the sheet's own CSS, including the theme-color underline on the active item. Confirm this on the sheet before the switch is built, and record the markup, the date, and the provenance tag in `docs/ddb-reference/README.md`.
- Cloning that row, or rebuilding it from the selector map when Inventory is not mounted, is enough for the sheet CSS to paint **Notes** and **Photos**. A class that is not already in the map gets one new entry, with `targets`, `features`, `lookFor`, and fixtures.
- PNG, JPEG, and WebP rules stay as they are: a file over 25 MB is refused, a file over 3 MB is resized to a 2048px long edge, and the stored blob stays at or under 3 MB.
- Folder mode already stores photo bytes under the character. A photo that no note embeds still needs a catalog the folder writes and reads, so sync does not treat that file as stray.

## Approach

### View switch

**Notes** and **Photos** are the Journal's secondary tab row, matching Inventory's **My Inventory** / **Party Inventory** switch. The row sits at the top of the Journal content. **Notes** is selected when Journal opens. The selected item uses the sheet's active-tab class.

```text
Journal tab
  Notes    Photos
  [Search] [Filter] [Sync] [New Note or Add photo]
  list of notes, or grid of photos
```

The search row stays under the switch and follows the view. It is not where the switch lives.

Build the row the way the journal toolbar is built. Clone the live Inventory secondary nav when that section is on the page, keep its classes, and set the labels to **Notes** and **Photos**. When Inventory is not mounted, rebuild that same tab-item structure from the selector map. Our items are buttons or the cloned element type, with one selected. Choosing **Photos** while a note is open closes the note the same way leaving it already works, including the discard prompt when the draft is dirty.

### Photos grid

1. Choose **Photos**.
2. A grid shows one square thumbnail per stored photo. The accessible name is the file name.
3. Search matches file names. The field label is **Search photos**.
4. Filter offers **All**, **In a note**, and **Not in a note**. An empty selection means All.
5. **Sync folder** stays available while the folder is the library and still refreshes notes and photos together.
6. The primary button is **Add photo**.

Empty grid copy:

- No photos stored: **No photos yet.**
- Search misses: **No photos match that search.**
- **Not in a note** matches nothing: **Every photo is in a note.**

**Add photo** uses the existing file rules. The new thumbnail appears in the grid. No note is created and no embed is inserted. A refused file explains the failure and adds nothing.

### One photo

Activating a thumbnail opens the existing full-screen viewer: the image, the file name, **Close photo**, and Escape or a backdrop click to close.

**Used in** lists each note title that embeds the photo. A title opens that note and closes the viewer. A dirty draft hits the existing discard prompt. When nothing embeds it, the viewer says **Not in a note yet.**

**Delete photo** asks first.

- Unused: **Delete this photo? This cannot be undone.**
- Used: **Delete this photo? It will be removed from:** then the note titles. **Those notes stay.**

Confirming deletes the file, removes it from Photos, and removes its embeds from those notes. The notes remain, including their other text and photos. Cancelling leaves everything in place. A failed delete says so, and the photo, notes, and embeds stay.

### Note editing

The formatting bar's **Image** control opens **Upload photo** and **From photos**.

**Upload photo** is today's file picker. The file joins the character catalog and `![[img:<id>]]` is inserted at the cursor.

**From photos** opens the same grid over the note, in pick mode. Search and the used / unused filter work. **Add photo** is hidden. Choosing a thumbnail inserts the existing id at the cursor and returns to the note. The file is not copied. Escape or **Back** returns without inserting.

Paste and drop on the note still upload new photos and insert them. Those photos appear in Photos.

In a note, the viewer button that today says **Remove photo** says **Remove from note**. Confirming removes that photo's embeds from this note only. The file stays in Photos, and other notes that use it stay as they are. If this was the note's featured image, the note no longer features it.

### Data rules

A photo belongs to the character. Notes point at it with the current embed. One photo can be in many notes, or in none.

- One catalog of photos per character. Each entry keeps the current id, file name, type, size, dimensions, and blob key.
- A note's image list is the catalog entries that note embeds, so a note file still carries the photos it shows. Folder sync, export, and conflict handling for those photos stay on that path.
- A photo in no note lives in the catalog and in the image store. In folder mode its bytes stay in `characters/<characterId>/journal/images/`. The catalog is written and read with the character so that file is kept on purpose.
- Existing photos move into the catalog once. Their ids stay the same, so current embeds keep working.
- Removing an embed updates the note and leaves the catalog and the file. The 30-second orphan delete stops.
- Delete photo removes the catalog entry, the file, the image tombstone that already hides a deleted folder photo, and every embed of that id. It does not delete notes.
- A tombstoned photo id stays unrestorable until the existing restore path.
- Image bytes stay out of `chrome.storage.local`. Preferences stay there.

The catalog's on-disk shape is part of the first storage slice. An image file the catalog does not name is still a stray file. A file the catalog names is kept even when no note embeds it.

## Milestones

- [ ] **M1: Inventory nav reference.** Confirm the **My Inventory** / **Party Inventory** row, update `docs/ddb-reference/README.md`, and add the selector-map entry only if the existing tab-item classes are not enough. The switch is built. The live row is still not in the sheet reference.
- [x] **M2: Photo catalog.** Add the character catalog, copy existing note photos once with ids preserved, and stop orphan deletion. Unlink leaves the file. Tests cover catalog, unlink, and delete.
- [x] **M3: Photos view.** Secondary tab row, grid, search, filter, add, empty states, full-screen view, **Used in**, and delete confirmation.
- [x] **M4: Note integration.** **Upload photo**, **From photos**, and **Remove from note**.
- [ ] **M5: Folder, export, and conflicts.** `photos.json` is written for this computer. An unused photo is not yet included in export. Conflict choices for that file are still open. ADR-029 records the catalog and says those two pieces are not part of that decision.

M2's tests land before M3. Folder behavior in M5 lands before a delete from Photos can run while the folder is the library.

## Validation

For M1, a localized build is enough after the reference update. M2 and later change storage, so run:

```text
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` when the Journal content script or the selector map changes.

Focused coverage:

- Existing embeds still resolve after the catalog copy, with the same ids.
- A photo in no note remains after save and after reload.
- **Remove from note** drops the embed and leaves the file.
- **Delete photo** removes the file and the embeds, and leaves the notes.
- A failed delete leaves the photo and the notes.
- The same photo can be inserted into a second note without a second file.
- Search and the used / unused filter match the grid.
- **Notes** is selected when Journal opens.
- The switch uses the Inventory secondary-nav structure.

Manual check on a character sheet, light and Underdark:

1. Open Journal. Confirm **Notes** and **Photos** sit where **My Inventory** and **Party Inventory** sit, with the theme-color underline on **Notes**.
2. Choose **Photos** with no photos, add one, and confirm it is not in a note.
3. Open it full screen. Confirm **Not in a note yet.** Close it.
4. Insert it into a note with **From photos**, then open Photos again and confirm **Used in** names that note.
5. **Remove from note** and confirm the photo is still in the grid.
6. Delete it and confirm the note remains.
7. Repeat the switch and the grid in Underdark mode.

## Risks and rollback

- The Inventory row may use a class the screenshots do not show. Stop after M1 if it cannot be identified, and do not invent a private switch.
- Stopping orphan deletion keeps files that older builds would have removed. That is the point of the library. Do not delete those files in the migration.
- A catalog write that fails must leave the note and the existing blob in place.
- Folder sync must not delete an image file just because no note embeds it, once the catalog names it.
- Delete must not remove a note, a portrait, or a crop.

Rollback of the UI is removing the Photos view and the note menu. Rollback of storage is not automatic: once a photo lives only in the catalog, an older build will not show it. Ship the catalog and the Photos view in the same release as the folder round-trip, or keep unused photos readable by the current note path until M5 is in.

## Progress log

- 2026-10-28: The sketch asked for a hub of photos that are in notes and photos that are not. The flow puts that hub in the Journal.
- 2026-10-28: The view switch reuses the Inventory secondary nav (**My Inventory** / **Party Inventory**), above the search row.
- 2026-10-28: The catalog, the Notes / Photos switch, the grid, and the note Image menu are in the reload build. Unlinking a photo keeps the file. `journal/photos.json` is written for this computer. Export of unused photos and conflict choices for that file are still open. The live Inventory row was not captured; the switch copies it when **My Inventory** is on the page and otherwise uses the mapped tab-item classes.
- 2026-10-29: Rechecked the plans directory. M2, M3, and M4 match the code. M1 and M5 are the remainder, so this plan stays.

## Decision log

- 2026-10-28: Photos are per character, inside the Journal. One photo can be in many notes or in none.
- 2026-10-28: Unlinking a photo keeps the file. **Delete photo** is the only action that removes the file, and it names the notes that will lose the picture.
- 2026-10-28: **Notes** and **Photos** use the sheet's secondary tab row, cloned from Inventory when that row is mounted.
