# Using Beyond Full Art

Beyond Full Art adds local character art and journal tools to D&D Beyond. This
guide covers the everyday workflows after the unpacked extension is built and
loaded. Installation is in the [README](../README.md#install).

## After rebuilding

Chrome loads the compiled `dist/` folder. After a source change:

1. Wait for `npm run build` or `npm run watch` to finish.
2. Open `chrome://extensions`.
3. Choose **Reload** on the Beyond Full Art card.
4. Refresh the D&D Beyond tab.

## Full character art

### View art fullscreen

1. Open a D&D Beyond character sheet.
2. Click the normal character portrait to open D&D Beyond's portrait pane.
3. Click the portrait inside that pane.
4. Close the viewer with Escape, the close button, or the backdrop.

When Beyond Full Art has an original image stored for the character, the viewer
uses it. Otherwise it shows the current D&D Beyond portrait.

### Save original art

1. Open D&D Beyond's portrait manager from the character sheet or builder.
2. Choose an image through D&D Beyond's normal upload control.
3. Finish by using D&D Beyond's native **Change Portrait** action.

Beyond Full Art saves the selected source image only after that native
confirmation. Abandoning the chooser does not replace existing full art.

Supported files are PNG, JPEG, and WebP up to 3 MB.

The portrait manager previews a chosen file with the same centered square crop
the sheet will show. **Crop portrait** remains available for that chosen file
even when a connected folder still needs permission.

### Crop a portrait

1. Open the portrait manager after full art is available, or choose a new file.
2. Choose **Crop portrait** or **Edit portrait crop**.
3. Drag and zoom until the square framing looks right.
4. Apply the crop.
5. Finish D&D Beyond's portrait flow if it asks you to confirm the change.

The crop is a separate 512×512 PNG. The original artwork remains available for
fullscreen viewing. Replacing the original art invalidates its previous crop.

### Download or remove art

Open the fullscreen viewer for a character with stored full art, then choose
**Download full art** or **Remove stored full art**. Removing it does not change
the D&D Beyond portrait.

The extension popup also lists stored characters. Each row can open the sheet,
download the full art, or delete the extension's copy.

## Character Journal

### Open and browse the Journal

1. Leave **Character Journal** enabled in the extension popup.
2. Open a character sheet.
3. Choose **Journal**, immediately after **Extras**.
4. Search titles, tags, complete note text, and photo filenames.
5. Use **Filter** to show one or more note types.

The list is compact by default. Popup settings can also show updated dates,
text previews, and image thumbnails without changing what search can find.

### Create and edit a note

1. Choose **New Note**.
2. Pick the note type and add a title and body in the slide-in panel.
3. Use markdown for formatting.
4. Write `[[Note name]]` to link another entry. Autocomplete can create a
   missing note.
5. Close the panel or return to the list when finished.

Notes autosave. If the same entry changed elsewhere, the Journal refuses a stale
write instead of silently overwriting the newer copy.

### Position the note sidecar

The controls outside the note content mirror D&D Beyond's own sidebar:

- **Hide** collapses the open note.
- **Lock** keeps it available while moving between sheet tabs until another
  sheet section opens D&D Beyond's sidebar.
- **Overlay** closes the note for an outside click or Escape.
- **Fixed** shifts the sheet instead of covering it.
- **Align** docks the sidecar on the left or right.

The sidecar choice lasts for the current page. Previous and next note controls
remain inside the scrolling panel.

### Add photos to a note

While editing, use **Image**, paste, or drop a PNG, JPEG, or WebP file. The
Journal inserts an image reference at the cursor:

```text
![[img:<id>]]
```

Optional caption and width values go inside the same brackets:

```text
![[img:<id>|A quiet camp beneath the pines|300]]
```

Files over 3 MB are resized to a 2048-pixel long edge and stored at or below
3 MB. Source files over 25 MB are refused without changing the note.

### Use the photo library

Switch from **Notes** to **Photos** inside the Journal. A photo belongs to the
character and can appear in many notes or none. **From photos** inserts an
existing image without making another copy.

Removing an image reference or deleting a note leaves the photo in the library.
Use the photo's explicit delete action to remove it.

### Leave the Journal

Choose any native D&D Beyond sheet tab. Disabling **Character Journal** in the
popup hides the tab without deleting saved entries.

## Companion portrait

1. Leave **Companion portrait** enabled in the popup.
2. Open the character sheet and choose **Extras**.
3. Check the small box on the Extra whose portrait should appear by the
   character portrait.
4. Click the companion portrait to open D&D Beyond's native sidebar.
5. Clear the checkbox to remove it, or choose another Extra to replace it.

The companion choice is stored for that character. Turning the feature off
hides the portrait without forgetting the choice.

## Sharper character cards

1. Open the extension popup.
2. Enable **Sharper card portraits**.
3. Visit a D&D Beyond campaign or **My Characters** page.

Eligible cards progressively swap to a larger avatar source after rendering.
Disabling the setting leaves D&D Beyond's original image behavior in place.

## Backups and folder storage

### Export and restore journals

Use **Export all journals** before removing or updating the extension. The ZIP
contains:

- readable Markdown notes,
- ordinary photo files,
- `backup.json` recovery data.

Use **Import backup** to restore the ZIP. Import merges by stable note ID:
missing notes are added, the newest version wins, unrelated local notes remain,
and existing photo bytes are not overwritten. A character row can export or
import only that character. Older HTML backups remain importable.

### Use a folder as the library

The popup's **Choose folder** action opens a separate setup window because the
toolbar popup closes when Chrome opens a directory picker.

You can choose:

- a new folder that is empty aside from ordinary system metadata, or
- a folder Beyond Full Art previously prepared.

Setup copies the selected browser data, reads the files back, and verifies them
before offering to remove the browser copies. New art, crops, notes, and photos
then save in that folder. A mismatch keeps both copies in place.

After quitting Chrome or reloading the extension, open the popup once so Chrome
can allow the saved folder again. A hidden extension page then keeps that
folder readable across sheet refreshes until Chrome quits. The files remain in
the folder; they are not copied back into browser storage.

Use **Check folder** in the popup or **Sync folder** in the Journal to read
changes made on another computer. Conflict review requires a choice for every
changed record before writing anything.

Putting the library inside Google Drive, OneDrive, or another synchronized
directory lets that service move the files. Beyond Full Art does not run or
control the cloud synchronization.

## Copied and deleted characters

### After copying a character

When D&D Beyond copies a character with a stored journal or photos, Beyond Full
Art can ask **Copy stored journal?** Choosing **Copy journal** gives the new
character independent note IDs, photo IDs, and photo files. Full art is not
copied.

**Skip**, Escape, the close button, and the backdrop write nothing. A destination
that already has a journal is left alone.

### After deleting a character

After D&D Beyond successfully deletes a character with stored full art or
journal data, Beyond Full Art asks whether to keep or remove that local data.
When a journal exists, **Export** downloads it and leaves the decision open.

An unsuccessful or ambiguous D&D Beyond deletion leaves the extension data in
place. Deleting stored data removes only that character; other character folders
remain unchanged.

## Storage and privacy

Before a folder becomes the library:

- preferences, metadata, and note text use `chrome.storage.local`,
- full art, crops, and photo bytes use extension-owned IndexedDB.

After a verified folder switch, art and journal files live in the chosen folder.
Preferences remain available to Chrome and are also copied to `settings.json`
in the folder.

Beyond Full Art does not upload character data to its own server. Removing the
extension removes browser-only copies, so export journals or connect a folder
first. Read [PRIVACY.md](../PRIVACY.md) for the complete policy.

## Troubleshooting

- Confirm the latest build finished successfully.
- Reload the extension from `chrome://extensions`.
- Refresh the D&D Beyond tab.
- Confirm the relevant popup setting is enabled.
- If a folder is connected, choose it again when Chrome requests access.

Developer diagnostics and live checklists are in [docs/TESTING.md](TESTING.md).
