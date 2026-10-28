# Repository instructions

Beyond Full Art is a Chrome Manifest V3 extension for D&D Beyond character art. `README.md` is the human runbook. This file is the working agreement for code changes.

## The pattern

Keep the project readable for the next person, human or agent:

- Human-readable code and docs. Named functions, explicit types, and comments only where the intent is not obvious.
- One D&D Beyond selector map: `src/platform/dndbeyond/selectors.ts`. Each entry says what it targets and which features break when it misses.
- One sheet reference: `docs/ddb-reference/README.md`. Read it instead of the live site. The reference and live-QA character is Matilda Greywolf, https://www.dndbeyond.com/characters/172153137.
- Tests that name the breakage. A selector health failure tells you the selector id, the selector string, the features it breaks, what it targeted, and what to look for on the page. A renamed class is usually one line in the map.

Keep these docs current in the same change that makes them stale: this file, `README.md`, `docs/ddb-reference/`, and `.agent/` when a feature ships or a plan changes. Shared design decisions still go in `docs/DECISIONS.md`. Phase status still goes in `docs/IMPLEMENTATION_PLAN.md`.

Before changing behavior, read:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`
- `docs/ddb-reference/README.md` when the change touches the D&D Beyond page
- `.agent/FEATURES.md` for features that have already shipped
- `.agent/PLANS.md` and the matching ExecPlan under `.agent/plans/` for work that has not shipped

For deletion-related work, also read `docs/NETWORK_DELETE_RESEARCH.md` and `.agent/plans/future-feature-character-deletion-cleanup.md`. The observed request screenshots are in `docs/reference/`. Deletion cleanup is specified and still unbuilt. Add modules for it when that phase has real behavior.

## Where things live

| Path | What it is |
| --- | --- |
| `README.md` | Human quick start and runbook |
| `AGENTS.md` | This file: setup, the UI-breakage playbook, and code conventions |
| `.agent/FEATURES.md` | Shipped features |
| `.agent/PLANS.md` and `.agent/plans/` | Future work that has not shipped |
| `docs/ddb-reference/` | D&D Beyond sheet structure, look, and the hooks the extension uses |
| `docs/` | Spec, architecture, decisions, testing, and deletion research |

## Setup

Node.js 20 (`.nvmrc` is `20.18.0`).

```text
nvm use
npm install
```

## Build and load the unpacked extension

Follow [Install](README.md#install) in the README. Chrome loads `dist/`, not the repository root. `npm run watch` is described under [Start and stop](README.md#start-and-stop).

After a source change, let the build finish, click **Reload** on the extension card, and refresh the D&D Beyond tab.

## Tests

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:all
```

`npm test` is Vitest. It includes `tests/dom/selector-health.test.ts`, which checks every code selector against the saved fixtures.

`npm run test:e2e` builds, then runs Playwright against local fixtures. It does not call the live site. The live selector check is in that suite and skips unless you set a sheet URL. The command and the storage-state setup are in [docs/TESTING.md](docs/TESTING.md#selector-health). Playwright needs Chromium once: `npx playwright install chromium`. The suite is headless unless `BFA_PLAYWRIGHT_HEADLESS=false`.

Manual live checklists are in `docs/TESTING.md`.

## D&D Beyond changed its UI

1. Read `docs/ddb-reference/README.md` for the last verified structure. Do not browse the live site to rediscover it.
2. Run `npm test`. The selector health failure names the broken entry.
3. Open the page only if you are doing the live check in [docs/TESTING.md](docs/TESTING.md#selector-health), or confirming a failure the fixtures cannot see.
4. On a wide desktop sheet the tab row is at the top of the right-hand content box, not along the bottom. The journal looks for the Extras label in that row.
5. Change the one selector in `src/platform/dndbeyond/selectors.ts`. A renamed class is usually the whole fix.
6. Update `docs/ddb-reference/README.md` in the same change: the fact that changed, its provenance tag, and the Last verified date. Replace screenshots when the look changed.
7. Run `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Run the live check when a logged-in sheet is available.

## Making adjustments

- Match the surrounding code. Prefer a small direct change over a new framework or abstraction.
- Put a new D&D Beyond selector in the map, with `targets`, `features`, `lookFor`, and the fixtures that contain it. The health test scans other `.ts` and `.css` files under `src/` and fails when a line matches `ddbc-`, `ct-decoration`, `ct-sidebar`, `ct-character`, `ct-theme`, `ct-primary`, `ddb-campaigns-`, `character-manage-pane`, `Information Sidebar`, `user-selected-avatar`, or `/avatars/`.
- Extension-owned classes and attributes stay `bfa-` or `data-bfa-`. They are not part of the D&D Beyond map's health check.
- Do not lose user artwork. Do not block D&D Beyond's own clicks. `preventDefault()` is limited to the cases already called out below.
- Update the docs listed under [The pattern](#the-pattern) when behavior, architecture, permissions, storage, or a D&D Beyond assumption changes.

## Layout

```text
src/
  background/service-worker.ts          art storage owner
  content/                              content-script entrypoints
  features/
    campaign-card-portraits/            sharper card avatars
    character-art/                      save, status, and portrait edit panel
    character-journal/                  beta Journal tab, slide-in notes, markdown, photos
    crop-workflow/                      square portrait crop dialog
    fullscreen-viewer/                  accessible fullscreen overlay
  platform/chrome/                      storage, IndexedDB, runtime messages
  platform/dndbeyond/                   selector map, URLs, DOM adapters
  popup/                                toolbar settings, storage readout, backup folder, inventory
  folder/                               backup-folder picker window
  shared/                               DOM, download, and result helpers
tests/
  unit/                                 pure logic
  dom/                                  jsdom fixture tests
  e2e/                                  Playwright extension fixtures
  fixtures/                             minimal DOM used by the tests
docs/                                   spec, architecture, decisions, research
docs/ddb-reference/                     live sheet structure; sidebar.md is the journal panel reference
.agent/                                 shipped features and future plans
assets/icons/                           extension icons; icon-source.png is the master
assets/readme/                          README images only
scripts/build.mjs                       esbuild bundle into dist/
```

Preserve these boundaries:

- D&D Beyond selectors live in `src/platform/dndbeyond/selectors.ts`. The journal entries are the Character journal group in that map. URL parsing and DOM adapters live next to it.
- Chrome API access lives behind `src/platform/chrome/` where tests need a seam.
- UI components own their markup, behavior, and styles.
- Storage code stays separate from DOM integration.
- The popup is one surface: settings toggles, the storage readout, the backup-folder connection, and the stored-art inventory. The directory picker itself runs in `folder/setup.html`.

Avoid large files. Consider splitting a file that approaches 250 lines when it has more than one responsibility. Do not split cohesive code merely to satisfy a line count. `src/features/character-art/upload-control.ts` and `src/platform/chrome/messages.ts` are already past that guideline; split them only when changing their behavior.

## Conventions

### Engineering priorities

1. Do not lose user artwork.
2. Do not break or block normal D&D Beyond behavior.
3. Keep Chrome permissions as narrow as the current feature allows.
4. Keep code easy for unfamiliar developers to read and change.
5. Prefer a small, direct implementation over a generalized framework.
6. Make D&D Beyond integration assumptions easy to locate and replace.

### Implementation style

- Use strict TypeScript. Prefer plain TypeScript, DOM APIs, and CSS. Do not add React or another UI framework unless a later feature clearly earns it.
- Prefer named functions and explicit data types.
- Avoid `any`. When unavoidable at a browser boundary, narrow it immediately and explain why.
- Keep side effects near entrypoints. Put parsing and decision logic in pure functions.
- Do not introduce a dependency for a task that is clear and small in native browser APIs.
- Do not create speculative abstraction layers for features that do not exist yet.
- Comments should explain why, browser quirks, or external assumptions, not restate the code.

### D&D Beyond integration

- Never spread raw D&D Beyond CSS selectors through feature code. Add them to `src/platform/dndbeyond/selectors.ts`. The selector health test scans other `.ts` and `.css` files under `src/` and fails when a line matches `ddbc-`, `ct-decoration`, `ct-sidebar`, `ct-character`, `ct-theme`, `ct-primary`, `ddb-campaigns-`, `character-manage-pane`, `Information Sidebar`, `user-selected-avatar`, or `/avatars/`. Do not hardcode hashed `styles_` classes.
- Treat D&D Beyond DOM structure and private endpoints as unstable external contracts.
- Do not guess a selector or request payload when it can be verified on the live site.
- When an assumption is verified, document the date and the observed behavior.
- Use `MutationObserver` narrowly. Avoid observing the entire document indefinitely when a scoped root is available.
- Do not interfere with D&D Beyond click handlers. Avoid `preventDefault()` unless there is a demonstrated need. The Journal tab and the portrait keyboard handler are the current exceptions.
- Namespace injected classes, data attributes, custom events, and element IDs with `bfa-` or `data-bfa-`.

### Chrome extension

- Use Manifest V3.
- Keep host permissions limited to the D&D Beyond origins the current feature needs.
- Do not request `webRequest`, `unlimitedStorage`, or `downloads` before the feature that needs them is implemented.
- Do not execute remote code.
- Keep stored artwork on this machine unless a product decision explicitly adds cloud sync. ADR-027: after a verified match, the chosen folder is the library for art, crops, notes, and photos. Preferences stay in `chrome.storage.local`. The directory handle stays in IndexedDB. `bfa.library.mode` is `folder` only after that match, and it is written before the browser copies are removed.
- Store preferences in `chrome.storage.local`. While the folder is the library, `settings.json` keeps a copy of the popup toggles, journal list details, and companion choices. The newer copy wins. While the library is still this browser, art and crop metadata and journal note text live in `chrome.storage.local` too.
- Store full image bytes in extension-origin IndexedDB until the folder is the library. After that, image bytes live in the folder. Do not store image bytes in `chrome.storage.local`.
- Do not use page-origin localStorage or IndexedDB from a content script for extension data.
- Treat the service worker as ephemeral. Persist state instead of relying on global memory.
- Character IDs are strings. Do not coerce them through JavaScript numbers.

### User experience

- Look native enough to avoid visual friction, without imitating D&D Beyond so closely that ownership is confusing.
- Fullscreen dialogs must be keyboard accessible.
- Escape closes dialogs.
- Focus moves into an opened dialog and returns to the initiating element when it closes.
- A visible close button is required.
- Respect reduced motion.
- User-facing errors should explain what failed and preserve user data.

## Gotchas

- Chrome match patterns overlap. `character-sheet-entry.js` matches `/characters/*`. `card-portraits-entry.js` matches `/campaigns/*` and `/characters*`. Each entry returns immediately unless `src/platform/dndbeyond/urls.ts` recognizes its page.
- Full art is written only after D&D Beyond's native **Change Portrait** action. A chosen file, and a crop made from that file, stay pending until that confirmation.
- One active full-art image is stored per character. Replacement writes the new blob before deleting the old one.
- Supported uploads are `image/png`, `image/jpeg`, and `image/webp`, up to 3 MB. The generated crop is a 512×512 PNG.
- Popup styles are injected by `src/popup/settings.ts` from `settings.css?raw`. `settings.html` has no stylesheet link. The build copies the HTML and bundles the script to `dist/popup/settings.js`. The backup-folder window does the same with `src/folder/setup.css` and `dist/folder/setup.js`.
- Backup folder setup runs outside the toolbar popup because that popup closes when Chrome's directory picker opens. A new folder must be empty aside from `.DS_Store`, `Thumbs.db`, or `desktop.ini`. An existing folder is accepted when its `beyond-full-art.json` marker is version 1 or 2. A confirmed copy writes checked files. A second confirm removes this browser's copies only when they still match the folder, and later saves go to the folder. A mismatch leaves both copies in place. The marker becomes version 2 after a fully successful copy, or when an empty browser starts saving in the folder. The handle lives in the IndexedDB `backupFolder` store. A stored handle is often permission `prompt` until Choose folder calls `requestPermission`. The setup window moves to the bottom-right corner while that allow question is open, then returns. The service worker still opens `characters/` when that query stays `prompt`. The journal shows the allow-access message when that open fails. The folder stays the library; its files are not copied into this browser.
- Folder-library deletion writes hashed tombstone JSON and preserves every `character.json` tombstone on later writes. Deleted note files are removed; their photo files remain but are hidden by image tombstones. A tombstoned note id cannot be saved until the explicit restore path clears its note and image tombstones.
- `src/platform/chrome/folder-library-snapshot.ts` reads browser and folder sync state. `folder-library-compare.ts` owns cross-computer identity and pure comparison. Together they hash browser image bytes, use the shared note fingerprint, treat a local record covered by a folder tombstone as a conflict, and list Drive conflict siblings without opening them. `folder-library-union.ts` writes browser-only additions and rechecks before verified adoption. Conflict choices own later writes.
- While folder mode is active, choosing another directory requires an `isSameEntry` check and confirmation before `connectBackupFolder` can replace the stored handle. Treat a missing or failed `isSameEntry` as requiring confirmation.
- `folder-library-conflicts.ts` validates the whole choice set before writing. Notes support folder, browser, both, deleted, and restore. Full art and crops support folder, browser, deleted, and restore; the non-current bytes are hash-checked into timestamped files recorded under `character.json` `kept`. Differing photo bytes are both retained: the photo owned by the newer note keeps its id, the other photo gets a new id, and retained note embeds and featured-image references are remapped.
- The popup exposes **Check folder** and the Journal exposes an icon-only **Sync folder** action while folder mode is active. A dirty Journal draft is not replaced by a newer folder note. Its banner offers Save, Discard draft, and Keep both; Keep both copies the draft and its photo blobs to new ids before loading the folder note. Full-art saves include the SHA-256 loaded by the page and `saveFolderFullArt` refuses a different current revision.
- Both popup toggles default to enabled when the preference key is missing.
- Journal photos belong to the character. A note embeds one with `![[img:<id>]]`, optionally `![[img:<id>|caption|300]]`, and still stores that image record. The catalog is metadata only: `bfa.journal.library.<characterId>` in `chrome.storage.local`, and `characters/<characterId>/journal/photos.json` when the folder is the library. While the library is this browser, bytes live in IndexedDB under keys prefixed `bfa.journal.image.`. After the folder is the library, the photo file is `characters/<characterId>/journal/images/<imageId>.<ext>` and the put message includes that character id. Do not store image bytes in `chrome.storage.local`. A file over 3 MB is resized to a 2048px long edge before it is stored. The source file can be up to 25 MB. Stored bytes stay at or under 3 MB. Photos already stored are left as they are. Taking a photo out of a note, or deleting the note, leaves the file in Photos. Delete photo is the only action that removes it. In folder mode that delete uses the existing image tombstone.
- The journal follows the sheet's light or dark appearance and scrolls inside the sheet's content pane. Opening it claims the whole tab hit target, including padding, on pointerdown. It conceals the sheet section with `display: none !important` while Journal is open. The note panel mirrors the Information Sidebar recorded in `docs/ddb-reference/sidebar.md`. Its close and back controls sit outside the content box. Do not copy `ct-sidebar` onto that panel.
- Playwright journal screenshots are written to `/opt/cursor/artifacts/journal/` by `tests/e2e/character-journal.spec.ts` and `tests/e2e/character-journal-sheet.spec.ts`. The suite loads the unpacked `dist/` extension against local character-sheet fixtures, not the live site.
- `assets/icons/icon-source.png` is the icon master. The build copies only `icon-16.png`, `icon-32.png`, `icon-48.png`, and `icon-128.png`.
- README diagrams under `assets/readme/svg/` are the labeled screenshots. Do not commit generated `dist/` or `test-results/`.
- `.agent/` is tracked. `FEATURES.md` lists shipped features, including the character journal (beta). `PLANS.md` and `plans/` hold work that has not shipped. When a feature ships, record it in `FEATURES.md`, update the durable product and architecture docs, and remove its completed plan. Shared design decisions go in `docs/DECISIONS.md`. Phase status goes in `docs/IMPLEMENTATION_PLAN.md`.

## Validation

Favor quick feedback during small UI iterations. For a localized visual,
layout, or copy adjustment, make the change and run only:

```text
npm run build
```

Hand the result back to Dylan for manual QA. Do not automatically run the full
unit, typecheck, or Playwright suites for these small iterations unless Dylan
asks, the build fails in a way that needs diagnosis, or the change also affects
storage, data safety, parsing, permissions, request handling, selectors, or
other non-trivial behavior.

For substantial or higher-risk changes, and before a requested release or PR,
run:

```text
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` for substantial content-script changes, D&D Beyond
adapter or selector-map changes, or when Dylan explicitly requests it. Run the
live selector check from [Tests](#tests) when a logged-in sheet is available
and live verification is part of the requested work.

Add or update tests for non-trivial parsing, storage, preference, request-correlation, and selector logic. For D&D Beyond DOM changes, include concise manual verification steps in the pull request. The live checklists are in `docs/TESTING.md`. The sheet reference is `docs/ddb-reference/README.md`.

## Documentation

Update documentation in the same change when behavior, architecture, permissions, storage, or external assumptions change.

Record meaningful architecture changes in `docs/DECISIONS.md`.

When D&D Beyond's sheet changes, update `docs/ddb-reference/README.md` and the selector map together. The refresh steps are at the bottom of that reference.
