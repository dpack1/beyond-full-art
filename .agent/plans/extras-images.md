# Companion portrait from Extras

## Goal

Let a player choose one companion from D&D Beyond's **Extras** section and
keep that companion visible beside the character. The first slice adds an
extension-owned checkbox to each usable Extras row and shows the selected
companion's existing portrait over the bottom-right corner of the character's
header portrait.

The feature is controlled by a checkbox in the Beyond Full Art popup. Turning
the feature off removes the Extras controls and the portrait overlay without
forgetting the per-character selection.

## Scope

Included in the first slice:

- One selected companion per D&D Beyond character.
- An extension-owned checkbox on each Extras sidebar just like how inventory pact weapon checkbox works similar to the ct-item-detail__class_customize (<div class="ddbc-checkbox character-checkbox  ddbc-checkbox--is-enabled character-checkbox-enabled ddbc-checkbox--is-interactive character-checkbox-interactive" role="checkbox" aria-checked="true"><div class="ddbc-checkbox__input character-checkbox-input"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1792 1792" class="ddbc-svg ddbc-check-svg ddbc-svg--positive"><path fill="#00c680" d="M1671 566q0 40-28 68l-724 724-136 136q-28 28-68 28t-68-28l-136-136-362-362q-28-28-28-68t28-68l136-136q28-28 68-28t68 28l294 295 656-657q28-28 68-28t68 28l136 136q28 28 28 68z"></path></svg></div><div class="ddbc-checkbox__label character-checkbox-label">Pact Weapon</div></div>).
- Selecting another companion replaces the current selection for that
  character; clearing the selected checkbox hides the overlay.
- A small bottom-right portrait overlay on the character header image.
- A popup setting that enables or disables the entire feature and defaults to
  enabled, consistent with the existing optional settings.
- Per-character selection metadata in `chrome.storage.local`.
- Live updates when the popup setting or selected companion changes.
- Light mode, Underdark Mode, narrow layouts, client-side navigation, Extras
  filtering, and Extras rows that remount.

Explicitly excluded from the first slice:

- Companion name, armor class, hit points, speed, notes, or action controls
  under the character identity bar.
- Multiple simultaneous portrait overlays.
- Editing an Extra or changing hit points from the header.
- Copying companion image bytes into IndexedDB.
- Scraping private D&D Beyond endpoints or modifying D&D Beyond requests.
- Inventing avatar URL transformations to request a larger image.
- Showing a companion on campaign cards, the My Characters page, or other
  users' character sheets.

Those richer identity, stat, health, and control surfaces are a follow-up
phase after the portrait selection and remount behavior are reliable.

## Current state

- The portrait-only first slice is implemented in the character-sheet content
  script, popup, selector map, D&D Beyond adapter, and focused storage module.
- The saved Matilda/Petali fixture covers the verified header portrait and
  Extras row structure used by selector-health and DOM tests.
- Live inspection on 2026-10-22 found no stable Extra ID in the row. The
  adapter uses normalized group, name, and type, adding the exact image URL
  only when duplicate base identities occur.
- Automated non-browser validation is complete. Manual visual QA on the
  unpacked build remains before this moves to `.agent/FEATURES.md` as shipped.

## External assumptions

The Matilda/Petali assumptions below were verified on 2026-10-22 before the
selectors were added:

- An owned character sheet renders each Extra as a bounded row with a name and
  an image URL that can be read from an `img`, `currentSrc`, `src`, or a CSS
  background image.
- No stable Extra identifier was present in the observed row markup. The
  implementation therefore uses a documented normalized group/name/type key
  and disambiguates duplicate base identities with the exact rendered URL.
- The character identity bar has a stable portrait surface and a container
  that can accept one absolutely positioned extension-owned child without
  changing the native layout.
- Extras content can unmount when its tab, secondary filter, search, or sheet
  route changes.
- Reusing the exact image URL already rendered by D&D Beyond does not require
  another Chrome permission.

Verification steps:

1. On Matilda Greywolf, capture the DOM for the header portrait and the full
   Petali Extras row in light and Underdark modes.
2. Add the relevant structure to `docs/ddb-reference/README.md` with a date and
   provenance tag. Save a minimal fixture rather than a full page dump.
3. Check a character with two Extras, if available, including duplicate or
   similar names and different Extra types.
4. Confirm what happens to the row DOM when switching All/Familiar, filtering,
   opening a row, changing the Extra's image, and navigating between characters.
5. Put every verified D&D Beyond selector in
   `src/platform/dndbeyond/selectors.ts` before feature code uses it.

If the header or row contract cannot be identified confidently, stop after
the reference/fixture milestone. Do not spread text and ancestry guesses
through the feature.

## Approach

### User flow

1. The popup setting **Companion portrait on character sheet** is enabled.
2. The user opens **Extras**.
3. Each Extra with a readable portrait gains a checkbox labeled for assistive
   technology as `Show <name> beside character portrait`.
4. Checking it stores that Extra as the character's one selected companion.
5. The companion portrait appears over the bottom-right of the character's
   header portrait without blocking the native portrait click target.
6. Checking another Extra moves the selection. Clearing the selected checkbox
   removes the overlay.
7. Disabling the popup setting removes the injected controls and overlay but
   keeps the selection. Re-enabling restores it.

### D&D Beyond adapter

Add `src/platform/dndbeyond/extras-companion-adapter.ts`. It should expose
typed targets rather than raw selectors to feature code:

```ts
interface ExtrasCompanionTarget {
  identity: string;
  imageUrl: string;
  name: string;
  row: HTMLElement;
  type: string | null;
}

interface CharacterHeaderPortraitTarget {
  container: HTMLElement;
  portrait: HTMLElement;
}
```

The adapter owns:

- finding verified Extras rows and extracting a companion target,
- finding the verified character-header portrait target,
- narrowly observing the character sheet/content host for row remounts,
- deduplicating targets with `data-bfa-` markers,
- returning cleanup functions for every observer.

The adapter must tolerate rows without an image by omitting the extension
checkbox for that row. It must not treat the site header avatar, Information
Sidebar portrait, or journal panel as the character-header portrait.

### Selection storage

Keep the record small and versioned in `chrome.storage.local`; do not copy the
image bytes:

```ts
interface CompanionPortraitSelection {
  schemaVersion: 1;
  characterId: string;
  companionId: string;
  name: string;
  type: string | null;
  imageUrl: string;
  updatedAt: string;
}
```

Proposed keys:

```text
bfa.preferences.companionPortraitEnabled
bfa.companionPortrait.selection.<characterId>
```

Add a focused `src/platform/chrome/companion-portrait-storage.ts` instead of
making the already broad storage module own another record family. Validate
all reads. The preference defaults to `true`. A disabled preference does not
delete the selection record.

The stored URL is a snapshot so the overlay can render before the user opens
Extras after a refresh. Whenever the selected row remounts, refresh its name,
type, and exact current image URL. If the stored URL fails to load, hide the
overlay, leave the selection recoverable, and refresh it the next time the row
is observed.

### Sheet feature

Add `src/features/companion-portrait/` with small modules for the controller,
view, styles, and types. Install it from `character-sheet.ts` alongside the
existing sheet features.

The controller should:

- bind the current string character ID,
- load the popup preference and per-character selection,
- inject and reconcile row checkboxes whenever Extras mounts,
- enforce one checked companion per character,
- render or remove one overlay when selection, preference, route, header, or
  image load state changes,
- listen for relevant `chrome.storage.onChanged` events so multiple tabs and
  the popup stay in sync,
- remove every observer, listener, marker, checkbox, style, and overlay during
  teardown.

Checkbox events may stop propagation so the Extra row does not also open, but
must not call `preventDefault()` on the checkbox's own state change or alter
D&D Beyond's native row behavior elsewhere.

### Overlay view

The overlay is a native-sidebar shortcut:

- extension-owned classes and attributes use `bfa-` / `data-bfa-`,
- placed at the bottom-right of the header portrait,
- roughly 40% of the native portrait width, with a sensible minimum and
  maximum so it remains legible on narrow layouts,
- square crop with `object-fit: cover`, a small border, and enough contrast in
  light and dark modes,
- its click and keyboard target opens the selected Extra's native sidebar,
- events stop at the small overlay so the player portrait is not also opened,
- meaningful alt text using the selected companion name,
- no animation beyond an optional reduced-motion-safe opacity transition.

Do not hardcode Matilda's red theme. Sample a verified sheet accent where
available or use a neutral high-contrast border.

### Popup setting

Add a third setting section after **Character Journal tab**:

- Label: **Companion portrait on character sheet**
- Hint: **Choose one companion in Extras and show its portrait beside your character.**
- Status text mirrors the existing setting behavior.

Use the shared popup checkbox handler and add preference synchronization if a
storage change can arrive while the popup is open.

### Follow-up phase: companion summary and controls

After the portrait slice passes live QA, research a separate compact row under
the character identity bar containing the selected companion's name and a
small set of verified values such as AC, current/max hit points, and speed.
Any health or action controls must call D&D Beyond through its normal UI or a
separately verified contract; they must not be inferred from the screenshot or
implemented by mutating visible text. This follow-up needs its own decision and
updated ExecPlan before implementation.

## Milestones

- [x] **M1: Reference capture.** Record the live header portrait and one full
  Extras row, verify an identity/image contract, update the sheet reference,
  and add minimal saved fixtures.
- [x] **M2: Selector and adapter boundary.** Add selector-map entries, selector
  health coverage, typed row/header targets, narrow observation, and teardown
  tests.
- [x] **M3: Versioned selection storage.** Add validated preference and
  per-character selection reads/writes, including default, invalid-record,
  route, and deletion tests.
- [x] **M4: Extras selection controls.** Inject accessible checkboxes, enforce
  one selection, survive row remounts/filtering, and avoid opening or blocking
  the native row.
- [x] **M5: Header portrait overlay.** Render the stored selection immediately,
  refresh from the mounted row, handle image failure, preserve native clicks,
  and support light/dark and narrow layouts.
- [x] **M6: Popup feature toggle.** Add the third setting, status behavior, live
  sheet synchronization, and tests proving selection is retained while off.
- [ ] **M7: Documentation and release QA.** Update product, architecture,
  implementation, decisions, testing, README, and shipped-feature docs; run
  automated and manual validation.

## Validation

Automated checks for this content-script and selector-map change:

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Required focused coverage:

- selector-health errors name every new header/Extras selector and affected
  feature,
- Extras rows with an image receive one checkbox; image-less rows receive none,
- selecting, replacing, and clearing one companion,
- duplicate observer notifications do not duplicate controls or overlays,
- Extras filter/tab remounts restore the correct checked state,
- stored selection loads before Extras is opened,
- malformed stored records and failed images do not render broken UI,
- popup off removes UI but retains the selection record,
- popup on restores controls and overlay live,
- client-side character navigation never carries a selection across character
  IDs,
- cleanup removes observers, listeners, controls, styles, and overlay,
- native portrait and Extra row interactions still work.

Manual browser QA on Matilda Greywolf and, if available, a character with two
Extras:

1. Enable the popup setting and open Extras in light mode.
2. Select Petali and confirm one portrait overlaps the header portrait's
   bottom-right corner without shifting the identity bar.
3. Click the native character portrait and the Extra row outside the checkbox;
   confirm both native actions still work.
4. Switch Extras filters, search, another sheet tab, and back; confirm one
   checkbox and one overlay remain.
5. Refresh without first opening Extras; confirm the stored overlay appears.
6. Select a second companion; confirm the first checkbox clears and the
   overlay changes.
7. Turn the popup setting off and on; confirm UI hides/restores and the choice
   is retained.
8. Switch between light and Underdark modes and test a narrow viewport.
9. Navigate between two character URLs in one tab and confirm selections stay
   character-specific.
10. Remove or change the selected Extra/image in D&D Beyond and confirm the
    extension fails safely and refreshes when the row is next observed.

Run the logged-in live selector check from `docs/TESTING.md` because this phase
adds D&D Beyond selectors.

## Risks and rollback

Primary risks:

- Extras rows and the header portrait may use unstable or hashed DOM classes.
- The same companion name may appear twice, making a name-derived key unsafe.
- Extras content remounts frequently and can duplicate injected controls.
- The overlay can accidentally cover D&D Beyond's native portrait hit target.
- A saved CDN URL can expire or change when the Extra is edited.
- A global popup setting and per-character selection can drift across tabs.

Safety rules:

- Centralize and verify selectors before implementation.
- Prefer a stable D&D Beyond Extra ID; test duplicates before accepting a
  composite fallback.
- Make every mount idempotent and every observer disposable.
- Keep the overlay interaction isolated and remove it when its image fails.
- Never delete or modify an Extra, companion image, character portrait, or
  local full art.
- On uncertain row identity, do not select or overwrite the stored record.

Rollback:

- The popup preference can disable all injected companion UI while retaining
  the selection.
- Removing the feature installer, popup section, selectors, and preference
  listener restores the current sheet behavior; the small selection records
  can remain harmlessly in local storage or be removed in a later explicit
  cleanup.
- No manifest permissions, IndexedDB schema, or D&D Beyond data need to be
  rolled back.

## Progress log

- 2026-10-22: Expanded the original Extras-images note into an implementation
  plan. Chose a portrait-only first slice and deferred stats, health, and
  controls until the selection and DOM contracts are proven.
- 2026-10-22: Implemented the portrait-only slice, verified type checking,
  focused Vitest coverage, and the production build. Manual visual QA remains;
  Chrome-based tests are not to be run on this computer at Dylan's request.
- 2026-10-23: Replaced the abandoned compact-stat/HP direction with a simple
  overlay shortcut that opens the selected Extra's native sidebar.

## Decision log

- 2026-10-22: The first slice supports one selected companion per character.
  Checkboxes honor the requested Extras interaction while selecting a new row
  replaces the prior choice.
- 2026-10-22: The popup setting defaults on and hides UI without deleting the
  per-character selection, matching the extension's existing optional-feature
  behavior.
- 2026-10-22: Store only validated companion metadata and the exact rendered
  image URL in `chrome.storage.local`; do not copy image bytes or transform the
  URL.
- 2026-10-23: Make the overlay keyboard-accessible and open D&D Beyond's native
  Extra sidebar rather than duplicating stats or HP controls.
- 2026-10-22: The observed Extras row has no stable ID. Use normalized
  group/name/type as the base identity and append the exact image URL only for
  duplicates.
