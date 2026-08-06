# Beyond Full Art

`Beyond Full Art` is a Chrome Manifest V3 extension for D&D Beyond. It enhances the existing character portrait experience without replacing or redesigning D&D Beyond's UI.

The current implementation includes the Phase 1 fullscreen viewer, the Phase 2 full-art storage slice, and the first Phase 3 crop workflow slice: portrait uploads made through D&D Beyond's existing portrait UI are saved locally as full art, and stored full art can now be cropped into a separate portrait image for D&D Beyond.

## Current Features

- Runs on D&D Beyond character pages, including the builder route.
- Preserves D&D Beyond's normal top-left portrait behavior.
- Enhances the right-side character manage-pane portrait only.
- Opens the current portrait image in a fullscreen overlay.
- Saves the file selected through D&D Beyond's portrait upload UI as one local full-art image per character.
- Stores image bytes locally in extension-owned IndexedDB and metadata in `chrome.storage.local`.
- Lets the user open a crop workflow from the portrait-management surface when stored full art exists.
- Saves a generated portrait crop locally as a separate artifact from the original full art.
- Submits the generated crop back through D&D Beyond's existing portrait upload input.
- Lets the user replace stored full art by uploading another portrait and remove stored full art explicitly.
- Falls back to the live D&D Beyond portrait when no stored art exists.
- Supports close via `Escape`, close button, and backdrop click.
- Restores focus to the invoking portrait after close.
- Uses a narrow MV3 background service worker and the `storage` permission for local persistence only.

## Roadmap

- Phase 1: fullscreen portrait viewer MVP
- Phase 2: local full-art upload and storage
- Phase 3: crop workflow research and implementation
- Phase 4: deletion cleanup prompt for locally stored art

See [docs/PRODUCT_SPEC.md](/Users/dylanpackham/Documents/Personal/TTRPG/character-gallery/docs/PRODUCT_SPEC.md:1), [docs/ARCHITECTURE.md](/Users/dylanpackham/Documents/Personal/TTRPG/character-gallery/docs/ARCHITECTURE.md:1), and [docs/IMPLEMENTATION_PLAN.md](/Users/dylanpackham/Documents/Personal/TTRPG/character-gallery/docs/IMPLEMENTATION_PLAN.md:1) for the detailed product and technical plan.

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript with strict compiler settings
- `esbuild` for bundling
- `vitest` + `jsdom` for unit and DOM tests
- Plain DOM APIs and CSS for injected UI

## Repository Layout

```text
src/
  content/                  Content-script entrypoints and page wiring
  features/
    fullscreen-viewer/      Overlay UI, focus handling, styles
  platform/
    dndbeyond/              D&D Beyond URL and DOM adapters
  shared/                   Small shared helpers and types
tests/
  dom/                      DOM behavior tests
  fixtures/                 Minimal HTML fixtures
  unit/                     Pure logic tests
docs/                       Product, architecture, decisions, and testing notes
```

## Local Setup

This repo expects Node 20. If you use `nvm`:

```bash
nvm use
npm install
```

If your system `node` is broken or points somewhere unexpected, you can still run commands explicitly with:

```bash
PATH="$HOME/.nvm/versions/node/$(cat .nvmrc)/bin:$PATH" npm install
```

## Development Commands

```bash
npm run typecheck
npm test
npm run build
npm run watch
```

The unpacked extension build is written to `dist/`.

## Load the Extension in Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable `Developer mode`.
4. Click `Load unpacked`.
5. Select the repository [dist](/Users/dylanpackham/Documents/Personal/TTRPG/character-gallery/dist) directory.

## Manual Validation

After loading the extension:

1. Open a D&D Beyond character sheet.
2. Click the normal top-left portrait and confirm D&D Beyond still opens its own sidebar.
3. In the right sidebar, click the portrait.
4. Confirm the fullscreen viewer opens with the current portrait.
5. Open D&D Beyond's portrait-management UI from either the right sidebar or the builder portrait modal.
6. Upload a valid PNG, JPEG, or WebP image smaller than `3 MB`.
7. Reopen the fullscreen viewer and confirm the stored full art is shown.
8. Upload another portrait and confirm the stored full art is replaced.
9. Use `Crop portrait`, adjust the crop, and apply it.
10. Confirm D&D Beyond receives the generated crop and the extension still preserves the original full art for fullscreen viewing.
11. Reopen the crop workflow and confirm `Edit portrait crop` appears.
12. Use `Remove stored full art` and confirm the viewer falls back to the D&D Beyond portrait.
13. Close with `Escape`, the close button, and backdrop click.
14. Confirm clicking the image itself does not close the viewer.
15. Confirm the right sidebar stays open when the fullscreen viewer closes.
16. Navigate to another character page and verify the enhancement still works.

The fuller validation checklist is in [docs/TESTING.md](/Users/dylanpackham/Documents/Personal/TTRPG/character-gallery/docs/TESTING.md:46).

## Design Constraints

- Do not lose user artwork.
- Do not break or block normal D&D Beyond behavior.
- Keep permissions as narrow as the current feature allows.
- Centralize D&D Beyond selectors and assumptions behind adapters.
- Prefer small, direct modules over generalized frameworks.

These constraints are documented in [AGENTS.md](/Users/dylanpackham/Documents/Personal/TTRPG/character-gallery/AGENTS.md:1).
