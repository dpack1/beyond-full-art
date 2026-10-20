# Character Journal

## Goal

Add an extension-owned character journal to D&D Beyond character sheets.

When this feature is complete, a user can open a `Journal` tab immediately
after D&D Beyond's `Extras` tab, create and manage local journal entries for
the current character, refresh the page, and keep writing without syncing or
modifying D&D Beyond's own notes, backstory, or character data.

The journal includes notes and photos, and a way to find them. It stays out of
`.agent/FEATURES.md` until the owner approves it and it ships.

## Scope

Included:

- Add a `Journal` tab immediately after D&D Beyond's `Extras` tab.
- Make that tab look and behave like a native sheet tab: an uppercase label,
  no extra border or icon, the sheet's active underline, and the sheet's hover.
  A focus ring shows only for keyboard `:focus-visible`.
- Show an extension-owned journal section from that tab inside the sheet content
  area.
- Store journal entries locally by D&D Beyond character ID.
- List, create, edit, save, and delete notes.
- Add, view, and remove photos on a note. Supported files are PNG, JPEG, and
  WebP up to 3 MB. Photo bytes live in extension-origin IndexedDB. Note text
  and photo metadata live in `chrome.storage.local`.
- Find notes with search (title, text, and photo file name), an all-notes or
  with-photos filter, and newest or oldest ordering.
- Use a block-based entry model for the text and image blocks.
- Preserve unsaved editor text when local storage operations fail.
- Make the journal surface keyboard accessible.
- Add unit tests, DOM fixture tests, and local Playwright fixture tests.
- Update product, architecture, implementation, and decision docs.

Excluded:

- D&D Beyond backstory, notes, or extras-field sync.
- Importing existing D&D Beyond notes or backstory.
- Sharing journal entries with other users.
- Cloud sync.
- Rich text formatting.
- Tags, categories, or a timeline.
- A popup inventory view for journals.
- Replacing or modifying D&D Beyond's native notes UI.
- Import and export of journal notes.

## Current State

The character journal is implemented on `cursor/character-journal-cade` and is
not shipped. `.agent/FEATURES.md` does not list it.

What the branch does now:

- Inserts a Journal tab immediately after Extras. The label is uppercase and
  uses the sheet tab's active underline and hover.
- Mounts an extension-owned section in the sheet content pane.
- Stores text in `chrome.storage.local` and photo bytes in extension-origin
  IndexedDB.
- Lists, creates, edits, saves, and deletes notes. Delete asks first.
- Search, an all-notes or with-photos filter, and newest/oldest ordering are
  part of the feature. The owner confirmed notes and photos, including finding
  them, on 2026-10-20.
- Photos can be added, viewed, and removed for PNG, JPEG, and WebP up to 3 MB.
- A Close control and a native tab both leave the journal. Unsaved text asks
  for confirmation before it is discarded.
- The section samples the sheet's light or dark appearance and scrolls inside
  the sheet pane.
- Popup setting `bfa.preferences.characterJournalEnabled` hides the tab without
  deleting notes.

The first text slice from this plan is in place. Live DOM capture is still
incomplete; the 2026-10-20 owner session is modeled in
`LIVE_CHARACTER_SHEET_TABS_FIXTURE`.

## External Assumptions

The journal tab depends on D&D Beyond's character-sheet navigation DOM. Treat
that DOM as an unstable external contract.

Assumptions to verify before wiring the feature:

- The live character sheet has a discoverable tab or navigation container that
  includes `Extras`.
- The `Extras` tab can be identified by accessible text, role, URL, or another
  non-hashed selector.
- An extension-owned tab can be inserted immediately after `Extras` without
  breaking D&D Beyond's tab behavior.
- The tab remains present after delayed rendering and client-side navigation.
- Activating the extension tab does not require `preventDefault()` on D&D
  Beyond-owned controls unless live testing proves otherwise.
- The extension can provide a useful journal surface by temporarily hiding the
  native sheet content panel and restoring it when a native tab is selected.

Verification approach:

- Inspect a live D&D Beyond character sheet around the `Extras` tab.
- Capture a minimal HTML fixture of the relevant navigation structure.
- Record the observed hooks and verification date in `docs/ARCHITECTURE.md`.
- Centralize all selectors and tab-insertion behavior under
  `src/platform/dndbeyond/`.

Observed on the owner's live sheet on 2026-10-20, and modeled in
`tests/fixtures/character-sheet-tabs.ts` as `LIVE_CHARACTER_SHEET_TABS_FIXTURE`:

- Tab items are plain `div.ddbc-tab-list__nav-item` elements. The active item
  uses `ddbc-tab-list__nav-item--is-active`. The sheet can act on pointerdown
  for the whole item, including padding, before a click reaches an inserted
  button. Unknown labels can replace the pane contents.
- Dark appearance is `ct-character-sheet--dark-mode` with `data-theme="dark"`.
- The content region is height-constrained with `overflow: hidden`. The
  scrolling element is the inner pane (`ddbc-tab-options__content`,
  `overflow: auto`).

A saved copy of the live DOM is still outstanding. The fixture records the
structure those three bugs require.

## Approach

### Product Behavior

The `Journal` entrypoint should appear in the character sheet's existing tab
row immediately after `Extras`.

Activation should show an extension-owned journal section inside the character
sheet content area. This section should temporarily hide the native D&D Beyond
content panel for the active tab and restore that native content when any native
D&D Beyond tab is selected.

The journal section should contain:

- Images area with small thumbnail slots for future image support.
- Entry list sorted by most recently updated first.
- New entry button.
- Title field.
- Body field for a text block.
- Save button.
- Delete button for existing entries.
- Close button.
- Empty state when no entries exist.
- Inline status for save/delete/load failures.

User writing is high-value local data. Failed save or delete operations must not
clear editor fields or remove the prior saved entry from the UI.

### Proposed Source Layout

Add only files that own real behavior:

```text
src/
  features/
    character-journal/
      character-journal.css
      character-journal-section.ts
      character-journal-service.ts
      character-journal-types.ts
  platform/
    dndbeyond/
      character-sheet-tabs-adapter.ts
```

Update likely existing files:

```text
src/content/character-sheet.ts
src/platform/chrome/storage.ts
src/platform/dndbeyond/selectors.ts
docs/PRODUCT_SPEC.md
docs/ARCHITECTURE.md
docs/IMPLEMENTATION_PLAN.md
docs/DECISIONS.md
tests/e2e/support/dndbeyond-fixtures.ts
```

The exact file names may change if implementation reveals a cleaner local
pattern, but keep these ownership boundaries:

- D&D Beyond tab DOM lookup and insertion in `platform/dndbeyond`.
- Journal domain types and validation in `features/character-journal`.
- Chrome storage mechanics in `platform/chrome`.
- Character-sheet feature composition in `content/character-sheet.ts`.

### D&D Beyond Tab Adapter

Create an adapter that observes the character-sheet tab/navigation area and
inserts one extension-owned tab after `Extras`.

The adapter should expose behavior similar to:

```ts
export interface CharacterSheetJournalTabTarget {
  contentHost: HTMLElement;
  tab: HTMLElement;
  nativeTabs: HTMLElement[];
  cleanup: Cleanup;
}

export function observeJournalTabTargets(
  onTarget: (target: CharacterSheetJournalTabTarget) => void,
  doc?: Document,
): Cleanup;
```

Implementation notes:

- Use project-prefixed classes and attributes, such as
  `bfa-character-journal-tab` and `data-bfa-journal-tab="true"`.
- Use idempotent insertion so repeated `MutationObserver` callbacks do not add
  duplicate tabs.
- Prefer accessible labels and stable semantics over hashed class names.
- Keep observer scope as narrow as the verified tab root allows.
- If `Extras` cannot be found, do nothing and log a concise debug message only
  if the existing logging pattern supports it.
- Preserve normal D&D Beyond tabs by limiting extension event handling to the
  inserted tab.
- Return native tabs so feature wiring can restore D&D Beyond content when the
  user leaves Journal.
- Return the content host where the inline journal section should mount.

### Journal UI

Implement a plain DOM, extension-owned inline section.

The section should:

- Have a useful accessible name, such as `Character journal`.
- Mount inside the sheet content host found by the D&D Beyond adapter.
- Hide native content while active and restore it when a native tab is clicked.
- Respect reduced motion.
- Avoid D&D Beyond visual mimicry that makes ownership confusing.
- Use stable dimensions so loading, empty, and error states do not shift the
  layout dramatically.

The first UI can be compact and direct:

```text
-------------------------------------------------
| Images                                        |
| [thumbnail slots]                             |
-------------------------------------------------
| Notes                         [New entry]     |
| entries list       | title field              |
| entry title        | body textarea            |
| updated date       | [Delete] [Save]          |
-------------------------------------------------
```

Do not add in-app instructional copy about how the feature works. Use clear
labels and controls instead.

### Data Model

Use D&D Beyond character ID as the storage boundary.

Initial schema:

```ts
export const CHARACTER_JOURNAL_SCHEMA_VERSION = 1;

export interface CharacterJournalEntry {
  id: string;
  characterId: string;
  title: string;
  blocks: CharacterJournalBlock[];
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

export type CharacterJournalBlock = CharacterJournalTextBlock;

export interface CharacterJournalTextBlock {
  id: string;
  type: 'text';
  text: string;
}
```

Future image block direction:

```ts
export interface CharacterJournalImageBlock {
  id: string;
  type: 'image';
  blobKey: string;
  fileName: string;
  mimeType: string;
  altText: string;
  caption: string;
}
```

Validation rules for the first slice:

- Character IDs are strings.
- Entry IDs and block IDs are generated by the extension.
- Empty titles are allowed in draft UI but saved as `Untitled entry`.
- Body text is stored as a single text block.
- `createdAt` and `updatedAt` are ISO strings.
- Corrupt or unknown stored entries are ignored rather than rendered.
- Unknown future block types should be preserved only if a migration strategy is
  added; for this slice, strict validation may ignore unsupported entries.

### Storage

Use `chrome.storage.local` for the first text-only slice.

Proposed key layout:

```text
bfa.characterJournal.schemaVersion
bfa.characterJournal.entries.<characterId>
```

Store all entries for one character in one array under the character-specific
key. This keeps reads simple when opening a character journal and avoids a
global scan for normal use.

Storage helpers should live behind the existing storage wrapper and expose
feature-specific operations:

```ts
getCharacterJournalEntries(characterId)
setCharacterJournalEntry(entry)
deleteCharacterJournalEntry(characterId, entryId)
```

Data-safety requirements:

- Save should read the latest entry list, upsert the one entry, then write the
  whole character entry list.
- A failed save must leave the editor state visible and must not mutate the
  in-memory displayed saved list as if it succeeded.
- Delete should ask for confirmation before removing an entry.
- A failed delete must keep the entry visible.
- No journal data should be stored in page-origin `localStorage` or IndexedDB.

Future image bytes should use extension-origin IndexedDB, matching full-art
storage ownership.

### Character-Sheet Wiring

Update `installCharacterSheetEnhancement` to create the journal service and
section after a valid character ID is parsed.

Suggested composition flow:

1. Parse current character ID using the existing URL helper.
2. Create a journal service bound to Chrome local storage.
3. Create one journal section instance for the document.
4. Observe D&D Beyond tab targets.
5. On journal tab activation, show the inline section for the current character
   ID.
6. On native tab activation, hide the inline section and restore native content.
7. Add adapter cleanup, section cleanup, and observer cleanup to the existing
   cleanup set.

The feature should do nothing on non-character pages.

### Styles

Add feature-local CSS under `src/features/character-journal/`.

Style guidance:

- Namespace every class with `bfa-character-journal`.
- Keep the section visually distinct but quiet.
- Use familiar icon treatment for the tab; prefer a text `Journal` label plus
  a small inline icon or CSS mask if no icon library exists.
- Do not add decorative background blobs or marketing-style panels.
- Keep controls stable on narrow widths.
- Verify text does not overflow buttons or list items.

### Tests

Add focused unit tests:

- `tests/unit/character-journal-types.test.ts`
  - validates accepted entry records,
  - rejects malformed records,
  - preserves character ID as a string.

- `tests/unit/storage.test.ts` or a new journal-specific storage test
  - reads empty journal as `[]`,
  - saves a new entry,
  - updates an existing entry,
  - deletes one entry without deleting others,
  - sorts entries by `updatedAt` descending,
  - ignores corrupt stored values.

Add DOM tests:

- `tests/dom/character-sheet-tabs-adapter.test.ts`
  - inserts journal tab after `Extras`,
  - does not duplicate the tab on repeated observation,
  - does nothing when `Extras` is absent,
  - cleans up inserted tab and listeners.

- `tests/dom/character-journal-section.test.ts`
  - opens with empty state,
  - creates and saves an entry,
  - reloads existing entries,
  - edits an entry,
  - asks before delete,
  - preserves editor values after failed save,
  - hides native content while shown,
  - restores native content when hidden.

- Update `tests/dom/character-sheet.test.ts`
  - verifies the journal tab observer is wired on character pages,
  - verifies non-character pages remain unchanged.

Add Playwright fixture tests:

- Extend `tests/e2e/support/dndbeyond-fixtures.ts` with a character-sheet tab
  fixture containing `Extras`.
- Add a Playwright test that loads the extension, opens the fixture, confirms
  the `Journal` tab appears after `Extras`, shows the inline section, saves an
  entry, reloads, and confirms the entry persists.
- Add selector-health coverage so missing `Extras`/tab hooks appear in the
  local health report.

### Documentation

Update docs in the same implementation PR:

- `docs/PRODUCT_SPEC.md`
  - add a character journal phase or feature section,
  - explicitly state local-only journal storage and no D&D Beyond sync.

- `docs/ARCHITECTURE.md`
  - add journal source boundaries,
  - document verified tab DOM hooks and date,
  - document journal storage keys and ownership.

- `docs/IMPLEMENTATION_PLAN.md`
  - add the journal phase and exit criteria.

- `docs/DECISIONS.md`
  - record a new ADR for extension-owned local journal tab,
  - record the block-based text-first model decision if not covered by the same
    ADR.

## Milestones

- [ ] Save a copy of the live character-sheet tab DOM around `Extras`. The
      2026-10-20 owner session is modeled, but the raw DOM is not in the repo.
- [x] Capture a minimal character-sheet tab fixture.
- [x] Document current journal-tab hooks and manual-verification gap in
      `docs/ARCHITECTURE.md`.
- [x] Add journal domain types and validators.
- [x] Add journal storage helpers using `chrome.storage.local`.
- [x] Add unit tests for journal validation and storage operations.
- [x] Add D&D Beyond character-sheet tabs adapter.
- [x] Add DOM tests for tab insertion, idempotency, and cleanup.
- [x] Add journal section UI and CSS.
- [x] Add DOM tests for section behavior and data-safety cases.
- [x] Wire journal service, tab adapter, and section into
      `src/content/character-sheet.ts`.
- [x] Add Playwright fixture coverage for tab insertion and persisted entries.
- [x] Add selector-health reporting for the journal tab hook.
- [x] Update product, architecture, implementation, and decision docs.
- [x] Run full validation and record manual verification notes.
- [x] Open Journal on the first pointerdown of the tab label and its padding,
      and clear the native active underline.
- [x] Follow the sheet light and dark appearance, including a change while the
      journal is open.
- [x] Scroll the journal inside the sheet pane so Save and Delete stay reachable.
- [x] Keep unsaved text until the user confirms discarding it.
- [x] Run a confirmed delete after an in-flight save instead of dropping it.
- [x] Merge journal writes by entry id and keep unreadable records in storage.

## Validation

Automated validation:

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Preferred final gate:

```text
npm run test:all
```

Manual browser validation:

1. Build the extension.
2. Reload the unpacked extension in Chrome.
3. Open a D&D Beyond character sheet.
4. Confirm `Journal` appears immediately after `Extras`.
5. Confirm D&D Beyond's original tabs still work.
6. Open the journal with a mouse and confirm it appears inside the sheet content
   area.
7. Open the journal with keyboard activation.
8. Create a journal entry and save it.
9. Refresh the character sheet and confirm the entry remains.
10. Edit the entry and confirm the edited text persists.
11. Delete the entry and confirm it disappears only after confirmation.
12. Navigate to a different character and confirm entries are character-specific.
13. Temporarily simulate a storage error in local tests or dev build and confirm
    typed editor text remains visible.
14. Confirm no journal UI appears on unrelated D&D Beyond pages.
15. Click another native D&D Beyond tab and confirm the native sheet content is
    restored.

## Risks And Rollback

Risks:

- D&D Beyond may change the tab DOM or `Extras` label.
- D&D Beyond may use client-side navigation patterns that remove and recreate
  the tab row.
- A native-looking inserted tab may visually drift from D&D Beyond styling.
- Journal entries are user writing, so storage bugs are more serious than
  cosmetic feature bugs.
- A future image feature may require migration if the first schema is too flat.

Data protection:

- Store journal data only in extension-owned storage.
- Keep journal records separate from full-art and crop records.
- Do not delete journal entries unless the user explicitly confirms deletion.
- Do not clear editor fields on failed save.
- Do not remove stored journal records during feature rollback.

Rollback:

- Remove the journal content-script wiring and tab adapter.
- Leave `bfa.characterJournal.*` storage keys untouched.
- Remove or hide the UI without deleting local records.
- Because there is no D&D Beyond sync in the first slice, rollback does not
  need to repair remote D&D Beyond data.

## Progress Log

- 2026-10-12: Initial rough idea captured: make a better journal than D&D
  Beyond's long notes box, with future support for writing and images.
- 2026-10-12: Product direction clarified: journal lives as an extension-owned
  tab immediately after `Extras`; no D&D Beyond notes/backstory sync in the
  first slice; design the model with future image blocks in mind.
- 2026-10-12: Expanded into a full implementation ExecPlan with source layout,
  storage design, test plan, documentation updates, validation, and rollback
  strategy.
- 2026-10-12: Implemented the first local journal slice against local fixtures.
  Live D&D Beyond tab DOM inspection is still required before release.
- 2026-10-12: Full local validation passed with `npm run test:all`. Playwright
  required browser launch outside the sandbox.
- 2026-10-12: Product direction changed from modal dialog to inline sheet
  section with an images area and note editor/list. Implementation updated to
  mount inside the tab content area and restore native content on native tab
  activation.
- 2026-10-13: Notes, photo blocks, and search landed on the journal branch.
  Codex review notes for delete confirmation, photo URL revocation, and viewer
  focus were fixed.
- 2026-10-20: Owner testing on the live dark sheet found three bugs: the first
  Journal click did nothing while Extras stayed active, journal text and inputs
  stayed light-on-dark, and the section was clipped with no scroll. The same
  review pass reported unsaved text being wiped on reopen and a confirmed
  delete being ignored while a save was in flight.
- 2026-10-20: Those failures are fixed on the branch. The live-shaped fixture
  covers first-click activation, dark and light appearance, and scrolling.
  Playwright screenshots: `journal-dark.png`, `journal-light.png`, and
  `journal-dark-scrolled.png`. Merged `.agent/` plan docs from `main`.
- 2026-10-20: Owner confirmed photos and search are in scope. The Journal tab
  is restyled to match native uppercase labels. The separate book icon and
  button border are removed. Tab screenshots: `journal-tab-dark.png` and
  `journal-tab-light.png`.

## Decision Log

- 2026-10-12: Use a separate extension-owned journal tab instead of enhancing
  D&D Beyond's native notes field. This keeps the journal UI under extension
  ownership and avoids making non-extension users see encoded or awkward
  fallback content.
- 2026-10-12: Keep the first slice extension-local only. Syncing to Backstory,
  Notes, or other D&D Beyond fields is deferred because it changes the source of
  truth and raises compatibility concerns.
- 2026-10-12: Use a block-based entry model from the start. Text blocks ship
  first, while image blocks remain a future feature.
- 2026-10-12: Prefer an extension-owned inline section opened from the inserted
  Journal tab. This keeps the feature in the expected tab content area while
  preserving reversible ownership over the DOM the extension hides and restores.
- 2026-10-13: Photo bytes are image blocks in extension-origin IndexedDB
  (ADR-019), with search, a photo filter, and newest/oldest sort.
- 2026-10-20: The owner confirmed that adding, editing, and finding notes and
  photos is in scope. Photos and search stay. The journal is still not listed
  in `.agent/FEATURES.md`.
- 2026-10-20: The Journal tab matches the native sheet tabs. It is an uppercase
  text label with the sheet's active underline and hover. The earlier book
  icon is removed because it rendered as a red square and the button's default
  border drew a box around the label. A focus ring is limited to
  `:focus-visible`.
- 2026-10-20: Claim Journal on capture-phase pointerdown for the whole tab
  item, including padding, and clear the native active class. A bubble-phase
  click on the inner button was too late for the live tab row.
- 2026-10-20: Sample the sheet appearance (`ct-character-sheet--dark-mode`,
  `data-theme`, or computed background) instead of `prefers-color-scheme`.
  Mount in the inner scroll pane and limit the section to that pane's height.
- 2026-10-20: Do not reload an open journal, and ask before discarding unsaved
  text when the user leaves. Queue a confirmed delete until the current save
  finishes.
- 2026-10-20: Journal writes re-read and merge by entry id. Unreadable records
  stay in storage and are omitted from the list, with a count in the section.
  The plan's "ignore corrupt entries" rule still applies to display. It no
  longer deletes them on the next save.
- 2026-10-20: Keep the base64 photo payload. In current Chromium,
  `chrome.runtime.sendMessage` delivers an `ArrayBuffer` as a plain object, so
  a buffer-only put is rejected. Deferred: export, session dates, clipboard
  paste, a session template, and undo-delete. Also deferred: splitting the
  journal controller further than the elements, theme, pane, and record
  modules. The section still owns render and save because they share one
  editor state. A character change re-reads the URL; an unsaved note stays
  bound to the previous character until the user discards it. The body-wide
  tab observer narrows to the sheet shell after the shell exists, and stops
  reinserting the tab after repeated strip/insert cycles.
