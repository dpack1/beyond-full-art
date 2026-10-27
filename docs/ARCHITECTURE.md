# Architecture

## High-level design

Use a Chrome Manifest V3 extension with a small content-script UI layer, an extension popup for lightweight settings, an ephemeral background service worker for privileged browser events, and local extension storage.

```mermaid
flowchart LR
    DDB[D&D Beyond tab] --> CS[Isolated content script]
    POPUP[Extension popup] --> PREFS[chrome.storage.local\npreferences and metadata]
    CS --> VIEWER[Fullscreen viewer UI]
    CS <--> SW[Extension service worker]
    CS <--> PREFS
    SW <--> PREFS
    SW <--> ART[Extension IndexedDB\nfull image blobs]
    SW -. later .-> NET[chrome.webRequest observer]
```

The shipped extension uses the D&D Beyond tab, content scripts, the settings popup, the service worker, `chrome.storage.local`, and extension-origin IndexedDB. The `chrome.webRequest` observer in the diagram is still future work for character-deletion cleanup.

## Source boundaries

```text
src/
  background/
    service-worker.ts
  content/
    card-portraits-entry.ts
    character-sheet-entry.ts
    character-sheet.ts
  features/
    campaign-card-portraits/
    character-art/
    character-journal/
    crop-workflow/
    fullscreen-viewer/
  platform/
    chrome/
      backup-folder.ts
      indexed-db.ts
      messages.ts
      storage.ts
      storage-usage.ts
    dndbeyond/
      campaign-card-portrait-adapter.ts
      character-sheet-tabs-adapter.ts
      portrait-adapter.ts
      portrait-manager-adapter.ts
      portrait-upload-handoff.ts
      selectors.ts
      urls.ts
  folder/
    setup.html
    setup.css
    setup.ts
  popup/
    backup-folder.ts
    settings.html
    settings.css
    settings.ts
    storage-usage.ts
  shared/
    dom.ts
    download.ts
    result.ts
    types.ts
```

Deletion cleanup is specified but not implemented. Do not add empty modules for it until that phase has real behavior. D&D Beyond selectors belong in `platform/dndbeyond`, not in feature modules.

## Phase 1 sequence

```mermaid
sequenceDiagram
    participant User
    participant DDB as D&D Beyond
    participant CS as Content script
    participant UI as Fullscreen viewer

    User->>DDB: Click top-left character portrait
    DDB->>DDB: Render existing right-side panel
    CS->>DDB: Observe scoped DOM changes
    CS->>DDB: Attach enhancement to panel portrait
    User->>CS: Click panel portrait
    CS->>UI: Open with current portrait URL and alt text
    User->>UI: Escape, close, or backdrop click
    UI->>CS: Close and restore focus
```

## D&D Beyond DOM adapter

D&D Beyond is an external application with client-rendered UI. The living description of the sheet, including Matilda Greywolf as the reference and live-QA character, is [docs/ddb-reference/README.md](ddb-reference/README.md). Read that instead of opening the live site. Every D&D Beyond selector the extension depends on is in `src/platform/dndbeyond/selectors.ts`. A renamed class is a one-line change there. `tests/dom/selector-health.test.ts` checks the code selectors against fixtures, and `tests/e2e/selector-health-live.spec.ts` checks the sheet selectors when a logged-in sheet is available.

Keep these details isolated:

- character-page URL recognition,
- character ID extraction,
- portrait-panel discovery,
- portrait-image discovery,
- any selector fallbacks.

The feature code should ask the adapter for a portrait target rather than importing raw selectors.

Recommended adapter shape:

```ts
export interface PortraitTarget {
  image: HTMLImageElement;
  clickSurface: HTMLElement;
}

export interface DndBeyondPortraitAdapter {
  findPanelPortrait(root: ParentNode): PortraitTarget | null;
  observePanelPortraits(callback: (target: PortraitTarget) => void): () => void;
}
```

Use a marker such as `data-bfa-enhanced="true"` to make enhancement idempotent.

### Phase 1 DOM hooks observed on 2026-08-06

From the provided right-side character manage-pane DOM capture, the current MVP can anchor on:

- panel root: `[data-testid="character-manage-pane"]`
- portrait image: `img.ddbc-character-avatar__portrait[alt="Character portrait"]`
- sidebar portal fallback root: `.ct-sidebar__portal`

The hashed `styles_*` class names in the same subtree should be treated as unstable build output and should not be primary selectors.

### Character card portrait adapter support added on 2026-10-12

The optional card portrait quality upgrade runs on campaign pages and the My
Characters collection page.

Campaign cards use the specific campaign card selectors under
`platform/dndbeyond/selectors.ts`. The My Characters page was not available for
live authenticated inspection in this implementation pass, so the adapter keeps
that assumption broad and centralized: it starts from validated
`/characters/{id}` links on the `/characters` collection route, finds the
nearest ancestor containing an inline D&D Beyond avatar background, and then
applies the same verified avatar URL transformation as campaign cards.

Manual release validation should confirm the My Characters DOM still exposes a
character-page link and an inline avatar background in the same card subtree.

From manual campaign-page inspection on 2026-10-12, the user's assigned
campaign character card can differ from other participant cards: its character
actions may live in the footer as `VIEW`, `EDIT`, `UNASSIGN`, and `LEAVE`
rather than exposing the same hidden header details link. The card portrait
adapter therefore accepts any link path containing `/characters/{id}` when it
associates a nearby avatar background with a character card.

The same inspection showed some campaign portraits using D&D Beyond thumbnail
paths such as `/avatars/thumbnails/{a}/{b}/60/60/{file}`. Query parameters like
`width=600` do not override those embedded thumbnail dimensions, so the URL
adapter normalizes thumbnail paths to `/avatars/{a}/{b}/{file}` before adding
the larger bounded query parameters.

### Character journal tab support added on 2026-10-12, refined on 2026-10-13

The character journal feature inserts one extension-owned `Journal` tab after
D&D Beyond's `Extras` tab on character sheet pages and renders journal content
inside the sheet content area.

The extension popup owns the feature toggle. The setting defaults to enabled,
is stored as `bfa.preferences.characterJournalEnabled` in
`chrome.storage.local`, and is observed by the character-sheet content script.
Turning the setting off removes the inserted tab and restores any hidden native
sheet content without deleting journal entries.

The current implementation centralizes this assumption in
`platform/dndbeyond/character-sheet-tabs-adapter.ts`. The adapter searches for
a visible `Extras` tab among stable interactive controls first, then falls back
to an exact-text `Extras` element inside a character-sheet tab strip. The live
2026-10-13 sheet exposed the tab row to accessibility as radio buttons while
the DOM did not present those tabs as ordinary radio inputs or tab roles, so the
adapter recognizes a bounded tab-strip ancestor by the expected sheet labels
(`Actions`, `Spells`, `Inventory`, `Features & Traits`, `Background`, `Notes`,
and `Extras`).

The adapter inserts a project-owned button immediately after the tab-strip item
that contains `Extras`, finds the sheet content host as the sibling panel next
to that tab strip, and marks the inserted tab with
`data-bfa-character-journal-tab="true"` for idempotency.

On the 2026-10-20 wide desktop capture of Matilda Greywolf, that tab row sits
at the top of the right-hand content box, not along the bottom of the page.
The content host is the body under the row. See
[docs/ddb-reference/README.md](ddb-reference/README.md).

When the journal tab is active, the extension hides the native sheet content
children in that host, appends `bfa-character-journal-section`, and restores the
native content when a native D&D Beyond tab is clicked.

Initial live inspection on 2026-10-13 found that the earlier fallback mounted
the journal under the `Extras` tab container and left the native sheet panel
visible. The refined adapter is covered by a live-shaped fixture with
non-semantic tab text nodes and a sibling content panel.

Owner testing on a dark character sheet on 2026-10-20 showed three further
behaviors, modeled in `LIVE_CHARACTER_SHEET_TABS_FIXTURE`:

- Tab items are plain `div.ddbc-tab-list__nav-item` elements. The active item
  uses `ddbc-tab-list__nav-item--is-active`. A pointerdown on the tab row can
  select a native tab before a click reaches an inserted button, and a click
  on the item padding hits the wrapper rather than the inner button. The
  content script claims that hit target in the capture phase and clears the
  native active class.
- Dark appearance is `ct-character-sheet--dark-mode` and `data-theme="dark"`.
  The journal samples that appearance, and the computed background when no
  explicit appearance is set, then sets color variables on the section.
- Version 1 mounted the list in the first `overflow: auto` pane inside the
  content region. That nested search is the bug version 2 removed. The current
  mount is the content region next to the tab strip, described under
  Character journal version 2 below.

A fresh capture of the live DOM is still the owner's check. The fixture records
the structure those bugs require, not a full copy of the sheet.

### Character journal version 2, checked 2026-10-20

Version 2 keeps the Journal tab and moves the note into a right-hand panel.
The list mounts on the content region next to the tab strip
(`.ddbc-tab-list__content` on the classic sheet). It does not search scrolling
descendants for a mount. While Journal is open, every other child of that
region is concealed with `display: none !important`. The `hidden` attribute
alone loses to the sheet's own `display` rule, which is why Extras used to
stay on screen inside the journal. Children the sheet inserts later are
concealed the same way, and the previous display is restored when Journal
closes.

The section toolbar is the Extras row: magnifier, search field, funnel, then
New Note, on one line. The markup and classes are the ones observed on
the Extras filter (`SHEET_SECTION_FILTER_SELECTOR` in `selectors.ts`). A live
row is cloned when that tab is mounted; otherwise the same markup is built
from those strings so the sheet stylesheet can paint it. The site header
search is not used. Type filters sit behind the funnel and can be combined.
An empty selection shows every note. New Note opens the note panel. That
is the only create path.

The panel is appended to `document.body`, beside the native sidebar portal, so
a sheet `overflow: hidden` cannot clip it. It is a second copy of the
Information Sidebar shell, not a child of the sheet's React tree. Checked
2026-10-21 on character 4741434, bundle `main.73ca5823.js`: the open dialog is
`ct-sidebar` plus the hashed frame classes, up to 400px, with the decorative border,
the gap, and the scroll body. The note uses `ct-note-manage-pane` and
`ct-sidebar__heading`. The note dialog is `position: fixed` at `right: 0` and
`z-index: 10001`. Its top follows the open native sidebar, and its height is
the viewport minus that top. Opening a note hides an open native sidebar.
Class strings live in `selectors.ts`. The snapshot is
`docs/ddb-reference/sidebar.md`. Hide closes the note. Prev and Next walk the
note history. Lock, overlay, and align are not rendered. The sheet's own
sidebar body is still a closed switch with no slot for extension content, so
nothing is mounted into it, and the portrait search skips `.bfa-journal-panel`.
The extension does not ship D&D Beyond's script. Title and note fields are the
full width of the content box inside its padding.

The visual source is Matilda Greywolf,
`https://www.dndbeyond.com/characters/172153137`, captured 2026-10-20 in light
and Underdark. The screenshots are in `docs/ddb-reference/`. A public light
sheet, `https://www.dndbeyond.com/characters/4741434` ("Book"), was loaded the
same day. It is the 2024 five-tab sheet (Actions, Spells, Inventory, Features
& Traits, Extras) and is saved at
`.agent/design/journal-v2/reference/live-sheet-light.png`. The tab matcher
accepts that shorter label set and the classic seven-tab set.

The inline Journal section stays transparent so the sheet content pane's
character artwork and theme remain visible, matching native sections such as
Extras. Individual fields and dialogs still use sampled surface tokens where
they need their own readable fill.

Theme comes from the sheet: `ct-theme-dark`, a class ending in `dark-mode`,
`data-theme` or `data-appearance`, then background luminance. The journal does
not read `prefers-color-scheme`. Accent, border, and the active-tab underline
come from the computed style of an existing frame or the active tab. Fallback
tokens are used when a sample is missing. A white input is not treated as an
Underdark field.

Journal D&D Beyond selectors live in the Character journal group of
`src/platform/dndbeyond/selectors.ts`. `tests/dom/selector-health.test.ts`
names the selector and the feature that breaks when a fixture no longer matches.

### Phase 1 DOM hooks observed on 2026-10-10

From live D&D Beyond character sheet inspection, the right-side sheet panel may no longer expose `[data-testid="character-manage-pane"]`, and the displayed portrait may be a `div.ddbc-character-avatar__portrait` with the image URL in CSS `background-image` rather than an `img`.

Current fallback behavior:

- prefer the legacy `[data-testid="character-manage-pane"]` panel when present,
- otherwise use the accessible `[aria-label="Information Sidebar"]` panel when present,
- prefer the legacy portrait `img`, then fall back to the largest `.ddbc-character-avatar__portrait` surface in the panel,
- resolve viewer images from `currentSrc`/`src` for images or CSS `background-image` for current portrait surfaces.

Do not depend on the observed hashed `styles_avatar__*` class; it is used only in tests to distinguish fixture elements.

### Phase 2 DOM hooks observed on 2026-08-06

From the provided portrait-management captures for both the sheet sidebar flow and the builder modal flow, the current upload integration can anchor on:

- portrait manager root: `.ct-decoration-manager`
- upload section: `.ct-decoration-manager__upload`
- native file input: `.ct-decoration-manager__upload-file-input[type="file"]`

The current implementation passively listens to that D&D Beyond file input for preview state, then saves the selected file locally as full art only after the user activates D&D Beyond's native `Change Portrait` action. It does not replace the input, call `preventDefault()`, or modify D&D Beyond's portrait-upload request.

As of live inspection on 2026-10-10, D&D Beyond's sheet-sidebar appearance flow has changed to a "Current Decorations" / "Browse Decorations" interface. The old `.ct-decoration-manager` upload hooks were not visible in that first-level sidebar view, so the full-art upload adapter likely needs renewed live-site research before changing the upload flow.

## Viewer design

The viewer is extension-owned DOM injected into the page.

Requirements:

- one overlay instance per document,
- `role="dialog"` and `aria-modal="true"`,
- visible close button,
- useful accessible name,
- focus trap or a deliberately tiny focus surface,
- focus restoration,
- body-scroll handling that is reversible,
- namespaced styles,
- reduced-motion support,
- cleanup on teardown.

Use the highest-quality URL already available from the target image when possible. Check `currentSrc` before `src`. Do not invent image-CDN URL transformations without verification.

## Companion portrait boundary

The implemented first slice remains tracked in `.agent/plans/extras-images.md`
until manual QA and release. It uses the same external-contract boundary as
the other sheet features:

```text
D&D Beyond Extras row
  -> extras-companion-adapter (verified identity, name, type, image URL)
  -> companion portrait controller
  -> chrome.storage.local selection keyed by character ID
  -> extension-owned overlay on the character-header portrait
```

The adapter owns all D&D Beyond selectors and narrowly observes the sheet for
Extras-row and header remounts. The feature owns its checkbox and overlay DOM.
The popup owns only the global enabled preference.

Storage keys:

```text
bfa.preferences.companionPortraitEnabled
bfa.companionPortrait.selection.<characterId>
```

The selection record stores versioned metadata and the exact image URL already
rendered by D&D Beyond. It does not store image bytes. The URL snapshot lets
the header overlay render before Extras is opened after a refresh; observing
the selected row refreshes that snapshot. A failed image hides the overlay but
does not destroy the saved selection.

The first slice allows one selection per character. The overlay is an isolated
click and keyboard target that activates the selected native Extra row. When
Extras is unmounted, the adapter opens the Extras tab, waits for the matching
row, and activates it. Stats and HP remain entirely in D&D Beyond's sidebar.

## Phase 2 storage design

```mermaid
flowchart TD
    INPUT[User selects a portrait file in D and D Beyond] --> VALIDATE[Validate type and size]
    VALIDATE --> WRITE[Write Blob to extension IndexedDB]
    WRITE --> META[Write metadata keyed by character ID]
    META --> VIEW[Viewer resolves stored art first]
    VIEW --> FALLBACK[Fallback to D&D Beyond portrait]
```

### Storage ownership

- `chrome.storage.local`: preferences, metadata, schema version, and small values.
- extension-origin IndexedDB: full image Blob data.
- content scripts must not use page-origin Web Storage or IndexedDB for extension data.
- access IndexedDB from an extension context, preferably the service worker or an extension page.

The transfer mechanism for large files between an injected file input and extension-origin storage requires a Phase 2 spike. Avoid prematurely encoding large files as base64 unless measurements show it is acceptable.

### Phase 2 implementation direction chosen on 2026-08-06

The current implementation uses:

- passive observation of D&D Beyond's portrait-upload file input,
- passive observation of D&D Beyond's native portrait-confirmation action,
- content script file validation,
- structured-clone transfer of an `ArrayBuffer` plus metadata through `chrome.runtime.sendMessage`,
- a Manifest V3 service worker as the storage owner,
- extension-origin IndexedDB for the stored image `Blob`,
- `chrome.storage.local` for per-character metadata.

Replacement writes use a new blob key first, then update metadata, then attempt to delete the old blob so a failed replacement does not destroy the prior image.

The popup can request a full-art inventory through the same validated runtime
message boundary. It lists metadata from `chrome.storage.local`, builds normal
D&D Beyond character links from stored character IDs, then uses the existing
image-data and delete operations for per-item download and deletion. Downloads
use a temporary same-page anchor with a Blob URL and do not require Chrome's
`downloads` permission.

## Character journal storage

The character journal is extension-local and does not write to D&D Beyond
notes, backstory, or page-origin storage.

Journal note text is stored in `chrome.storage.local`. Photo bytes are stored
in the same extension-origin IndexedDB database as full art, under blob keys
prefixed with `bfa.journal.image.`. The content script sends those bytes
through a validated runtime message. The service worker is the only writer.
The 3 MB ceiling is on the stored blob, not on `chrome.storage.local`. A new
file larger than that, up to 25 MB, is drawn down to a 2048px long edge and
re-encoded before the message. Photos already stored are read unchanged.
`unlimitedStorage` is not requested. `chrome.storage.local` is capped at
about 10 MB (`QUOTA_BYTES`). IndexedDB uses the extension origin's own quota.
The popup reads `chrome.storage.local.getBytesInUse(null)` and
`navigator.storage.estimate()` and shows those two pools separately. A full
quota on a note write is still reported with the image size.

## Backup folder

The popup's **Choose folder** button opens `folder/setup.html` in its own
window. That page calls `showDirectoryPicker`. An empty folder receives
`beyond-full-art.json` (format `beyond-full-art-folder`, schema version 1)
and a `characters/` directory. A folder that already has that marker can be
chosen again. Any other contents are refused.

The directory handle is stored in the `backupFolder` object store of the
`beyondFullArt` IndexedDB database. Database version 2 adds that store and
does not rewrite art blobs. Forgetting the folder deletes that one record.
It does not delete files in the folder.

The setup window can copy this browser's art, crops, notes, and photos into
the folder after a confirmation. Each file is read back and hashed.
`characters/<characterId>/character.json` is written last, so a directory
without it is ignored. A character that already has `character.json` is left
alone. The marker becomes schema version 2 when that copy has no failures, or
when the player starts saving in a prepared folder that has no browser copies
to remove.

When the player then confirms cleanup, or confirms an empty browser should
save in the folder, `bfa.library.mode` becomes `folder`. That flag is written
before the browser art, crop, note, and photo records are removed. Popup
toggles, the companion portrait selection, and the directory handle stay.
From then on the service worker reads and writes full art, crops, notes, and
photos in the folder. Content scripts reach notes through `library:*`
messages. Journal photo puts include the character id so the file can be
placed before the note is saved. If the folder permission is `prompt` or
`denied`, or the handle is missing, reads and writes fail with a message to
choose the folder again. They do not create a new empty library in the
browser.

A note edited after the copy does not match, so cleanup refuses and this
browser keeps saving locally until setup unions or resolves it. The popup's
**Check folder** reads commit status and refreshes its inventory. The Journal's
**Sync folder** action reopens the current character; a clean panel adopts a newer note and a
dirty panel keeps its draft and becomes stale. Note save compares
`loadedUpdatedAt`. Full-art save compares the SHA-256 the page loaded with the
current commit before writing.

Folder-mode deletion writes a checked JSON tombstone and records its hash in
`character.json`. A deleted note file is removed and its id is no longer read.
Its journal photo files remain in place but are hidden by image tombstones so
an explicit restore can recover the note without losing those bytes. Saving a
tombstoned note id is refused. Art and crop deletion use the same format and
remove the current image bytes.

`folder-library-snapshot.ts` reads browser and folder state, while
`folder-library-compare.ts` compares normalized records keyed by character ID,
record kind, and record ID. Browser art and photo bytes are SHA-256 hashed;
notes use the same semantic fingerprint as verified folder adoption. Shared
keys with different fingerprints and local keys covered by folder tombstones
are conflicts. Browser-only keys are additions. Folder-only records do not
block the existing verified-adoption path. Directory entries whose names look
like Drive conflict siblings are reported without opening or parsing them.
Setup consumes an additions result through `folder-library-union.ts`. It writes
only browser-only records, reads folder notes before appending new note IDs,
writes photo bytes before their notes, and runs comparison again. Only a
matching result proceeds to verified adoption and browser cleanup. Conflict or
failed results preserve the browser copies and do not enable folder mode.
Note, photo, full-art, and crop conflicts proceed to `folder-library-conflicts.ts`.
The setup window creates one radio group per conflict and keeps Apply disabled
until every group has a choice. Changed notes can keep the folder copy, replace
it with the browser copy, or keep both under a new ID. Tombstoned records can
stay deleted or restore the browser copy. For full art and crops, the selected
bytes become current and the rejected bytes are hash-checked into timestamped
files recorded in the commit's `kept` array. Current-art readers ignore
`kept`, and ordinary rewrites preserve it. Checked folder writes finish before
resolved adoption removes browser records. Differing photo bytes are both
written and checked. The photo belonging to the newer owning note keeps the
shared ID; the other photo receives a random ID. `journal-image-remap.ts`
updates that note's image record, body embeds, and featured-image pointer. When
otherwise-identical notes own the two photo versions, the losing side is
retained as an ` (other computer)` note so neither photo becomes invisible.

When folder mode is already active, setup calls `isSameEntry` before connecting
a newly chosen directory. A different handle, or a browser without that API,
requires confirmation. Cancellation happens before `connectBackupFolder`, so
the current IndexedDB handle is unchanged.

```text
beyond-full-art.json
characters/<characterId>/character.json
characters/<characterId>/full-art.<png|jpg|webp>
characters/<characterId>/portrait-crop.<png|jpg|webp>
characters/<characterId>/full-art-kept-<UTC stamp>.<png|jpg|webp>
characters/<characterId>/portrait-crop-kept-<UTC stamp>.png
characters/<characterId>/journal/notes/<noteId>.json
characters/<characterId>/journal/images/<imageId>.<png|jpg|webp>
characters/<characterId>/journal/tombstones/<noteId>.json
characters/<characterId>/journal/tombstones/image-<imageId>.json
characters/<characterId>/tombstones/full-art.json
characters/<characterId>/tombstones/portrait-crop.json
```

```text
bfa.preferences.characterJournalEnabled
bfa.preferences.characterJournalListDetails
bfa.characterJournal.schemaVersion
bfa.characterJournal.entries.<characterId>
bfa.characterJournal.backup.v1.<characterId>
```

`bfa.preferences.characterJournalListDetails` is a small object with boolean
`showUpdatedDate`, `showPreview`, and `showThumbnail` fields. Missing or
malformed fields default to false. The content script observes this key and
re-renders the open list without reloading the sheet. These fields affect only
row presentation; search continues to index the full title, body, and photo
filenames.

Each character key stores an array of notes. Writes re-read that array and
merge by id, keeping the newer `updatedAt`, so a stale snapshot does not erase
another window's note. A save whose loaded `updatedAt` is older than the stored
copy is refused. Records that fail validation stay in the array and are omitted
from the list, with a count shown in the journal.

New notes are schema version 2:

```ts
interface JournalNote {
  id: string;
  characterId: string;
  title: string;
  body: string;
  type: 'session' | 'npc' | 'place' | 'item' | 'quest' | 'backstory' | 'unset';
  images: JournalImage[];
  needsDetails: boolean;
  questStatus: null;
  sessionDate: string | null;
  featuredImageId: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 2;
}
```

`body` is markdown the player typed. A photo in the body is
`![[img:<id>]]`, with an optional caption and pixel width
(`![[img:<id>|caption|300]]`). Older bodies may still use
`![name](bfa-journal-image:<id>)`, and that still renders. `images` store the
blob key, file name, and type. They do not store bytes. An image id that the
body no longer mentions is marked `orphanedAt` on save and its blob is deleted
on a save at least 30 seconds later. Opening the journal appends
`![[img:<id>]]` for an image that was never mentioned and is not already
orphaned. Opening a character that still has version 1
entries writes `bfa.characterJournal.backup.v1.<characterId>` first, and that
backup is never overwritten. The version 1 shape is:

```ts
interface CharacterJournalEntry {
  id: string;
  characterId: string;
  title: string;
  blocks: CharacterJournalBlock[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}
```

An entry can contain one text block and any number of image blocks. Image
blocks store the blob key, file name, MIME type, byte size, and dimensions.
They do not store image bytes. Schema version remains 1 so text-only entries
saved before photos shipped still load.

## Character journal export

The extension popup reads every `bfa.characterJournal.entries.*` array without
mutating or migrating it, including records the current journal UI cannot
parse. It asks the existing journal image message boundary for each referenced
photo and downloads one ZIP through a temporary Blob URL.
No `downloads` permission is required.

The ZIP uses the stable character ID for each character folder, note titles for
Markdown filenames, and original photo filenames for photos. It has one
Markdown file for every valid version 1 or version 2 note,
ordinary photo files, and a `backup.json` containing the versioned export and
raw record arrays. Import validates the container, supported record schemas,
photo keys, MIME types, and
size limits. It merges notes by ID and timestamp, preserving newer local notes,
and restores only missing photo blobs. Legacy HTML backups remain importable.
A missing photo is recorded as missing without preventing the remaining
journals from being exported. The format is documented in
[`JOURNAL_EXPORT_FORMAT.md`](JOURNAL_EXPORT_FORMAT.md).

### Phase 3 implementation direction chosen on 2026-08-06

The current crop implementation uses:

- stored full art as the default source image for crop generation,
- the currently selected D&D Beyond portrait-upload file as the crop source when the user is preparing a replacement before native confirmation,
- extension-owned crop UI injected into the page,
- pure crop math for zoom/pan state and source-rect reconstruction,
- a separate portrait-crop metadata record in `chrome.storage.local`,
- a separate portrait-crop blob in extension-origin IndexedDB,
- invalidation of the saved crop whenever the stored full art is replaced,
- transient in-content-script crop state for a newly selected replacement file until D&D Beyond's native `Change Portrait` action commits the matching full art locally,
- programmatic handoff of the generated crop through D&D Beyond's existing portrait upload input.

This intentionally avoids rewriting the existing full-art metadata shape during the first crop slice.

### Proposed metadata

```ts
export type CharacterId = string;

export interface CharacterArtMetadata {
  characterId: CharacterId;
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

Do not duplicate image bytes in `chrome.storage.local`.

## Phase 4 deletion signal

Preferred product behavior is network-driven because the extension cares about a completed character deletion, not the shape or text of a delete button.

```mermaid
sequenceDiagram
    participant DDB as D&D Beyond page
    participant SW as Service worker
    participant STORE as Local art store
    participant CS as Content script
    participant User

    DDB->>SW: DELETE request observed
    SW->>SW: Capture candidate character ID
    DDB-->>SW: Request completes successfully
    SW->>STORE: Check whether local art exists
    alt preference is ask
        SW->>CS: Show cleanup choice for character ID
        CS->>User: Delete art or Keep art
        User->>CS: Choose, optionally remember
        CS->>SW: Apply choice
    else preference is delete
        SW->>STORE: Delete local art
    else preference is keep
        SW->>STORE: Leave local art unchanged
    end
```

The exact method for obtaining the character ID must be validated. See `NETWORK_DELETE_RESEARCH.md`.

## Message design

Use a discriminated union and validate every message at runtime at the receiving boundary.

```ts
type ExtensionMessage =
  | { type: "art:get"; characterId: string }
  | { type: "art:delete"; characterId: string }
  | { type: "cleanup:prompt"; characterId: string }
  | {
      type: "cleanup:decision";
      characterId: string;
      decision: "delete" | "keep";
      remember: boolean;
    };
```

Do not trust custom DOM events or page-origin messages as privileged instructions. Validate type, shape, origin assumptions, and current tab context.

## Permissions strategy

Request permissions only when the corresponding phase ships.

### MVP

Likely needs only content-script match patterns for D&D Beyond character pages. No storage or web request permission is necessary solely to display the current image.

The implemented MVP should remain content-script-only. A background service worker is not required for the fullscreen portrait viewer.

### Full-art storage

Add `storage`. Consider `unlimitedStorage` only after measuring realistic image usage and documenting why it is needed.

The current implementation adds `storage` only. It does not request `unlimitedStorage`.

### Crop workflow

The current crop implementation adds no new Chrome permissions beyond Phase 2. It reuses the existing `storage` permission and the current character-page content-script surface.

### Delete cleanup

Add `webRequest` and narrow host permissions for both the D&D Beyond initiator and the character-service request origin if the validated implementation uses `chrome.webRequest`.

Never request `<all_urls>`.

## Failure behavior

When uncertain, preserve data and do less:

- selector not found: no page modification, development diagnostic only,
- image URL unavailable: do not open a broken viewer,
- request body cannot be decoded: do not delete art,
- deletion request fails: do not prompt or delete art,
- preference cannot be loaded: default to `ask`,
- storage deletion fails: show error and keep metadata consistent with recoverable bytes.
