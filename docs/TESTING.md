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
3. Open the extension popup and confirm `Improve character card portraits` is enabled.
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

1. Journal is the uppercase tab after Extras. One pointerdown on the label and on the padding opens it. The previous tab is not underlined, including when the sheet loaded on Actions.
2. The list replaces the main pane. It is not inside a nested scroller.
3. Light and Underdark, including a toggle while Journal is open. The toolbar matches the Extras search row. Fields stay dark in Underdark. Extras content is not visible inside Journal.
4. Manage Notes creates one note in the sidebar. There is no second File note or New note control. Reload. The note is still there.
5. Open an entry, read it, edit it, reload. The markdown survived.
6. Create `[[Someone new]]` from autocomplete. The placeholder shows Needs details and appears under Mentioned in on the note that named them.
7. Add a PNG under 3 MB. The row thumbnail and the panel both show it. A file over 3 MB is resized and the note text remains. A file over 25 MB shows the size and the limit, and the note text remains.
8. Unsaved edit, switch to Spells, choose to keep editing. The confirm was on screen. The draft is still there.
9. Turn the popup setting off, keep editing, then close. The Journal tab leaves.
10. If the live sheet can change character without a reload, a note in progress does not appear on the next character.
11. A narrow window: the toolbar stays one row, the panel covers the screen, and Close in the pane chrome returns to the list.
12. Keyboard only: open Journal, open a row, Edit, Close. Focus returns to the row. Tab never lands on an invisible file input.
13. A version 1 note and photo created before the upgrade are present once, with the text intact.

Automated coverage for the simple fixture is `tests/e2e/character-journal.spec.ts`. The live-shaped sheet, first click, theme, and scroll coverage is `tests/e2e/character-journal-sheet.spec.ts`. Build screenshots are `tests/e2e/character-journal-build-shots.spec.ts`. None of them open the live site.

## Delete cleanup manual checklist

When Phase 4 is implemented:

1. Create disposable test characters and disposable local artwork.
2. Verify the exact request in DevTools.
3. Test `ask`, `delete`, and `keep` preferences.
4. Test `Remember my decision` with both buttons.
5. Force a failed request if practical and confirm art is preserved.
6. Delete two characters in quick succession and verify IDs do not cross.
7. Confirm no prompt appears when a character has no stored art.
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
