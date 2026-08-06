# Phase 3 Crop Workflow

## Goal
Let a user preserve one original full-art image for a character while also creating a separate portrait crop for D&D Beyond, so the extension fullscreen viewer uses the original artwork and D&D Beyond can continue showing a tight portrait crop.

## Scope
Included:

- Define a distinct data model for original full art versus generated portrait crop.
- Build a crop workflow that starts from stored full art or another extension-owned source image.
- Provide an accessible crop UI with preview states that match D&D Beyond portrait usage closely enough to be useful.
- Decide and implement the safest supported handoff path for using the generated crop with D&D Beyond.
- Preserve existing stored full art unless a new original image is explicitly saved successfully.
- Add tests for crop math, storage behavior, and user-facing workflow states.
- Update docs and architecture notes for any new storage shape, UI surfaces, or D&D Beyond assumptions.

Excluded:

- Character-deletion cleanup prompts and remembered cleanup preferences.
- Cloud sync, export catalogs, or multi-image galleries.
- Automatic cleanup of prior stored crops unless replacement succeeds safely.
- Blind use of undocumented private D&D Beyond endpoints.
- Broad new permissions unless a validated implementation path actually requires them.

## Current state
Phase 2 is complete:

- The extension passively observes D&D Beyond's portrait upload input in the sheet sidebar and builder modal.
- The selected upload file is saved locally as one stored full-art image per character.
- Full image bytes live in extension-origin IndexedDB.
- Metadata lives in `chrome.storage.local`.
- The fullscreen viewer prefers stored art and falls back to the D&D Beyond portrait.
- Users can remove stored full art from the viewer.

Current limitation:

- The same selected file effectively serves as both the D&D Beyond portrait source and the extension's stored full art.
- There is no separate crop artifact, crop editor, or extension-owned portrait-generation workflow.

## External assumptions
- D&D Beyond's existing portrait-management UI remains available in both the sheet sidebar and builder modal.
- The current character ID extracted from D&D Beyond URLs remains the correct stable local key for both original art and crop artifacts.
- Browser image APIs (`CanvasRenderingContext2D`, `createImageBitmap`, `Blob`, object URLs) are sufficient for generating a portrait crop locally in a content-script or extension-owned context.
- The generated portrait crop can be handed back to D&D Beyond only through a path that is either:
  - clearly supported by current browser behavior and D&D Beyond's existing upload UI, or
  - explicit user-assisted flow that does not pretend to automate D&D Beyond.
- The crop aspect ratio and output size needed for a good D&D Beyond portrait can be inferred or validated from the live site.

Verification plan:

- Re-verify the current portrait-management DOM in both the sheet sidebar and builder modal.
- Inspect D&D Beyond portrait rendering to determine practical crop aspect ratio and preview sizes.
- Validate whether a generated `File` can be fed into D&D Beyond's current portrait-upload path through supported browser behavior.
- If not, validate a user-assisted handoff path before implementation scope is locked.
- Verify crop quality and browser performance on representative large artwork.

## Approach
Phase 3 should separate concerns explicitly:

- original full art is the user-owned source asset,
- portrait crop is a derived asset,
- D&D Beyond portrait handoff is an integration concern that must be validated independently.

### Recommended product direction

Treat the stored original full art as the canonical source for cropping. A user should not need to re-upload the same source image repeatedly once it is stored locally.

Preferred workflow:

1. User stores or already has original full art for a character.
2. User opens a crop workflow from the portrait-management surface.
3. Extension loads the stored original art into an extension-owned crop editor.
4. User positions and scales the crop.
5. Extension generates a portrait-crop image locally.
6. Extension either:
   - hands the generated crop into D&D Beyond through a validated supported upload path, or
   - presents the crop through an explicit user-assisted step if direct handoff is not reliable.
7. Extension keeps the original full art and stores enough metadata to reopen or revise the crop later.

### Decision gate: D&D Beyond handoff

Do not commit to the rest of the workflow until one of these paths is validated:

1. **Supported upload-path handoff**
   - The extension can generate a crop file and pass it into the existing D&D Beyond upload workflow without private endpoints and without breaking normal page behavior.
   - This is the preferred path.

2. **User-assisted handoff**
   - The extension generates the crop locally, previews it, and clearly guides the user through applying it in D&D Beyond with minimal friction.
   - This is acceptable if direct handoff proves unreliable.

3. **Private-endpoint automation**
   - Explicitly disallowed unless later research proves it is stable, acceptable, and worth the maintenance risk.

### Data model direction

The current implementation keeps Phase 2 full-art metadata intact and adds a separate portrait-crop metadata record keyed by the same character ID.

Why:

- it avoids a risky rewrite of existing full-art metadata,
- it keeps original full-art behavior stable while Phase 3 is introduced,
- it makes stale-crop invalidation explicit when the source full art changes.

### Storage direction

- Keep full image bytes in extension-origin IndexedDB.
- Store generated crop bytes in extension-origin IndexedDB as a separate blob.
- Store crop metadata and revision linkage in `chrome.storage.local`.
- Use schema migration logic so existing Phase 2 users with only full-art metadata upgrade safely.

### UI direction

Add crop workflow UI only where it helps the existing D&D Beyond mental model:

- entrypoint from the portrait-management area,
- extension-owned crop editor dialog or panel,
- live crop preview sized for D&D Beyond portrait use,
- clear apply/cancel actions,
- explicit status when the crop was generated but not yet applied to D&D Beyond.

The crop editor should remain extension-owned DOM and should not attempt to restyle or replace D&D Beyond's editor UX.

### Technical direction

Keep the code organization explicit:

```text
src/
  features/
    crop-workflow/
      crop-controller.ts
      crop-dialog.ts
      crop-canvas.ts
      crop-math.ts
      crop-types.ts
  platform/
    dndbeyond/
      portrait-manager-adapter.ts
      selectors.ts
```

Recommended boundaries:

- crop math and geometry stay pure and well-tested,
- canvas/image rendering is isolated from DOM control logic,
- D&D Beyond selectors and handoff assumptions stay in the D&D Beyond adapter,
- storage migration stays separate from crop UI behavior.

## Milestones
- [ ] Re-verify the live portrait-management DOM in both supported D&D Beyond surfaces.
- [ ] Validate the safest D&D Beyond portrait handoff path and reject unsupported assumptions early.
- [ ] Decide the crop output aspect ratio and baseline export size from live-site evidence.
- [x] Choose a safe data-separation model for original full art versus portrait crop.
- [x] Implement crop math and image-generation utilities with focused tests.
- [x] Implement extension-owned crop UI with keyboard access and clear cancel/apply behavior.
- [x] Store generated crop artifacts separately from original full art.
- [x] Integrate the validated handoff path into D&D Beyond's portrait-management flow.
- [ ] Add user-facing status and failure handling that preserves both original art and prior crop data.
- [ ] Add automated tests for crop math, migration, replacement, and failure recovery.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Perform manual browser validation for crop creation, revision, replacement, and D&D Beyond handoff behavior.

## Validation
Automated:

- `npm run typecheck`
- `npm test`
- `npm run build`

New unit coverage target:

- crop-rectangle normalization
- zoom and pan math
- output-dimension calculations
- schema migration from Phase 2 metadata
- source-revision invalidation rules

New DOM coverage target:

- crop dialog open/close lifecycle
- keyboard-accessible controls
- preview updates after crop changes
- apply/cancel flows
- error states that preserve prior data

New storage coverage target:

- create and replace generated crop blob
- preserve original full art on crop-generation failure
- preserve prior crop on failed replacement
- metadata/blob consistency after migration

Manual browser validation:

1. Load a character with stored full art and open the crop workflow.
2. Confirm the original artwork loads into the crop editor at usable quality.
3. Change crop position and scale and confirm the preview updates correctly.
4. Apply the crop and confirm the original full art remains unchanged in the viewer.
5. Confirm the generated crop is either applied to D&D Beyond through the validated handoff path or surfaced through the explicit assisted flow.
6. Reopen the workflow and confirm the prior crop state can be revised or replaced.
7. Replace the original stored full art and confirm stale crop state is either invalidated or intentionally migrated.
8. Force a crop-generation failure if practical and confirm previous stored data remains intact.
9. Repeat the flow from both the sheet sidebar and the builder modal.
10. Confirm unrelated D&D Beyond pages remain unaffected.

## Risks and rollback
Primary risks:

- There may be no reliable supported way to feed a generated crop back into D&D Beyond automatically.
- Crop UI complexity can sprawl quickly if aspect-ratio rules and preview states are not constrained early.
- Large image rendering may cause memory or responsiveness issues on lower-powered systems.
- Schema migration from Phase 2 may risk user data if original and derived assets are not clearly separated.

Data safety:

- Never overwrite the original full-art asset as part of crop generation.
- Never delete a prior crop until the new crop artifact and metadata write succeed.
- On uncertainty about D&D Beyond handoff, preserve generated assets and require explicit user action rather than pretending success.

Rollback:

- Remove the crop UI and keep Phase 2 full-art storage/viewer behavior intact.
- Disable only D&D Beyond portrait handoff if that integration proves unstable while preserving local crop-generation research behind a branch.
- If schema migration proves unsafe, revert to the Phase 2 metadata shape and do not ship partial crop persistence.

## Progress log
- 2026-08-06: Drafted the Phase 3 ExecPlan after the roadmap was reordered to place cropping before deletion cleanup.
- 2026-08-06: Implemented the first crop workflow slice with extension-owned crop UI, separate crop storage, and upload-input handoff through D&D Beyond's existing portrait-management flow.

## Decision log
- 2026-08-06: Treat original full art as the canonical source asset and portrait crop as a derived artifact.
- 2026-08-06: Do not assume a private D&D Beyond portrait endpoint is safe or maintainable enough for Phase 3.
- 2026-08-06: Require an explicit decision gate for D&D Beyond crop handoff before implementation scope is locked.
- 2026-08-06: Keep portrait-crop metadata separate from Phase 2 full-art metadata in the first implementation slice instead of forcing a schema rewrite.
- 2026-08-06: Use D&D Beyond's existing upload input as the first crop handoff path and suppress the extension's own full-art observer for that synthetic upload event.
