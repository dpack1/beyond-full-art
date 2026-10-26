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

Status: Superseded for new writes by ADR-021. Version 1 records still load and migrate.

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

## ADR-019: Journal photos are image blocks in IndexedDB

Status: Superseded for new writes by ADR-021. Photo bytes stay in IndexedDB.

Store each journal photo as an image block on the note. Keep the note record,
including the block metadata, in `chrome.storage.local`. Keep the photo bytes
in extension-origin IndexedDB under a `bfa.journal.image.` blob key.

Why:

- The block schema from ADR-018 can grow an image block without rewriting
  existing text entries, so schema version stays 1.
- Photo bytes can be large enough to crowd `chrome.storage.local`.
- A dedicated key prefix keeps journal deletes from touching stored full art
  in the same object store.
- Search can use the file name stored on the block without reading the bytes.

## ADR-020: Journal follows the sheet pane

Status: Accepted. The version 1 mount sentence below is historical. Version 2
mounts on the content region next to the tab strip, not in a nested scroller.
See the version 2 section in `docs/ARCHITECTURE.md`.

The journal samples the character sheet's appearance. Version 1 mounted in the
sheet's inner scroll pane. Version 2 does not. The section toolbar is the Extras search row: magnifier, field, funnel, and
Manage Notes on one line. The note panel copies the Information Sidebar's
markup and class names, recorded in `docs/ddb-reference/sidebar.md`, so the
sheet stylesheet paints it. It does not copy the sheet's script, and it is
not mounted inside the live sidebar. The dialog is `position: fixed` on the
viewport, because the native sidebar's absolute box only lands on the right
when `body` is the containing block. Opening a note closes an open native
sidebar. That body is still a closed switch on
the sheet's pane id. Hide closes the note. Prev and Next walk note history.
Lock, overlay, and align are omitted. The portrait search ignores this copy.

Why:

- Hardcoded light colors are unreadable on the sheet's dark appearance.
- The sheet's content region clips overflow. Version 1 put the journal in
  that inner pane and limited its height. Version 2 mounts on the content
  region beside the tab strip instead, which is the fix for that nested
  scroller.
- Opening Journal has to claim the whole tab hit target on pointerdown. A
  bubble-phase click on the inner button misses the first click.
- Character journal writes merge by entry id and keep unrecognized records so
  one window or one invalid block cannot delete another note.

## ADR-021: Journal notes are markdown with an image list

Status: Accepted

New journal writes use schema version 2: a markdown body plus an image list.
Version 1 block entries migrate once, after a backup of the version 1 array.
The note is rendered by walking `marked`'s lexer and creating DOM nodes. Note
text is not assigned with `innerHTML`.

Why:

- The player wiki needs headings, lists, links, and checkboxes in one body.
  A block array made that editing model harder without protecting the text.
- Image bytes are still too large for `chrome.storage.local`. The image list
  stores metadata and a blob key. The bytes stay in extension-origin IndexedDB
  under `bfa.journal.image.`.
- A backup written before the live key changes, and never overwritten, is the
  way back to the version 1 notes. Edits made after migration exist only in
  the version 2 records.
- Rendering through DOM nodes avoids an HTML sanitizer for as long as no HTML
  string is produced. Add one before any path assigns parsed markdown through
  `innerHTML`.
- ADR-017 still holds: the journal is extension-owned and local. ADR-020 still
  holds: the journal follows the sheet. The look is sampled from the sheet
  Dylan uses, Matilda Greywolf (`172153137`), including the Notes and Extras
  tab strip and the right-hand pane. The red frames and the active-tab
  underline are that character's theme color, sampled at runtime. They are
  not a fixed red. Mockup colors are not the source.

## ADR-022: One selector map and a sheet reference

Status: Accepted

Keep every D&D Beyond selector in `src/platform/dndbeyond/selectors.ts`, describe the sheet in `docs/ddb-reference/README.md`, and fail tests with the selector id, the features it breaks, what it targeted, and what to look for.

Why:

- D&D Beyond's DOM changes without notice. A renamed class should be a one-line fix in a file a new reader can find.
- Agents should read the reference doc instead of scraping the live site. The live site stays the place for the QA check.
- Matilda Greywolf (`https://www.dndbeyond.com/characters/172153137`) is the reference sheet and the live-QA character as of 2026-10-20.
- Fixture tests prove the code selectors still match saved DOM. The Playwright live check is opt-in so CI does not need a logged-in session.
- This decision landed on main as ADR-019 before the journal photo and sheet-pane decisions were in that history. On this branch those keep ADR-019 and ADR-020, and the selector map is ADR-022.

## ADR-023: Large journal photos are resized before IndexedDB

Status: Accepted.

Journal photo bytes stay in extension-origin IndexedDB. The 3 MB check Dylan
hit is the extension's stored-blob ceiling, not a `chrome.storage.local` cap
and not base64 in that store. The runtime message uses base64 because Chromium
does not deliver an `ArrayBuffer` intact. The worker decodes it and writes a
`Blob`.

A new file over 3 MB and at or under 25 MB is resized to a 2048px long edge
and re-encoded (WebP, then JPEG, quality about 0.85) in the content script.
The stored blob must still be at or under 3 MB. A file over 25 MB, or a
resized blob that is still over 3 MB, is refused. The note shows the size and
the limit. Photos already in IndexedDB are not rewritten. `unlimitedStorage`
stays off so Chrome does not ask for a new permission.

## ADR-024: Journal photos are inline embeds

Status: Accepted.

A photo is stored as an IndexedDB blob, the same as before, and the note body
gains an embed at the cursor: `![[img:<id>]]`. A caption is
`![[img:<id>|caption]]`. A width in pixels is `![[img:<id>|300]]`, and the two
combine as `![[img:<id>|caption|300]]`. A whole number from 1 to 4096 is the
width; any other pipe piece is the caption. Read mode draws that image in
place, at most the panel width, keeping the aspect ratio.

Older notes may still contain `![name](bfa-journal-image:<id>)`. That syntax
still renders. A photo record that is not mentioned by either syntax gets
`![[img:<id>]]` appended when the journal opens, so a picture that used to sit
under the text is not dropped. Deleting the embed marks the blob orphaned on
the next save and deletes it on a save at least 30 seconds later, which leaves
room to undo. Deleting the note deletes its blobs immediately.

## ADR-025: Journal export is one portable ZIP

Status: Accepted.

The popup exports character journals into one ZIP. Character folders contain
ordinary Markdown notes and photo files, while `backup.json` preserves the raw
storage arrays and their photo paths for import. Export reads storage without
migrating it, retains unreadable records, and reports missing photos without
discarding the rest.

Why:

- Markdown and ordinary image files remain readable if D&D Beyond changes or
  the user stops using the extension.
- One ZIP is easier to keep than loose files. A small stored-ZIP implementation
  avoids a runtime dependency and the `downloads` permission.
- Preserving raw records prevents a newer or temporarily unreadable record
  from being silently lost.
- Import treats the file as untrusted input, accepts only supported notes and
  photos, keeps newer local note versions, and does not overwrite existing
  photo blobs.

## ADR-026: Companion portrait selection is local metadata over verified Extras DOM

Status: Accepted for the Phase 6 portrait slice.

The first companion feature lets one Extra be selected per character. The
extension adds a checkbox to a verified Extras row, stores a versioned snapshot
of that row's identity, name, type, and exact rendered image URL in
`chrome.storage.local`, and draws an interactive portrait over the
bottom-right of the character header portrait.

The global popup preference hides the controls and overlay without deleting
the per-character selection. Selecting a second Extra replaces the first even
though the requested row control is visually a checkbox.

Why:

- One overlay matches the initial design and avoids an unresolved layout for
  multiple companions.
- A small URL snapshot can restore the overlay before Extras mounts, while a
  later row observation can refresh stale metadata.
- Reusing the exact rendered URL avoids copying image bytes or guessing D&D
  Beyond's image-CDN transformations.
- The small overlay has its own click and keyboard target. Activating it clicks
  the selected native Extra row, opening D&D Beyond's own sidebar instead of
  reproducing its stats or HP controls.
- Stats, hit points, and controls have a larger and less stable contract, so
  they remain a separate follow-up rather than expanding the portrait MVP.

Live inspection on 2026-10-22 verified stable, non-hashed row, image, name,
type, group, and header-avatar classes on Matilda Greywolf. The row exposes no
stable Extra ID, so identity uses normalized group, name, and type; the exact
image URL disambiguates duplicate rows. A future D&D Beyond ID should replace
that composite when one becomes available.

On 2026-10-23 the display-only decision was replaced by the smaller native
sidebar shortcut: clicking or keyboard-activating the overlay opens the saved
Extra's row. If Extras is not mounted, the extension opens that tab first and
then activates the matching row.

## ADR-027: A chosen folder becomes the library after the files match

Status: Accepted. After the player confirms, a checked folder is where full
art, crops, journal notes, and journal photos are saved. Browser copies of
those records are removed only when every one of them still matches the
folder. Preferences and the directory handle stay on this browser.

The popup can connect one directory that the user chooses. Chrome's directory
picker runs in `folder/setup.html`, because the toolbar popup closes when the
picker opens. The extension stores the directory handle in its IndexedDB
database, in the `backupFolder` store added at database version 2. The art
blob store is left in place until a verified cleanup removes blobs that now
live in the folder.

A new folder must be empty. Finder's `.DS_Store`, `Thumbs.db`, and
`desktop.ini` are ignored. The extension then writes `beyond-full-art.json`
and creates `characters/`. A folder that already has other files is refused.
A folder that already contains a readable version 1 or version 2 marker can be
chosen again, including on another computer. `createdAt` is not rewritten.
The marker's schema version becomes 2 when a copy finishes with no failures,
or when an empty browser starts saving in that folder.

Copying writes each character's files, reads them back, and saves
`character.json` only when those hashes match. A character that already has
`character.json` is not overwritten. Cleanup then compares the browser's art,
crops, notes, and photos with those files. On a full match it sets
`bfa.library.mode` to `folder` and removes the browser copies. A mismatch, a
missing blob, or a failed copy leaves the browser copies in place and keeps
saving on this browser. Declining the cleanup prompt does the same.

An empty folder with nothing saved in the browser can be confirmed as the
place new art and notes are saved. An existing folder and an empty browser
can be confirmed the same way, without copying files back into the browser.
Later saves and reads go through the service worker to that folder. If Chrome
has not granted the folder, the sheet asks the player to choose it again and
does not fall back to an empty browser copy.

Forgetting the folder removes only the handle on this browser. Files in the
folder stay there. The library mode stays `folder`, so the sheet keeps asking
for that folder instead of starting a new empty library.

Google Drive is not an API integration. If the chosen folder is inside Google
Drive for Desktop, Drive syncs the files the extension writes there. Opening
the sheet reads the folder as it is on disk. A sheet that is already open does
not watch automatically. **Check folder** in the popup refreshes its status and
inventory; the Journal action re-reads the current character without replacing
a dirty draft. Note saves reject a newer stored `updatedAt`, and full-art saves
reject a current SHA-256 different from the page's loaded revision.

Folder deletes are durable records rather than missing files. Hashed tombstone
JSON files are listed in `character.json`; readers hide tombstoned notes and
photos, and saving the same note id is refused until an explicit restore.
Photo bytes stay in the folder for that restore. Full-art and crop deletion
also write tombstones, then remove the live image file. This keeps another
computer from interpreting a deliberate delete as a record it should copy
back later.

Cross-computer comparison is keyed by character ID, record kind, and record
ID. Image equality is byte SHA-256; note equality is the existing semantic
fingerprint rather than display text or timestamps alone. A differing shared
key is always a conflict, even when one timestamp is later. Folder-only
records do not block the already-shipped verified adoption path. Drive
conflict sibling names are surfaced, but their files are not opened or
deleted by comparison.

An additions-only result uses a single confirmed union. Browser-only files are
written with the existing checked writers, folder-only notes are retained, and
comparison runs again before folder mode or browser cleanup changes. Any
conflict or failed verification keeps all browser copies. Switching away from
an active library is a separate confirmed action performed before the stored
directory handle is replaced.

Conflict application is all-choice-first. Notes can keep either copy, keep both
under a new ID, or resolve a tombstone as deleted or restored. Full-art and crop
choices make one image current and preserve the other bytes in a checked,
timestamped file listed under `character.json` `kept`; later current-image
writes do not delete those files. Browser cleanup follows successful checked
writes. A photo conflict keeps both checked byte versions. The version owned by
the later `updatedAt` note keeps the shared photo ID; ties keep the folder
version on that ID. The other version receives a new random ID, and its retained
note has image metadata, embeds, and featured-image state remapped. If the note
itself was otherwise equal, that losing-side note is copied under a new ID with
the ` (other computer)` suffix so both photos remain reachable.

Why:

- A blank folder gives the extension one place to build a stable layout.
- Refusing a mixed folder avoids writing beside unrelated files.
- Removing browser copies only after a match means a failed copy or a later
  edit cannot throw away the newer copy.
- The directory handle cannot live in `chrome.storage.local`. IndexedDB is the
  existing extension-origin store that can hold it.
- Writing `bfa.library.mode` before the browser delete means a crash still
  reads the folder instead of an empty browser.
