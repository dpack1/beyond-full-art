# Testing Strategy

## Test layers

### Pure unit tests

Cover logic that does not need a browser DOM:

- character sheet URL recognition,
- character ID parsing,
- cleanup preference transitions,
- request-body decoding,
- request lifecycle correlation,
- storage key generation,
- runtime message validation.

### DOM fixture tests

Use a lightweight DOM test environment for:

- portrait target discovery against saved minimal fixtures,
- idempotent enhancement,
- viewer open and close behavior,
- backdrop versus image clicks,
- Escape handling,
- focus restoration,
- observer teardown.

Fixtures should contain only the DOM needed for the behavior. Do not copy a large portion of D&D Beyond's page source into the repository.

### Playwright fixture tests

Use local Playwright pages for end-to-end extension checks that need the built
Manifest V3 extension loaded in Chromium. These tests route D&D Beyond character
URLs to small fixture documents and verify that the content script enhances the
expected surfaces without touching the live site.

Run them with:

```text
npm run test:e2e
```

The Playwright extension tests run headless by default using Playwright's full
Chromium channel so unpacked extension loading works. For local visual
debugging, run them headed with:

```text
BFA_PLAYWRIGHT_HEADLESS=false npm run test:e2e
```

To try a different local browser channel, set `BFA_PLAYWRIGHT_CHROMIUM_CHANNEL`.

If Playwright reports that Chromium is missing, run
`npx playwright install chromium` once for the checkout.

The suite writes `test-results/selector-health-report.json` with the current
fixture selector matrix. This file is generated output and should not be
committed.

### Selector health

`tests/dom/selector-health.test.ts` runs with `npm test`. It checks every
code selector in `src/platform/dndbeyond/selectors.ts` against the saved
fixtures. A failure names the selector id, the selector string, the features
it breaks, what it targeted, and what to look for on the page. The usual fix
is one line in the selector map.

`tests/e2e/selector-health-live.spec.ts` is part of `npm run test:e2e` and
skips unless a sheet URL is set. Point it at the reference character,
Matilda Greywolf:

```text
BFA_LIVE_CHARACTER_SHEET_URL="https://www.dndbeyond.com/characters/172153137" \
BFA_LIVE_SHEET_THEME=light \
BFA_LIVE_STORAGE_STATE=path/to/storage-state.json \
npx playwright test tests/e2e/selector-health-live.spec.ts
```

`BFA_LIVE_SHEET_THEME` is `light` or `dark`. Set `dark` when Underdark Mode is
on (Manage, then Character Settings). `BFA_LIVE_STORAGE_STATE` is a Playwright
[storage state](https://playwright.dev/docs/auth) from a logged-in D&D Beyond
session. Without it the check hits the sign-in page.

`tests/e2e/sidebar-parity-live.spec.ts` uses the same URL gate. It opens a
native pane and the journal note on that sheet and reports the element and
property that drifted from `docs/ddb-reference/sidebar.json`. The DOM test
`tests/dom/sidebar-parity.test.ts` checks the note panel's class tree against
that file without a network.

The sheet's layout and the screenshots live in
[docs/ddb-reference/README.md](ddb-reference/README.md). Read that instead of
opening the live site for anything other than this check.

### Storage tests

When full-art storage is implemented:

- create, read, replace, and delete,
- failed replacement preserves prior art,
- metadata and Blob consistency,
- schema migration,
- quota and write failure behavior,
- invalid image rejection.

### Manual browser tests

Automated tests cannot prove that private D&D Beyond DOM and endpoints still match assumptions. Every release touching an adapter requires live manual validation.

## Backup folder manual checklist

1. Build the extension and reload it.
2. Open the toolbar popup and choose **Choose folder**.
3. Confirm a separate window opens, and that choosing a folder which already has files is refused. The browser's stored art is unchanged.
4. Create a new empty folder and choose it. Confirm the folder now contains `beyond-full-art.json` and a `characters` directory.
5. Reopen the popup and confirm it names that folder. **Forget folder** removes the connection and leaves the files in place.
6. Choose the same folder again and confirm it reconnects without a second marker.
7. If the folder is inside Google Drive for Desktop, confirm Drive shows the marker and the `characters` directory.
8. With art or notes still in this browser, choose that empty prepared folder again. Accept the prompt to copy, then accept the prompt to remove this browser's copies. Confirm the folder contains `characters/<character id>/character.json` and the note and photo files.
9. Reload the extension, reopen the popup, and confirm it says art and notes are saved in that folder. The inventory should list the same character. Reload the sheet and confirm the portrait and journal still open.
10. Save a new journal note and confirm the note file appears under that character in the folder, and that this browser's extension storage no longer holds the note text.
11. If the copy is already in the folder and this browser still has its copies, open **Choose folder** again and accept the prompt to remove the browser copies. Declining leaves those copies in place.
12. With the folder as the library, delete a journal note that contains a photo. Confirm its note JSON is removed and a note tombstone appears under `journal/tombstones/`. The photo file remains under `journal/images/`, `journal/photos.json` still names it, and Journal Photos still shows it. No image tombstone is written for that delete.
13. Reload the sheet and confirm the deleted note stays absent. If another browser still has the note, reconnect it through setup and confirm the conflict screen can leave it deleted or restore it explicitly.
14. Add a different note in this browser while the prepared folder contains another note. Reopen setup, confirm **Add records and use folder**, then confirm both notes remain in the folder and the browser copies are removed only after the files check.
15. Place `note-id (1).json` beside a managed note file. Setup should report the Drive conflict copy without parsing or deleting it.
16. While the folder is the library, choose a different prepared folder and decline the switch confirmation. Confirm the original folder name remains connected and no files move.
17. Create different bodies for the same note ID in the browser and folder. Reopen setup and confirm Apply stays disabled until a choice is selected. Test Keep folder, Keep browser, and Keep both; Keep both must create an ` (other computer)` note.
18. For a tombstoned note or full-art record that still exists in this browser, test Leave deleted and Restore.
19. Create different full-art or crop bytes with the same record on each side. Confirm setup requires a choice, makes the chosen image current, and leaves the other bytes in a timestamped `kept` file listed with a SHA-256 in `character.json`. Then create different photo bytes under the same photo ID. Confirm setup offers Keep both, the newer owning note keeps the original photo ID, the other photo receives a new ID, and both retained notes render their own photo.
20. While the folder is the library, click **Check folder** in the popup. Confirm its status shows the check time, newest folder change, saved-character count, and any Drive conflict-copy count, and that Stored content refreshes.
21. Open a Journal note, make an unsaved edit, then change that note from another computer and let Drive finish. Click the **Sync folder** icon beside **New Note** in the Journal. Confirm the draft remains visible and the newer-folder warning offers Save, Discard draft, and Keep both. Save is refused while stale. Discard draft loads the folder note. Keep both creates an ` (other computer)` note with independent photo IDs, then loads the folder note.
22. Open D&D Beyond's portrait manager so the extension loads current full art. Replace the folder's full-art file through the other computer, let Drive finish, then try to commit a different portrait from the already-open manager. Confirm the extension refuses the save and keeps the newly selected portrait pending.
23. On a browser that restores the folder handle as `prompt` (Brave does this), the popup says the folder is selected and access is still needed. Click **Choose folder** and allow access. Confirm the directory picker can stay closed, the popup says art and notes are saved in that folder, and the sheet reads those files. Nothing is copied into this browser.
24. Change a popup toggle and a companion checkbox, then open the same folder in another browser and allow access. Those choices match. `settings.json` is the only new file at the folder root.

## Full-art storage manual checklist

1. Build the extension.
2. Load the unpacked build directory in Chrome.
3. Open a D&D Beyond character sheet with no stored full art.
4. Open D&D Beyond's portrait-management UI from the right sidebar and choose a valid PNG, JPEG, or WebP image smaller than `3 MB`.
5. Without clicking `Change Portrait`, refresh the page and confirm the prior stored full art is unchanged.
6. Repeat the flow, then click D&D Beyond's native `Change Portrait`.
7. Confirm the extension reports that the portrait was saved locally as full art.
8. Confirm the stored full art opens in the fullscreen viewer.
9. Reload the page and confirm the stored art still resolves.
10. Restart Chrome and confirm the stored art still resolves.
11. Upload another portrait and confirm the stored full art is replaced only after `Change Portrait` is clicked.
12. Use `Remove stored full art` and confirm the viewer falls back to the D&D Beyond portrait.
13. Repeat the same upload flow from the character builder portrait modal.
14. Try an unsupported or oversized file and confirm the error is clear and the prior stored art is preserved.

## MVP manual checklist

1. Build the extension.
2. Load the unpacked build directory in Chrome.
3. Open a D&D Beyond character sheet.
4. Click the top-left portrait and confirm D&D Beyond's panel still opens normally.
5. Confirm the portrait in that panel has a visible interactive affordance.
6. Click it and confirm the overlay opens with the expected image.
7. Confirm the image fits in landscape and portrait browser windows.
8. Close with Escape.
9. Reopen and close with the close button.
10. Reopen and close with the backdrop.
11. Confirm clicking the image itself does not close the viewer.
12. Confirm focus returns to the portrait.
13. Repeat open and close at least five times and inspect for duplicate overlays.
14. Navigate between character pages without a full browser restart.
15. Confirm the extension does nothing on unrelated D&D Beyond pages.

## Character card portrait manual checklist

1. Build the extension.
2. Load the unpacked build directory in Chrome.
3. Open the extension popup and confirm `Sharper card portraits` is enabled.
4. Open a D&D Beyond campaign page and confirm character-card portraits become sharper after render.
5. Open `https://www.dndbeyond.com/characters` and confirm My Characters card portraits become sharper after render.
6. While the cards upgrade, confirm each in-progress portrait gets a subtle red pulse and each completed portrait briefly flashes green.
7. If a card needs diagnosis, inspect its `data-bfa-card-portrait-state` and `data-bfa-card-portrait-reason` attributes; skipped cards should not keep a visible outline during normal use.
8. Disable the popup setting and refresh both pages.
9. Confirm the card portraits remain at D&D Beyond's original small image URLs.

## Character journal manual checklist

Build the extension, reload it in `chrome://extensions`, and check these on a
live sheet. The visual source is Matilda Greywolf,
`https://www.dndbeyond.com/characters/172153137`: the Journal tab and section
sit with Notes and Extras, and the note panel matches that sheet's right pane.
Switch Appearance under Manage, then Character Settings. Do not judge the
journal by the operating system's theme.

1. Journal is the uppercase tab after Extras. One pointerdown on the label and on the padding opens it. The previous tab is not underlined, including when the sheet loaded on Actions. Selected Journal has the same single underline as a selected sibling tab.
2. The list replaces the main pane. It is not inside a nested scroller.
3. Light and Underdark, including a toggle while Journal is open. The toolbar matches the Extras search row. Fields stay dark in Underdark. Extras content is not visible inside Journal.
4. New Note creates one note in the sidebar. There is no second File note control. Reload. The note is still there.
5. Open an entry, read it, edit it, reload. The markdown survived.
6. Create `[[Someone new]]` from autocomplete. The placeholder shows Needs details and appears under Mentioned in on the note that named them.
7. Add a PNG under 3 MB at the cursor with Image, then Upload photo. The editor shows `![[img:<id>]]` there, and read mode shows the image inline. Move that line and the image follows. A file over 3 MB is resized and the note text remains. A file over 25 MB shows the size and the limit, and the note text remains. Image also offers From photos. Notes is selected when Journal opens, and Photos sits above the search row. Remove from note leaves the photo in Photos. Delete photo names the notes that use it, removes it from those notes, and leaves the notes.
8. Unsaved edit, switch to Spells, choose to keep editing. The confirm was on screen. The draft is still there.
9. Turn the popup setting off, keep editing, then close. The Journal tab leaves.
10. If the live sheet can change character without a reload, a note in progress does not appear on the next character.
11. A narrow window: the toolbar stays one row, the panel covers the screen, and Close in the pane chrome returns to the list.
12. Keyboard only: open Journal, open a row, Edit, Close. Focus returns to the row. Tab never lands on an invisible file input.
13. A version 1 note and photo created before the upgrade are present once, with the text intact.
14. From the popup, export all journals. Open the ZIP and confirm each character ID has title-named Markdown notes and original-filename photos, plus root `backup.json`.
15. After export, create a disposable note, then import the ZIP. Confirm the disposable note remains and backed-up notes are not duplicated. Delete one backed-up note, import again, and confirm it and its photos return.
16. Edit a backed-up note after export, then import the older ZIP. Confirm the newer local edit wins. Import from a character row and confirm only that character is accepted.

Automated coverage for the simple fixture is `tests/e2e/character-journal.spec.ts`. The live-shaped sheet, first click, theme, and scroll coverage is `tests/e2e/character-journal-sheet.spec.ts`. Build screenshots are `tests/e2e/character-journal-build-shots.spec.ts`. None of them open the live site.

## Companion portrait manual checklist

Use Matilda Greywolf and Petali for the first visual pass. Build the extension,
reload the unpacked build, and refresh the character sheet before starting.

1. Confirm **Companion portrait** is enabled in the popup.
2. Open **Extras** and confirm Petali has one small checkbox over the bottom-right of the Extra portrait.
3. Confirm Matilda's header portrait is enlarged with a small gap before her name. Select Petali and confirm the companion scales with it and its border matches Matilda's sheet theme color without moving the name or level.
4. Click the native character portrait and the Extra row outside the checkbox; both native interactions should still work.
5. Switch Extras filters, another sheet tab, and back. Confirm there is still only one checkbox and one overlay.
6. Refresh without opening Extras first. The saved overlay should appear from local metadata.
7. Turn the popup setting off and on. The controls and overlay should hide and return while the selection remains saved.
8. Test light and Underdark appearance and a narrow window. The portrait should stay square, legible, and out of the way.
9. If another character has multiple Extras, select each in turn and confirm only one is checked and displayed.
10. If an Extra portrait cannot load, confirm no broken-image icon remains and the saved choice can recover when Extras mounts again.
11. Click Petali's overlay and confirm Petali's native D&D Beyond sidebar opens. Repeat with keyboard focus and Enter.

## Character copy manual checklist

Use a disposable character that already has a journal note and a photo. Reload the unpacked extension and refresh My Characters before starting. Live capture on 2026-10-29 observed `POST https://character-service.dndbeyond.com/character/v5/character/copy`, a JSON `characterId`, status 200, and the new character id in response `id`.

1. Copy that character from My Characters. The dark box should ask **Copy stored journal?** Choose **Copy journal**. The new character's journal should contain the note and the photo, and the original character's journal should be unchanged.
2. Delete one of the two characters and confirm the cleanup. The other character's journal and photos should still be there.
3. Copy a character that has no journal. No box should appear.
4. Copy a character onto one that already has a journal, if D&D Beyond allows it. The existing journal should stay, and nothing should be overwritten.
5. Open the box and press Escape. The new character should have no copied journal.
6. If the box never appears, the extension did not recognize the copy request. Keep the DevTools request and adjust the matcher from that capture.

## Delete cleanup manual checklist

Use a disposable character and disposable full art. Reload the unpacked extension before starting. The request shape was last observed on 2026-08-06; confirm it in DevTools on the first live delete.

1. Create disposable test characters and disposable local artwork. If the character also has a journal note or photo, D&D Beyond's "Delete this character?" box says to export them first, and the later cleanup dialog says the same and offers **Export**. Export downloads the journal zip and leaves the dialog open. A character with only full art does not show that line or the Export button. A character with a journal and no full art asks **Delete stored journal?** Deleting from the character sheet leaves the page; the cleanup dialog should appear on the page that opens next. After **Delete journal** or **Delete art**, that character's `characters/<character id>` folder is gone from the backup folder, and the same character is gone from this browser. Other character folders remain. The character no longer appears in the popup inventory.
2. Verify the exact request in DevTools.
3. Test `ask`, `delete`, and `keep` preferences.
4. Test `Remember my decision` with both buttons.
5. Force a failed request if practical and confirm art is preserved.
6. Delete two characters in quick succession and verify IDs do not cross.
7. Confirm no prompt appears when a character has no stored art and no journal.
8. Confirm resetting the preference returns behavior to `ask`.

## Crop workflow manual checklist

When Phase 3 is implemented:

1. Save full art through D&D Beyond's existing portrait upload flow.
2. Confirm `Crop portrait` appears in the portrait-management surface.
3. Open the crop workflow and confirm the stored full art loads into the crop editor.
4. Drag and zoom the artwork and confirm the preview updates.
5. Apply the crop and confirm D&D Beyond receives the generated portrait.
6. Reopen the crop workflow and confirm `Edit portrait crop` appears.
7. Replace the stored full art and confirm the prior crop is invalidated.
8. Confirm the fullscreen viewer still uses the original full art rather than the cropped portrait.

## Release gate

A change is not complete until:

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
```

all pass, and the relevant manual checklist has been recorded in the pull request or release notes.
