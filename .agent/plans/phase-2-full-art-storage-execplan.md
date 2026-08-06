# Phase 2 Full-Art Upload and Local Storage

## Goal
Ship the first non-MVP product slice: a user can upload one original full-art image for a D&D Beyond character, keep that image locally in extension-owned storage, and have the existing fullscreen viewer open the stored full art instead of the cropped D&D Beyond portrait when available.

## Scope
Included:

- Integrate with D&D Beyond's portrait-management upload flow for the current character.
- Add one active stored full-art image per character ID.
- Persist full image bytes in extension-origin IndexedDB.
- Persist metadata and small preferences in `chrome.storage.local`.
- Resolve stored full art before falling back to the live D&D Beyond portrait.
- Add explicit delete controls and replacement through later portrait uploads.
- Preserve the previous stored art when a replacement attempt fails.
- Add validation, storage, and migration tests for the new data path.
- Update docs, permissions, and architecture decisions to match the implementation.

Excluded:

- Character-deletion cleanup prompts and remembered cleanup preferences.
- Any use of page-origin Web Storage or page-origin IndexedDB.
- Portrait cropping or D&D Beyond portrait replacement.
- Cloud sync, export, backup, or multi-image galleries.
- Automatic image resizing or compression unless the implementation spike proves it is required.
- Broad permissions such as `webRequest` or `unlimitedStorage`.

## Current state
Phase 1 is complete on top of a small MV3 scaffold:

- `manifest.json` loads a single content script on D&D Beyond character pages.
- `src/content/character-sheet.ts` enhances the right-side portrait and opens the fullscreen viewer.
- `src/features/fullscreen-viewer/` contains the accessible overlay and focus management.
- `src/platform/dndbeyond/` contains the URL and DOM adapter logic.
- The build, typecheck, and test pipeline is in place.

There is currently no background service worker, no extension storage permission, no message contract, and no extension-owned persistence layer.

## External assumptions
- Chrome MV3 still permits the required combination of `chrome.storage.local`, runtime messaging, and extension-owned IndexedDB access in the chosen extension context.
- The current D&D Beyond character-page URL shape remains a reliable source of the character ID.
- The current D&D Beyond portrait-management UI remains a viable place to observe file selection and surface local-art status without blocking normal D&D Beyond behavior.
- Structured-clone transfer of `File`, `Blob`, or `ArrayBuffer` payloads from the content script to an extension context is reliable enough for the target artwork sizes.
- Browser quota and IndexedDB failure behavior can be detected and surfaced clearly enough to preserve existing user data.

Verification plan:

- Validate the actual file-transfer path before committing to a storage architecture.
- Measure the behavior of representative uploads at a few realistic sizes.
- Verify the chosen portrait-management entrypoints against the live sidebar and builder DOM before locking selectors.
- Confirm that stored art survives browser restart and ordinary cache/history clearing.
- Confirm that uninstalling the extension removes stored art, matching the product docs.

## Approach
Phase 2 should stay conservative and explicit. The user’s original artwork is now the highest-risk asset in the product, so data handling must be narrow, recoverable, and easy to inspect.

### Proposed architecture additions

Add the following real modules only when each owns working behavior:

```text
src/
  background/
    service-worker.ts
  content/
    character-sheet-entry.ts
    character-sheet.ts
  features/
    character-art/
      upload-control.ts
      art-service.ts
      art-types.ts
    fullscreen-viewer/
      viewer.ts
      focus.ts
      viewer.css
  platform/
    chrome/
      messages.ts
      storage.ts
      indexed-db.ts
    dndbeyond/
      portrait-adapter.ts
      portrait-manager-adapter.ts
      selectors.ts
      urls.ts
  shared/
    dom.ts
    result.ts
    types.ts
```

### Storage boundary

- `chrome.storage.local` stores metadata, schema version, and small settings.
- extension-origin IndexedDB stores the image `Blob`.
- The content script never writes extension data into page-origin storage.

### Likely data model

Keep the current product assumption of one active image per character:

```ts
type CharacterId = string;

interface CharacterArtMetadata {
  characterId: CharacterId;
  blobKey: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}
```

### File-transfer spike

Do not decide the final storage writer blindly. Validate one of these two options first:

1. Content script gathers a `File`, validates it, and sends a structured-clone payload to a service worker that writes IndexedDB and metadata.
2. Content script gathers a `File`, validates it, and transfers it to an extension-owned page or other extension context dedicated to IndexedDB access.

Preferred direction:

- Start by validating service-worker writes because it adds the least UI surface and fits the current small architecture.
- Reject it if large-file transfer or worker lifetime makes the implementation fragile.

### UI behavior

- Observe D&D Beyond's existing portrait-upload file input rather than adding a separate extension-owned file picker.
- Surface extension-owned local-art status and a `Remove stored full art` action inside that same portrait-management UI.
- Do not delete or overwrite existing art until the new write path has succeeded completely.
- Reuse the existing fullscreen viewer entrypoint; only the resolved image source should change.
- Add clear user-facing errors when validation or storage fails.

### Validation defaults to start with

Use these as initial implementation defaults unless the spike disproves them:

- supported MIME types: `image/png`, `image/jpeg`, `image/webp`
- conservative initial size cap: `3 MB`, aligned to the observed D&D Beyond portrait upload UI
- preserve original bytes exactly
- no automatic preview generation in the first Phase 2 cut

## Milestones
- [x] Create the Phase 2 ExecPlan and start a dedicated feature branch.
- [x] Validate and choose the extension-context file-transfer path for storing large image bytes.
- [x] Add the minimum new permissions and MV3 wiring required for local metadata and Blob storage.
- [x] Implement typed message contracts and runtime validation at the content-script / extension-context boundary.
- [x] Implement IndexedDB Blob storage and `chrome.storage.local` metadata storage.
- [x] Add upload validation for MIME type, size, and character-ID association.
- [x] Integrate with D&D Beyond portrait-management UI without breaking existing behavior.
- [x] Update viewer source resolution to prefer stored art and fall back cleanly to the D&D Beyond portrait.
- [x] Add tests for create/read/replace/delete flows, failure recovery, and schema versioning.
- [x] Run `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Perform live manual browser validation for upload, restart persistence, replacement, deletion, and fallback behavior.

## Validation
Automated:

- `npm run typecheck`
- `npm test`
- `npm run build`

New unit coverage target:

- storage-key generation
- metadata serialization and schema versioning
- upload validation rules
- runtime message validation
- replacement-state transitions

New DOM coverage target:

- upload control insertion and idempotent enhancement
- replace/delete control visibility states
- viewer source selection priority
- error rendering that preserves current art

New storage coverage target:

- create/read/replace/delete for one character
- failed replacement keeps prior image and metadata intact
- metadata/blob consistency
- quota or write-failure handling
- migration from empty state to schema version 1

Manual browser validation:

1. Build and load the unpacked extension.
2. Open a D&D Beyond character sheet with no stored art.
3. Open D&D Beyond's portrait-management UI from the sidebar and upload a valid image.
4. Confirm the extension reports that the portrait was saved locally as full art.
5. Open the viewer and confirm the stored full art is shown instead of the cropped portrait.
6. Reload the page and confirm the stored art still resolves.
7. Restart Chrome and confirm the stored art still resolves.
8. Upload another portrait and confirm the new image appears.
9. Force a failed replacement if practical and confirm the previous art remains intact.
10. Delete the stored art and confirm the viewer falls back to the D&D Beyond portrait.
11. Repeat the upload flow from the builder portrait modal.
12. Validate an oversized or unsupported file and confirm the error is clear and no previous art is lost.
13. Confirm unrelated D&D Beyond pages remain unaffected.

## Risks and rollback
Primary risks:

- The chosen transfer path for large files is unreliable in MV3.
- IndexedDB write failures could leave metadata and Blob state inconsistent.
- UI controls added to the sidebar could become brittle if D&D Beyond rerenders more aggressively than in Phase 1.
- Permission changes could expand the extension footprint more than the feature truly needs.

Data safety:

- Never delete existing stored art before the replacement write completes.
- On uncertainty, preserve both metadata and bytes rather than cleaning up aggressively.
- Keep one explicit storage owner and one explicit metadata owner to avoid split-brain state.

Rollback:

- Disable Phase 2 UI entrypoints while leaving Phase 1 viewer behavior intact.
- Revert the viewer source-resolution change to always use the live D&D Beyond portrait.
- If storage migration or write integrity proves unstable, drop back to the Phase 1 branch state rather than shipping partial persistence.

## Progress log
- 2026-08-06: Created branch `feature/phase-2-full-art-storage`.
- 2026-08-06: Drafted the Phase 2 ExecPlan from the existing product, architecture, implementation-plan, and current codebase state.
- 2026-08-06: Added MV3 `storage` permission and a background service worker to own local full-art persistence.
- 2026-08-06: Implemented typed runtime messages, IndexedDB Blob storage, `chrome.storage.local` metadata storage, and initial upload/delete controls.
- 2026-08-06: Automated validation passed with `npm run typecheck`, `npm test`, and `npm run build`.
- 2026-08-06: Refactored the Phase 2 UI to observe D&D Beyond's portrait upload flow in both the sidebar and builder modal instead of using a separate extension-owned upload picker.

## Decision log
- 2026-08-06: Phase 2 will continue the current “small explicit modules” approach rather than introducing a framework or generalized state layer.
- 2026-08-06: Treat the file-transfer path from content UI to extension-owned storage as the first implementation gate, not a detail to discover halfway through coding.
- 2026-08-06: Start from exact-byte preservation, conservative MIME support, and a single active image per character unless testing forces a narrower implementation.
- 2026-08-06: Use structured-clone transfer of `ArrayBuffer` data to the MV3 service worker instead of base64 encoding or page-origin storage.
- 2026-08-06: Use new blob keys for replacement writes so a metadata-write failure does not destroy the prior stored image.
- 2026-08-06: Piggyback on D&D Beyond's existing portrait upload input so the extension stays within the native portrait-management flow instead of introducing a second file picker.
