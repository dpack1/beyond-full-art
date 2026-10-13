# Repository instructions

Beyond Full Art is a Chrome Manifest V3 extension for D&D Beyond character art. `README.md` is the human runbook. This file is the working agreement for code changes.

Before changing behavior, read:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`

For deletion-related work, also read `docs/NETWORK_DELETE_RESEARCH.md`. The observed request screenshots are in `docs/reference/`. Deletion cleanup is specified and still unbuilt. Add modules for it when that phase has real behavior.

## Layout

```text
src/
  background/service-worker.ts          art storage owner
  content/                              content-script entrypoints
  features/
    campaign-card-portraits/            sharper card avatars
    character-art/                      save, status, and portrait edit panel
    character-journal/                  local Journal tab and entries
    crop-workflow/                      square portrait crop dialog
    fullscreen-viewer/                  accessible fullscreen overlay
  platform/chrome/                      storage, IndexedDB, runtime messages
  platform/dndbeyond/                   selectors, URLs, DOM adapters
  popup/                                toolbar settings and stored-art inventory
  shared/                               DOM, download, and result helpers
tests/
  unit/                                 pure logic
  dom/                                  jsdom fixture tests
  e2e/                                  Playwright extension fixtures
  fixtures/                             minimal DOM used by the tests
docs/                                   spec, architecture, decisions, research
assets/icons/                           extension icons; icon-source.png is the master
assets/readme/                          README images only
scripts/build.mjs                       esbuild bundle into dist/
```

Preserve these boundaries:

- D&D Beyond selectors and endpoint details live under `src/platform/dndbeyond/`.
- Chrome API access lives behind `src/platform/chrome/` where tests need a seam.
- UI components own their markup, behavior, and styles.
- Storage code stays separate from DOM integration.
- The popup is one surface: settings toggles plus the stored-art inventory.

Avoid large files. Consider splitting a file that approaches 250 lines when it has more than one responsibility. Do not split cohesive code merely to satisfy a line count. `src/features/character-art/upload-control.ts` and `src/platform/chrome/messages.ts` are already past that guideline; split them only when changing their behavior.

## Commands

Node.js 20 (`.nvmrc` is `20.18.0`).

```text
npm install
npm run typecheck
npm test
npm run build
npm run watch
npm run test:e2e
npm run test:all
```

`npm run build` is required before Chrome can see TypeScript or static-file changes. Load `dist/`, not the repository root. `npm run watch` rebuilds the four script bundles and the CSS they import. It copies `manifest.json`, icons, and `src/popup/settings.html` only when it starts.

Playwright needs Chromium: `npx playwright install chromium`. The e2e suite is headless unless `BFA_PLAYWRIGHT_HEADLESS=false`. It writes `test-results/`, which is gitignored.

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

- Never spread raw D&D Beyond CSS selectors through feature code. Add them to `src/platform/dndbeyond/selectors.ts` or the adapter that owns that surface.
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
- Keep stored artwork local unless a product decision explicitly adds cloud sync.
- Store preferences, metadata, and journal text in `chrome.storage.local`.
- Store full image bytes in extension-origin IndexedDB.
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
- Popup styles are injected by `src/popup/settings.ts` from `settings.css?raw`. `settings.html` has no stylesheet link. The build copies the HTML and bundles the script to `dist/popup/settings.js`.
- Both popup toggles default to enabled when the preference key is missing.
- Journal image tiles are a placeholder. Do not store image bytes in `chrome.storage.local`.
- `assets/icons/icon-source.png` is the icon master. The build copies only `icon-16.png`, `icon-32.png`, `icon-48.png`, and `icon-128.png`.
- README diagrams under `assets/readme/svg/` are the labeled screenshots. Do not commit generated `dist/` or `test-results/`.
- `.agent/` is gitignored local scratch. Shared design changes go in `docs/DECISIONS.md`. Phase status goes in `docs/IMPLEMENTATION_PLAN.md`.

## Validation

Before declaring a change complete, run:

```text
npm run typecheck
npm test
npm run build
```

Add or update tests for non-trivial parsing, storage, preference, and request-correlation logic. For D&D Beyond DOM changes, include concise manual verification steps in the pull request. The live checklists are in `docs/TESTING.md`.

## Documentation

Update documentation in the same change when behavior, architecture, permissions, storage, or external assumptions change.

Record meaningful architecture changes in `docs/DECISIONS.md`.
