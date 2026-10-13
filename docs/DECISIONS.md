# Architecture Decision Log

## ADR-001: Chrome Manifest V3 and TypeScript

Status: Accepted

Use Chrome Manifest V3 and strict TypeScript.

Why:

- Manifest V3 is the current Chrome extension platform.
- TypeScript makes browser-message contracts, storage records, and DOM adapters easier to maintain.
- The runtime remains standard JavaScript.

## ADR-002: Plain DOM UI before a framework

Status: Accepted

Use plain DOM APIs and CSS for the viewer and early dialogs.

Why:

- The initial UI is small.
- A framework would add build weight and concepts without solving a current problem.
- Feature-local modules can remain readable without a component framework.

Revisit when the extension has enough screens and shared state that plain DOM code becomes harder, not merely different.

## ADR-003: Small bundler and normal source modules

Status: Proposed for scaffold

Use esbuild to bundle TypeScript entrypoints.

Why:

- Content scripts are easier to author as modules and bundle to browser-ready files.
- esbuild has a small configuration surface.
- It avoids a framework-specific extension abstraction.

Codex may choose an equivalently small setup if it documents a concrete advantage.

## ADR-004: Character ID is the storage key

Status: Accepted

Key all character-specific local data by the D&D Beyond character ID parsed from the character sheet URL or validated delete request.

Represent IDs as strings.

## ADR-005: Local-first storage split

Status: Accepted for Phase 2 direction

Use `chrome.storage.local` for preferences and metadata, and extension-origin IndexedDB for full image Blob data.

Why:

- Metadata is small and works naturally with extension storage.
- Full-resolution images can exceed normal extension-storage quotas quickly.
- Page-origin storage would be coupled to D&D Beyond browsing data and should not hold extension assets.

The exact large-file transfer path remains a required implementation spike.

## ADR-006: Network deletion is the primary cleanup signal

Status: Accepted as a direction, pending technical validation

Prefer the completed D&D Beyond deletion request over delete-button markup.

Why:

- Cleanup depends on successful deletion, not a click intent.
- Endpoint behavior is likely more semantically precise than UI structure.
- The extension does not need to block or alter the request.

Fallback behavior must preserve art when the character ID or request outcome is uncertain.

## ADR-007: Cleanup preference remembers the selected action

Status: Accepted

The cleanup prompt has two actions, `Delete art` and `Keep art`, plus `Remember my decision`.

When checked, the selected action becomes the global future preference. Default behavior is `ask`.

## ADR-008: Phase 1 ships without a background service worker

Status: Accepted

The fullscreen portrait viewer MVP ships as a content-script-only feature.

Why:

- Phase 1 does not need privileged browser events or extension-owned storage.
- Omitting a service worker keeps the scaffold smaller and easier to review.
- It preserves the narrow-permission strategy until later phases require more.

## ADR-009: Phase 2 storage is owned by the service worker

Status: Accepted

Phase 2 stores full-art image bytes through the Manifest V3 service worker.

Why:

- It keeps extension-owned persistence out of the page context.
- It allows one explicit storage owner for both `chrome.storage.local` metadata and IndexedDB Blob writes.
- It keeps the content script focused on DOM integration, validation, and user interaction.

The current implementation transfers `ArrayBuffer` payloads plus metadata through runtime messages and reconstructs the `Blob` inside the service worker before writing IndexedDB.

## ADR-010: Phase 2 piggybacks on D&D Beyond portrait uploads

Status: Accepted

Phase 2 listens to D&D Beyond's existing portrait-upload file input instead of adding a separate extension-owned upload picker.

Why:

- It matches the user's expected upload flow on both the sheet sidebar and the builder modal.
- It preserves D&D Beyond's UI ownership while keeping the extension's addition small and local.
- It avoids coupling the product to a second upload surface that users would have to learn separately.

The extension still owns its own status and delete UI, and it passively observes file selection while deferring persistence until the user clicks D&D Beyond's native `Change Portrait` action.

## ADR-013: Persist full art on native portrait confirmation, not chooser selection

Status: Accepted

Phase 2 preview state may begin as soon as the user selects a file, but the extension persists replacement full art only when the user confirms the upload through D&D Beyond's native `Change Portrait` control.

Why:

- It avoids replacing stored full art with abandoned chooser selections.
- It keeps the extension aligned with the user's actual commit point in D&D Beyond's portrait flow.
- It preserves the existing full-art record unless the user intentionally completes a portrait change.

## ADR-014: A crop prepared from a newly selected replacement file stays pending until native confirmation

Status: Accepted

When the user chooses a replacement portrait file and opens the crop workflow before clicking D&D Beyond's native `Change Portrait`, the extension treats that crop as pending UI state rather than immediately persisting it as the active local crop record.

Why:

- It prevents abandoned chooser selections from overwriting the saved crop tied to the current full art.
- It keeps the crop's `sourceArtBlobKey` aligned with the full-art blob that is actually committed locally.
- It lets the crop dialog operate on the newly selected file instead of stale stored art while still respecting ADR-013's commit boundary.

## ADR-011: Phase 3 stores portrait crops separately from original full art

Status: Accepted

Phase 3 stores the generated portrait crop as a separate metadata record and Blob rather than rewriting the existing Phase 2 full-art metadata shape.

Why:

- It keeps the original full-art path stable while crop behavior is introduced.
- It avoids a risky metadata migration for users who already saved full art in Phase 2.
- It makes invalidating a stale crop on full-art replacement explicit and easy to reason about.

## ADR-012: Phase 3 hands generated crops back through D&D Beyond's existing upload input

Status: Accepted for the first implementation slice

Phase 3 submits the generated crop by populating D&D Beyond's existing portrait upload input and dispatching the native upload events.

Why:

- It stays inside the existing user-facing portrait-management flow.
- It avoids depending on undocumented private D&D Beyond endpoints.
- It keeps the implementation small enough to validate before investing in a more elaborate fallback path.

If live-site validation proves this unreliable, the product should fall back to an explicit user-assisted flow rather than private endpoint automation.

## ADR-015: Stored full art downloads use normal browser downloads

Status: Accepted

When the fullscreen viewer is showing locally stored full art, provide a
`Download full art` action that points a temporary same-page anchor at the
existing stored-art object URL.

Why:

- It gives users a simple recovery path for local artwork.
- It does not require the broad Chrome `downloads` permission.
- It reuses the already loaded Blob URL instead of creating a second copy of the
  image bytes.
- It keeps backup/export behavior user-initiated and local.

## ADR-016: Character-card portrait upgrades share one adapter boundary

Status: Accepted

Use one D&D Beyond adapter for small character-card avatar upgrades across
campaign pages and the My Characters collection page.

Why:

- Both surfaces point at normal D&D Beyond character URLs and use small avatar
  background images.
- Keeping the route checks and selectors centralized makes private D&D Beyond
  DOM assumptions easier to find and replace.
- The existing popup setting should continue to control the optional quality
  upgrade without migrating stored preferences.

## ADR-017: Character journal is extension-owned and local-first

Status: Accepted

Add the character journal as an extension-owned tab and inline character-sheet
section rather than enhancing D&D Beyond's native notes, backstory, or extras
fields.

Why:

- Journal entries are user writing and should not depend on D&D Beyond private
  field behavior in the first slice.
- Keeping the feature extension-owned avoids encoded fallback content appearing
  to users without the extension.
- Local-only storage matches the current extension ownership model and avoids
  source-of-truth conflicts.
- The inserted tab and inline section place the feature where users expect
  character-sheet writing tools while keeping the extension's DOM ownership
  reversible.
- A popup preference can disable the inserted tab without deleting journal
  entries, keeping the feature opt-out reversible and local.

## ADR-018: Journal entries use text blocks from the first slice

Status: Accepted

Store journal entries as block-based records even though the first shipped block
type is text.

Why:

- Image blocks are a planned follow-up.
- A flat `body: string` entry would force an immediate migration when images
  are added.
- The text-only first slice can still remain simple because the UI reads and
  writes a single text block.

Future image bytes should use extension-origin IndexedDB rather than
`chrome.storage.local`, matching the full-art storage boundary.
