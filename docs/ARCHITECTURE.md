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

The MVP uses only the D&D Beyond tab, content script, and viewer. The other components are added when their phase needs them.

## Recommended source boundaries

```text
src/
  background/
    service-worker.ts
  content/
    card-portraits-entry.ts
    character-sheet-entry.ts
  features/
    campaign-card-portraits/
      campaign-card-portrait-upgrade.ts
      avatar-url.ts
    fullscreen-viewer/
      viewer.ts
      viewer.css
      focus.ts
    character-art/
      art-service.ts
      art-types.ts
    crop-workflow/
      crop-workflow.ts
      crop-dialog.ts
      crop-math.ts
      crop-types.ts
    deletion-cleanup/
      cleanup-controller.ts
      cleanup-dialog.ts
      cleanup-preference.ts
  platform/
    chrome/
      messages.ts
      storage.ts
      indexed-db.ts
    dndbeyond/
      campaign-card-portrait-adapter.ts
      urls.ts
      selectors.ts
      portrait-adapter.ts
      portrait-manager-adapter.ts
      portrait-upload-handoff.ts
      delete-request-adapter.ts
  popup/
    settings.ts
    settings.css
  shared/
    result.ts
    logging.ts
```

This is a direction, not a demand for empty placeholder modules. Add a module when it owns real behavior.

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

D&D Beyond is an external application with client-rendered UI. Keep these details isolated:

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
