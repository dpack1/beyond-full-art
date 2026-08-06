# Phase 1 MVP Fullscreen Viewer

## Goal
Ship a Manifest V3 Chrome extension MVP that enhances D&D Beyond character sheet pages so the portrait shown in the existing right-side character panel can be opened in an accessible fullscreen viewer without breaking D&D Beyond's normal behavior.

## Scope
Included:

- Manifest V3 scaffold required to load the extension locally.
- Strict TypeScript build, typecheck, test, and build scripts.
- A content-script entrypoint for D&D Beyond character sheet pages.
- A D&D Beyond adapter for character-sheet URL matching and panel-portrait discovery.
- A fullscreen viewer that opens the currently displayed portrait image.
- Accessibility behavior for keyboard use, focus entry/restore, close button, Escape, and backdrop close.
- DOM observation needed for delayed rendering and client-side navigation.
- Automated tests for pure parsing helpers and DOM-driven viewer/integration behavior.
- Manual browser validation notes for the private D&D Beyond DOM assumptions touched by the MVP.

Excluded:

- Uploading full art.
- Any local art storage in `chrome.storage.local` or IndexedDB.
- Background service-worker business logic beyond what the extension platform requires to load.
- Delete cleanup prompts, `webRequest`, or deletion correlation.
- Cropping, portrait replacement, or any modification of D&D Beyond data.
- Broad permissions or speculative adapters for non-MVP pages.

## Current state
The repository currently contains product, architecture, testing, and planning documentation plus reference screenshots for later deletion-cleanup work. No extension scaffold, manifest, source tree, or automated test setup exists yet.

The MVP requirements are documented and intentionally narrow:

- enhance the existing right-side portrait panel, not the top-left portrait flow,
- show the currently displayed image fullscreen,
- preserve D&D Beyond behavior,
- remain local-only and permission-minimal.

## External assumptions
- Chrome Manifest V3 is the target extension platform and current Chrome supports the required content-script and dialog behavior.
- D&D Beyond character sheets live under URL patterns that can be matched reliably enough to restrict content-script execution to character pages.
- The right-side portrait panel and its portrait image can be identified with stable-enough DOM selectors or structural relationships.
- D&D Beyond may render the panel lazily and may re-render it during client-side navigation.
- The best available image URL is obtainable from the live DOM, preferably via `HTMLImageElement.currentSrc`.

Verification plan:

- Inspect the live D&D Beyond character sheet in Chrome DevTools before finalizing selectors.
- Verify the panel portrait element, clickable surface strategy, and rerender behavior on open/close and page navigation.
- Test at multiple viewport sizes to confirm the same assumptions hold or record explicit selector/layout fallbacks.
- Record the date and observed behavior in docs if implementation assumptions become concrete.

## Approach
Keep Phase 1 content-script-driven and avoid introducing future-phase machinery early.

Planned structure:

```text
src/
  content/
    character-sheet-entry.ts
  features/
    fullscreen-viewer/
      viewer.ts
      focus.ts
      viewer.css
  platform/
    dndbeyond/
      urls.ts
      selectors.ts
      portrait-adapter.ts
  shared/
    dom.ts
    types.ts
tests/
  unit/
  dom/
```

Implementation notes:

- The content-script entrypoint owns startup and teardown for the character sheet page.
- D&D Beyond selectors and structural assumptions stay under `platform/dndbeyond/`.
- The portrait adapter exposes a small typed contract such as `findPanelPortrait()` and `observePanelPortraits()`.
- The enhancement must be idempotent. Mark enhanced nodes with a namespaced data attribute so rerenders do not create duplicate listeners.
- The fullscreen viewer is a single extension-owned overlay per document with a tiny, explicit DOM surface rather than a generalized component system.
- The viewer should resolve the image URL from the live image element when opened, not cache assumptions earlier than necessary.
- No `preventDefault()` or interference with D&D Beyond handlers unless live behavior proves it is necessary.
- DOM observation should be narrow and reversible. Prefer observing a stable container or navigation root over observing `document.body` indefinitely.
- If selectors or image URLs are uncertain, do nothing rather than inject a broken interaction.

## Milestones
- [x] Create the ExecPlan and confirm MVP scope stays limited to fullscreen viewing on character sheets.
- [x] Verify live D&D Beyond DOM assumptions for the right-side portrait panel and document the observed selectors/relationships to use.
- [x] Scaffold the minimum extension project: manifest, TypeScript config, bundler, scripts, and test harness.
- [x] Implement character-sheet page matching and D&D Beyond portrait discovery behind a typed adapter.
- [x] Implement idempotent portrait enhancement with delayed-render and client-navigation handling.
- [x] Implement the accessible fullscreen viewer with focus management and reversible teardown.
- [x] Add unit tests for URL/ID parsing helpers that remain in scope.
- [x] Add DOM fixture tests for portrait discovery, repeated enhancement, viewer open/close, Escape, backdrop behavior, and focus restoration.
- [x] Run `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Perform the manual browser MVP checklist and record remaining risks or follow-up items.

## Validation
Automated:

- `npm run typecheck`
- `npm test`
- `npm run build`

Unit coverage target:

- character-sheet URL recognition
- character ID parsing if retained in the MVP code path
- runtime guards for typed adapter inputs where useful

DOM fixture coverage target:

- panel portrait discovery from minimal fixtures
- idempotent enhancement markers and duplicate-listener avoidance
- viewer open and close behavior
- Escape handling
- backdrop click close behavior
- image click no-close behavior
- focus entry and focus restoration
- observer teardown

Manual browser validation:

1. Load the unpacked extension in Chrome.
2. Open a D&D Beyond character sheet.
3. Click the top-left portrait and confirm D&D Beyond still opens its own panel normally.
4. Confirm the right-side panel portrait has a visible interactive affordance.
5. Click the panel portrait and confirm the fullscreen viewer opens with the expected image.
6. Confirm the image fits correctly in landscape and portrait browser sizes.
7. Close via Escape, close button, and backdrop click.
8. Confirm clicking the image itself does not close the viewer.
9. Confirm focus returns to the invoking portrait after close.
10. Repeat open/close several times and confirm no duplicate overlays or listeners appear.
11. Navigate between character pages without a full browser restart and confirm the enhancement still works.
12. Confirm unrelated D&D Beyond pages are unaffected.

## Risks and rollback
Primary risks:

- D&D Beyond DOM assumptions are unstable or differ across layouts.
- Mutation observation is too broad and causes unnecessary work.
- The enhancement accidentally interferes with D&D Beyond click handling.
- Accessibility behavior regresses if focus or teardown is incomplete.

Data safety:

- Phase 1 does not store or delete user artwork, which keeps the highest-risk product concerns out of scope.
- On uncertainty, the extension should not attach behavior or open the viewer.

Rollback:

- Remove or disable the content-script entrypoint from the manifest to stop all page interaction.
- Revert the portrait-enhancement code path while keeping the scaffold if DOM assumptions prove too unstable.
- Because Phase 1 does not mutate remote or local user data, rollback is operationally low-risk.

## Progress log
- 2026-08-06: Initial ExecPlan drafted from repository docs before project scaffold exists.
- 2026-08-06: Implemented the Phase 1 MV3 scaffold, content-script portrait enhancement, fullscreen viewer, build pipeline, and focused unit/DOM tests.
- 2026-08-06: Recorded the current sidebar hooks from the provided manage-pane DOM capture: `[data-testid="character-manage-pane"]`, `img.ddbc-character-avatar__portrait[alt="Character portrait"]`, and `.ct-sidebar__portal`.
- 2026-08-06: Automated validation passed with `npm run typecheck`, `npm test`, and `npm run build` using the local `nvm` Node 20 toolchain because the Homebrew `node` binary is linked against a missing ICU library on this machine.

## Decision log
- 2026-08-06: Keep Phase 1 content-script-only to minimize permissions and avoid premature background/storage abstractions.
- 2026-08-06: Treat live D&D Beyond DOM verification as an explicit milestone before implementation details are locked in.
- 2026-08-06: Do not scaffold Phase 2 and Phase 3 modules in the MVP unless they become necessary for the build or tests.
- 2026-08-06: Use the portrait image itself as the keyboard-focusable click surface to avoid adding overlay buttons or intercepting more of D&D Beyond's sidebar UI than necessary.
