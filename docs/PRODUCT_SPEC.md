# Product Specification

## Working title

Beyond Full Art

The title is provisional.

## Problem

D&D Beyond character portraits are displayed at a small size. A user can open the existing character panel, but the portrait inside that panel is not clickable and cannot be viewed at a useful size.

Users often start with a larger character illustration, then crop it tightly around the face so it reads well as a portrait. D&D Beyond retains and shows the portrait crop, but does not provide a convenient place to preserve and view the original full artwork.

## Product vision

Make character art feel like a first-class part of the D&D Beyond character sheet without replacing or redesigning D&D Beyond.

The extension should eventually let the user keep an original full artwork image for each character, use a crop as the D&D Beyond portrait, and open the original artwork by clicking the portrait in the right-side panel.

## Identity key

Use the D&D Beyond character ID as the stable local key.

Example URL shape:

```text
https://www.dndbeyond.com/characters/900000001
```

Represent IDs as strings in code. Do not depend on JavaScript number precision or perform arithmetic on them.

## Phase 1, MVP

### User story

As a D&D Beyond user, I can click the portrait shown in the existing right-side character panel and view it fullscreen, so I can actually see the artwork.

### Required behavior

- Run on D&D Beyond character sheet pages.
- Preserve D&D Beyond's existing top-left portrait click behavior.
- Enhance the portrait displayed in the existing right-side panel.
- Open the currently displayed portrait image in a fullscreen overlay.
- Close with Escape, a close button, or backdrop click.
- Keep image aspect ratio and fit it within the viewport.
- Work after delayed rendering and client-side navigation.
- Do not upload, replace, or modify D&D Beyond data.

### MVP limitation

The image opened fullscreen may still be D&D Beyond's cropped portrait. The MVP proves the interaction and page integration only.

## Phase 2, full-art storage

### User story

As a user, I can upload the original full artwork for a character and have it stored locally, so clicking the character portrait opens the full image rather than only the portrait crop.

### Required behavior

- Use D&D Beyond's existing portrait upload flow as the upload entrypoint.
- Support that portrait-management flow in both the sheet sidebar and the builder modal when those surfaces exist.
- Save the selected portrait-upload file locally as full art when the user confirms the native D&D Beyond portrait change, without blocking or modifying D&D Beyond's upload behavior.
- Associate one active full-art image with a character ID.
- Store image bytes locally in extension-origin IndexedDB.
- Store metadata and preferences in `chrome.storage.local`.
- Display the stored full artwork in the fullscreen viewer when available.
- Fall back to the D&D Beyond portrait when no full artwork is stored.
- Improve small D&D Beyond character-card avatar image URLs on campaign pages
  and the My Characters page when the optional card portrait setting is enabled.
- Allow replacement via a later portrait upload and explicit deletion of stored art.
- Allow downloading the locally stored full artwork from the fullscreen viewer.
- Provide a popup inventory for locally stored full artwork, including per-item open, download, and delete actions.
- Show `chrome.storage.local` usage against its quota, and the browser's IndexedDB estimate, in the popup.
- Clearly communicate that uninstalling the extension removes locally stored art.

### Current implementation defaults

- Supported image types: `image/png`, `image/jpeg`, `image/webp`
- Maximum image size: `3 MB`
- Preserve exact uploaded bytes
- One active full-art image per character
- No derived preview image yet
- Stored full art can be downloaded from the fullscreen viewer without the Chrome `downloads` permission
- Stored full art can also be listed, opened on D&D Beyond, downloaded, and deleted from the extension popup
- The current implementation observes D&D Beyond's portrait upload input and native portrait-confirmation action, and does not add a separate extension-owned file picker
- The popup can prepare one empty backup folder, or reconnect a folder that already has this extension's marker. A confirmed copy writes checked files into that folder. When those files match this browser, the player can remove the browser copies and save new art and notes in the folder. A mismatch leaves both copies in place
- When the folder is the library, deleting art, a note, or a journal photo records a hashed tombstone. Deleted notes and photos are not read back, and the same note id cannot be recreated without an explicit restore.
- Folder comparison uses character ID, record kind, record ID, note fingerprints, and image hashes. A changed shared ID or a local record covered by a folder tombstone requires a choice. Drive conflict-copy files are reported by name and never opened or deleted automatically.
- When comparison finds additions without conflicts, setup can add the browser-only records, verify the merged folder, switch to folder mode, and remove the verified browser copies. A failed write or check keeps the browser copies.
- Choosing a different library folder requires confirmation before the saved directory handle changes. Cancelling continues using the current folder.
- Note, photo, full-art, and crop conflicts are resolved as one reviewed set. Every row requires a choice; note Keep both creates a new ID with an ` (other computer)` title suffix. Tombstones can remain deleted or restore the browser record. Rejected art bytes remain as checked, timestamped files recorded under `kept`. A photo conflict keeps both byte versions; the newer owning note keeps the original photo ID and the other retained note is remapped to a new photo ID.
- The popup and open Journal can re-read the folder on demand. A dirty note is preserved when a newer folder copy appears and can be retried, discarded, or kept as an independent copy before the folder note loads. Full-art saves carry the SHA-256 loaded by the page and are refused if the folder revision changed.

### Deferred product decisions

- Whether images should ever be resized or compressed before storage.
- Bulk backup and export behavior.
- Multiple images per character.

## Phase 3, cropping

Allow the user to upload original artwork, select a crop for portrait use, and preserve the original separately.

This phase requires research into whether and how D&D Beyond portrait upload can be safely automated beyond passive observation. Do not assume the extension can programmatically update D&D Beyond's portrait until verified.

### Required behavior

- Start from stored full art rather than forcing the user to upload the same source again.
- Open an extension-owned crop workflow from the existing D&D Beyond portrait-management surface.
- Preserve the original full art separately from the generated portrait crop.
- Save the generated crop locally as a separate artifact.
- Reopen and revise the crop later while the same original full art remains current.
- Submit the generated crop back through D&D Beyond's existing portrait upload input when supported by browser behavior.
- If the original full art changes, invalidate the old derived crop rather than silently reusing it.

### Current implementation defaults

- Crop aspect ratio: square
- Generated crop output: `512 x 512` PNG
- Crop state is saved separately from the original full art
- When a user crops a newly selected portrait file before clicking D&D Beyond's native `Change Portrait`, the crop remains pending in page state until that native confirmation commits the matching full art locally
- Current handoff path: programmatically populate D&D Beyond's existing portrait upload input and dispatch the native upload events

### Remaining validation

- Confirm the generated crop handoff behaves consistently on the live site in both the sheet sidebar and builder modal.
- Confirm the chosen square crop and output size look correct in D&D Beyond's portrait displays.
- Decide whether a future phase should add an explicit assisted fallback when the upload-input handoff fails.

## Phase 4, character deletion cleanup

### User story

As a user who deletes a D&D Beyond character, I can choose whether the extension also deletes the locally stored full artwork for that character.

### Prompt behavior

After D&D Beyond successfully deletes a character, and only when local art exists for that character, show:

**Delete stored full art?**

Actions:

- `Delete art`
- `Keep art`

Checkbox:

- `Remember my decision`

There is no Cancel action because D&D Beyond has already processed the character deletion. The extension prompt controls only local artwork cleanup.

### Remembered behavior

Store one global cleanup preference:

```text
ask | delete | keep
```

- Default is `ask`.
- With `Remember my decision` unchecked, perform the selected action once and remain on `ask`.
- With it checked, `Delete art` saves `delete` and `Keep art` saves `keep`.
- Provide a settings control to return the preference to `ask`.
- Never infer a remembered decision from a dismissed or failed dialog.

### Data safety

- Prompt only after a successful deletion response.
- If the deletion request fails, preserve local art and do not prompt.
- If the character ID cannot be determined confidently, preserve local art.
- If storage deletion fails, show an error and preserve recoverability where possible.

## Phase 5, character journal

### User story

As a D&D Beyond user, I can keep a local journal for each character from the
character sheet, so session notes and character writing have a better home than
a single long native notes field.

### Required behavior

- Run on D&D Beyond character sheet pages.
- Provide an extension popup setting to enable or disable the Character Journal
  tab without deleting local journal entries.
- Add an extension-owned `Journal` tab immediately after D&D Beyond's `Extras`
  tab when that tab row can be found.
- Show an extension-owned journal section inside the character sheet content
  area from the `Journal` tab.
- Restore the native D&D Beyond sheet section when the user selects another
  native tab.
- Include photos on a journal note: add, view, and remove PNG, JPEG, and WebP
  images. A file over 3 MB is resized before it is stored. A file over 25 MB
  is refused, with the size and the limit shown on the note.
- Store journal entries locally by D&D Beyond character ID.
- Support creating, editing, listing, saving, and deleting text entries.
- Let the user search titles, `#tags`, note text, and photo file names.
- Filter the list from a Filter button. Sessions, NPCs, Places, Items,
  Quests, and Backstory can be selected together. An empty selection shows
  every note. New Note is the only way to create a note.
- Keep one local journal per character. There is no character cap.
- Link notes with `[[Name]]`. A unique title opens that note. A missing title
  can become a placeholder. Duplicate titles ask which note to open.
- Keep journal data separate from D&D Beyond notes, backstory, and extras.
- Preserve unsaved editor text when a save fails.
- Preserve entries when a delete fails.
- Export every locally stored character journal from the extension popup as a ZIP of Markdown notes, photos, and recovery data that remains readable without D&D Beyond or the extension.
- Preserve journal photos and raw stored records in that export so unreadable records are not silently lost.
- Import that backup for all characters or one matching character, preserving newer local notes and existing local photo blobs.
- Follow the character sheet's light and Underdark appearance, including a
  change made while Journal is open.

### Current implementation defaults

- Journal note text is stored in `chrome.storage.local`.
- Journal photo bytes are stored in extension-origin IndexedDB.
- The Character Journal tab is enabled by default and controlled by
  `bfa.preferences.characterJournalEnabled` in `chrome.storage.local`.
- Journal rows show the title and an unlabeled, visually quiet creation date
  by default. Updated dates, text previews, and image thumbnails are separate
  global popup preferences and default to hidden. Search still checks the
  complete note body and photo filenames regardless of those display choices.
- New notes are markdown plus an image list (schema version 2). Version 1
  block entries migrate once per character, after a backup that is not
  overwritten.
- Photos are PNG, JPEG, or WebP and belong to one note. Bytes already in
  IndexedDB stay there. A new file over 3 MB is resized to a 2048px long edge
  at about 0.85 quality, then stored only if the result is still at or under
  3 MB. The source file can be up to 25 MB.
- A new photo is inserted at the cursor as `![[img:<id>]]`. Optional caption
  and width use `![[img:<id>|caption|300]]`. Read mode shows the image there.
  Photos already on a note but missing from the text get that embed at the
  end of the body. Removing the embed keeps the blob until a later save, at
  least 30 seconds after it went missing.
- The list sits in the same content box as Notes and Extras and hides that
  box's native section while Journal is open. The note panel uses the
  right-hand slide-in's edge controls: close and back sit outside the
  content box.
- There is no cloud sync, no GM view, and no D&D Beyond field sync.

### Deferred product decisions

- A quest-status control. The field is stored as null.
- Optional future sync to D&D Beyond fields.

## Phase 6, companion portrait from Extras

### User story

As a player with a familiar, pet, summon, or other Extra, I can choose one of
them in D&D Beyond's Extras section and keep its portrait visible beside my
character portrait, so I do not forget that companion is present.

### Required behavior

- Provide a popup setting to enable or disable the companion portrait feature
  without deleting the saved choice.
- Add an extension-owned checkbox to each Extras row with a usable image.
- Allow one selected companion per character. Selecting another replaces the
  current selection; clearing it removes the portrait.
- Show the selected companion as a small bottom-right overlay on the character
  header portrait.
- Preserve D&D Beyond's portrait click behavior and native Extra-row behavior.
- Store only small, versioned selection metadata in `chrome.storage.local`,
  keyed by the string character ID.
- Restore the overlay after refresh even before the Extras tab is opened.
- Update safely when Extras rows remount, the route changes, the popup setting
  changes, or the selected image fails.

### First-slice limits

- The overlay is display-only and shows one portrait.
- Companion image bytes are not copied into IndexedDB.
- The extension uses the exact image URL D&D Beyond already rendered and does
  not invent a larger-image transformation.
- Companion name, AC, hit points, speed, notes, and health/action controls
  under the character header are deferred until the portrait slice is stable.
- No private endpoint or network-request integration is part of this phase.

### Current implementation defaults

- The popup setting is enabled by default and uses
  `bfa.preferences.companionPortraitEnabled`.
- One versioned selection is stored at
  `bfa.companionPortrait.selection.<characterId>`.
- The Extras control is a checkbox. Selecting a different row replaces the
  previous choice for that character.
- The companion image is a keyboard-accessible square overlay at the
  bottom-right of the enlarged 76px character-header portrait. Activating it
  opens the selected Extra's native sidebar.
- The exact HTTPS image URL already rendered by D&D Beyond is stored; no image
  bytes are copied and no URL transformation is applied.
- Disabling the popup setting removes the checkboxes and overlay without
  deleting the saved selection.

## Non-goals for early phases

- Rebuilding the D&D Beyond character sheet.
- A developer-operated cloud account or automatic sync. A user-chosen folder can be prepared for a later copy. Google Drive sync happens when that folder is inside Drive for Desktop.
- Sharing artwork with other users.
- AI image generation.
- Automatically collecting images from unrelated pages.
- Modifying D&D Beyond network requests.
- Blocking character deletion.
- Depending on undocumented endpoints for more data than the feature requires.

## Success criteria

The MVP is successful when a user can install the unpacked extension, open a character sheet, open the existing right-side portrait panel, click its portrait, and reliably view and dismiss a fullscreen image without disrupting the page.
