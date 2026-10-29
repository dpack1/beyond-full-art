# Implementation Plan

## Phase 0, repository scaffold

Deliverables:

- Manifest V3 project.
- Strict TypeScript configuration.
- Small bundling setup.
- Build, watch, typecheck, and test scripts.
- Load-unpacked instructions.
- No unnecessary permissions.

Exit criteria:

- A clean build creates a loadable extension directory.
- Tests and typecheck pass.

## Phase 1, fullscreen portrait viewer MVP

### Work items

1. Parse D&D Beyond character sheet URLs and extract character IDs.
2. Research the live character panel DOM.
3. Build a D&D Beyond portrait adapter with centralized selectors.
4. Observe delayed panel rendering and client-side navigation.
5. Enhance the right-side portrait idempotently.
6. Build the accessible fullscreen overlay.
7. Add focus management, Escape handling, backdrop handling, and teardown.
8. Add unit and DOM fixture tests.
9. Document manual browser validation.

### Exit criteria

- Clicking the right-side panel portrait opens the current image fullscreen.
- Existing D&D Beyond interactions still work.
- Opening and closing repeatedly causes no duplicate overlays or listeners.
- Keyboard behavior passes manual validation.
- Build, tests, and typecheck pass.

## Phase 2, original full-art upload and local storage

Record further design changes in `docs/DECISIONS.md` before expanding this phase.

Current implementation slice:

- passive observation of D&D Beyond portrait-upload file selection,
- local full-art persistence after D&D Beyond's native portrait confirmation,
- extension-origin IndexedDB image storage with `chrome.storage.local` metadata,
- stored full-art resolution before the D&D Beyond portrait in the viewer,
- embedded status, crop, and delete controls in observed portrait-management surfaces,
- fullscreen-viewer download for the currently stored full art, using the stored filename when available,
- popup inventory for locally stored full art with per-item open, download, and delete actions,
- popup backup-folder setup for one empty directory, or a directory this extension already prepared, plus a confirmed copy and a verified switch so later art and notes are saved in that folder,
- durable folder tombstones for deleted art, crops, notes, and journal photos, including explicit conflict restore,
- a read-only folder comparison engine for matches, additions, changed records, tombstones, and unopened Drive conflict siblings,
- setup union for non-conflicting additions, with post-write verification before browser cleanup, and confirmation before switching an active library folder,
- conflict review with complete-choice gating: notes support keep-folder, keep-browser, keep-both, deleted, and restore; full art and crops preserve rejected bytes as checked `kept` files; photo conflicts preserve both versions and remap the losing photo and note references,
- popup folder checks and the Journal sync action, dirty-draft preservation and Keep both, note `updatedAt` guards, and full-art loaded-SHA guards,
- optional sharper character-card portrait URLs on campaign pages and the My Characters page,
- focused unit, DOM fixture, and local Playwright fixture coverage.

### Research spike

- Validate a safe large-file transfer path from content UI to extension-origin IndexedDB.
- Measure realistic artwork sizes.
- Decide file types and size limits.
- Decide whether to preserve exact original bytes or normalize images.
- Verify behavior when extension quota or disk space is exhausted.

### Work items

1. Integrate with D&D Beyond's portrait-management upload UI and associate that upload with the current character ID.
2. Validate selected files.
3. Persist the image Blob in extension-origin IndexedDB.
4. Persist metadata in `chrome.storage.local`.
5. Resolve stored full art before the D&D Beyond portrait in the viewer.
6. Add embedded status and delete controls in the portrait-management surface.
7. Add clear errors that preserve existing art on failed replacement.
8. Add storage schema versioning and migration tests.
9. Add per-character stored-art download from the fullscreen viewer.
10. Add popup inventory for locally stored full art.

### Exit criteria

- Full artwork survives browser restart and normal cache/history clearing.
- Artwork is removed when the extension is uninstalled.
- Failed replacement does not destroy the prior image.
- No image bytes are stored in page-origin storage.
- Stored full art can be downloaded by the user from the fullscreen viewer without requesting Chrome's `downloads` permission.
- Stored full art can be found, opened on D&D Beyond, downloaded, and deleted from the extension popup.

## Phase 3, crop workflow

Record further design changes in `docs/DECISIONS.md` before expanding this phase.

Current implementation slice:

- extension-owned crop dialog,
- stored full art as the crop source,
- separate local portrait-crop blob and metadata,
- handoff through D&D Beyond's existing portrait upload input.

Remaining work:

- validate the upload-input handoff on the live site across supported surfaces,
- decide whether an explicit assisted fallback is needed,
- refine crop UX and any persisted revision behavior based on live testing.

## Phase 4, deletion cleanup prompt

Implemented 2026-10-28. The service worker correlates a character-service DELETE with HTTP 200 or 204. The 2026-08-06 headers screenshot shows 200 OK. A decoded request body supplies the character id. A characters-page observer supplies it only when exactly one successful DELETE on that tab is waiting for an id. The prompt covers full art and journal data, and **Export** downloads that journal without closing the dialog. Confirming delete removes that character's `characters/<character id>` folder and the copy on this browser. A sheet delete navigates away, and the next page in that tab shows the dialog. The live checklist in `docs/TESTING.md` still needs a successful pass.

### Work items

1. Narrow delete-request adapter.
2. Candidate character ID captured without blocking or modifying the request.
3. Candidate data correlated with successful completion.
4. Local art check.
5. Global cleanup preference: `ask`, `delete`, or `keep`.
6. Two-action cleanup dialog with `Remember my decision`.
7. Popup control to reset cleanup behavior to `ask`.
8. Tests for decoding, request correlation, preference transitions, and failures.

### Exit criteria

- Failed D&D Beyond deletions never remove local art.
- Unknown or malformed character IDs never remove local art.
- The prompt appears only when relevant local art exists.
- Remembered decisions apply consistently.
- The user can reset the remembered preference.

## Character copy, journal duplication

Implemented 2026-10-29. The characters page asks before duplicating notes and photos onto the new character id. Live capture verified `POST /character/v5/character/copy`, a JSON `characterId`, and a top-level response `id`. A folder-backed journal note was successfully duplicated onto the new character in live QA. The checklist is in `docs/TESTING.md`.

## Phase 5, character journal

Record further design changes in `docs/DECISIONS.md` before expanding this phase.

Current shipped beta implementation (version 2):

- extension-owned `Journal` tab inserted after D&D Beyond's `Extras` tab,
- popup preference to enable or disable the inserted Journal tab,
- compact title-and-created-date rows, with popup preferences for updated
  dates, text previews, and image thumbnails,
- journal list in the sheet content region, beside the tab strip,
- right-hand note panel on `document.body`, responsive up to 400px wide, close and back in the edge chrome, theme color sampled from the sheet,
- local markdown notes keyed by D&D Beyond character ID, schema version 2,
- one-way migration from version 1 with a backup that is not overwritten,
- image bytes in extension-origin IndexedDB,
- ZIP export from the popup, with Markdown notes, photo files, and raw versioned recovery data,
- popup import for all journals or one matching character, merging supported notes without replacing newer local versions,
- the Extras search row (magnifier, field, funnel, New Note) on one line, `[[Name]]` links, and autosave,
- unit, DOM fixture, and Playwright coverage.

### Exit criteria

- The `Journal` tab appears immediately after `Extras` when the tab row is
  present.
- D&D Beyond's original tabs continue to work.
- The Journal tab shows inline content and restores native sheet content when
  the user selects another native tab.
- Entries persist after page refresh and are character-specific.
- The extension popup can disable the Journal tab and re-enable it without
  deleting entries.
- Failed saves preserve unsaved text in the editor.
- Failed deletes preserve the entry.
- Journal data is never written to page-origin storage.
- Hiding previews or thumbnails never removes note content from search.

## Phase 6, companion portrait from Extras

Record further design changes in `docs/DECISIONS.md` and keep
`.agent/plans/extras-images.md` current while this phase is unshipped.

Current implementation slice (manual browser QA pending):

- live-verified header and Extras selectors in the central selector map,
- typed Extras-row and character-header adapter,
- validated per-character selection metadata and enabled preference,
- accessible Extras checkboxes with one active companion per character,
- keyboard-accessible bottom-right overlay that opens the native Extra sidebar,
- popup toggle that retains the saved selection,
- unit, DOM, selector-health, popup, and local Playwright fixture coverage.

### Research spike

- Capture the live DOM for an Extras row and the character-header portrait.
- Verify a stable Extra identity and the rendered image source.
- Verify row remount behavior under tab changes, search, filters, and route
  changes.
- Add only verified hooks to the selector map and saved fixtures.

### First-slice work items

1. Build a typed D&D Beyond adapter for Extras companion rows and the header
   portrait.
2. Add a versioned, per-character companion selection record and a global
   enabled preference in `chrome.storage.local`.
3. Inject accessible checkboxes into Extras rows with usable images and enforce
   one selected companion per character.
4. Render a bottom-right portrait overlay whose isolated click/keyboard target
   opens the selected Extra's native sidebar.
5. Add a popup setting that hides or restores the controls and overlay without
   deleting the selection.
6. Reconcile selection and UI across row remounts, storage changes, image
   failures, and client-side character navigation.
7. Add selector health, storage, DOM, popup, and Playwright fixture coverage.

### Exit criteria

- A selected companion remains visible after refresh without opening Extras.
- Selecting, replacing, and clearing the companion are character-specific.
- Disabling and re-enabling the popup setting retains the selection.
- No duplicate controls or overlays appear after Extras remounts.
- Native portrait clicks and Extra-row interactions continue to work.
- Missing identities, image-less rows, malformed storage, and failed images
  fail safely without modifying D&D Beyond data.
- Typecheck, unit/DOM tests, build, fixture E2E, and the logged-in selector
  check pass.

Companion name, stats, hit points, and controls under the character identity
bar are a separate follow-up after this phase's DOM and selection contracts
are proven.
