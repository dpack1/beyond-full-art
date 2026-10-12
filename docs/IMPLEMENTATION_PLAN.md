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

Create a new ExecPlan before beginning.

Current implementation slice:

- passive observation of D&D Beyond portrait-upload file selection,
- local full-art persistence after D&D Beyond's native portrait confirmation,
- extension-origin IndexedDB image storage with `chrome.storage.local` metadata,
- stored full-art resolution before the D&D Beyond portrait in the viewer,
- embedded status, crop, and delete controls in observed portrait-management surfaces,
- fullscreen-viewer download for the currently stored full art, using the stored filename when available,
- popup inventory for locally stored full art with per-item download and delete actions,
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
- Stored full art can be found, downloaded, and deleted from the extension popup.

## Phase 3, crop workflow

Create and maintain a dedicated ExecPlan before changing this phase further.

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

Create a new ExecPlan before beginning.

### Research spike

Validate the observed D&D Beyond delete request using the current Chrome version:

- method and URL,
- success status,
- request initiator,
- whether `chrome.webRequest.onBeforeRequest` exposes the JSON body for DELETE,
- whether a MAIN-world fetch/XHR observer is required as a fallback,
- behavior on retries or duplicate requests.

Do not ship automatic cleanup until the character ID and successful completion can be correlated reliably.

### Work items

1. Implement a narrow delete-request adapter.
2. Capture candidate character ID without blocking or modifying the request.
3. Correlate candidate data with successful completion.
4. Check whether local art exists.
5. Apply global cleanup preference: `ask`, `delete`, or `keep`.
6. Build the two-action cleanup dialog with `Remember my decision`.
7. Add a setting to reset cleanup behavior to `ask`.
8. Add tests for decoding, request correlation, preference transitions, and failures.

### Exit criteria

- Failed D&D Beyond deletions never remove local art.
- Unknown or malformed character IDs never remove local art.
- The prompt appears only when relevant local art exists.
- Remembered decisions apply consistently.
- The user can reset the remembered preference.
