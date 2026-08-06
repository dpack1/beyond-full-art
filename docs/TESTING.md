# Testing Strategy

## Test layers

### Pure unit tests

Cover logic that does not need a browser DOM:

- character sheet URL recognition,
- character ID parsing,
- cleanup preference transitions,
- request-body decoding,
- request lifecycle correlation,
- storage key generation,
- runtime message validation.

### DOM fixture tests

Use a lightweight DOM test environment for:

- portrait target discovery against saved minimal fixtures,
- idempotent enhancement,
- viewer open and close behavior,
- backdrop versus image clicks,
- Escape handling,
- focus restoration,
- observer teardown.

Fixtures should contain only the DOM needed for the behavior. Do not copy a large portion of D&D Beyond's page source into the repository.

### Storage tests

When full-art storage is implemented:

- create, read, replace, and delete,
- failed replacement preserves prior art,
- metadata and Blob consistency,
- schema migration,
- quota and write failure behavior,
- invalid image rejection.

### Manual browser tests

Automated tests cannot prove that private D&D Beyond DOM and endpoints still match assumptions. Every release touching an adapter requires live manual validation.

## MVP manual checklist

1. Build the extension.
2. Load the unpacked build directory in Chrome.
3. Open a D&D Beyond character sheet.
4. Click the top-left portrait and confirm D&D Beyond's panel still opens normally.
5. Confirm the portrait in that panel has a visible interactive affordance.
6. Click it and confirm the overlay opens with the expected image.
7. Confirm the image fits in landscape and portrait browser windows.
8. Close with Escape.
9. Reopen and close with the close button.
10. Reopen and close with the backdrop.
11. Confirm clicking the image itself does not close the viewer.
12. Confirm focus returns to the portrait.
13. Repeat open and close at least five times and inspect for duplicate overlays.
14. Navigate between character pages without a full browser restart.
15. Confirm the extension does nothing on unrelated D&D Beyond pages.

## Delete cleanup manual checklist

When Phase 3 is implemented:

1. Create disposable test characters and disposable local artwork.
2. Verify the exact request in DevTools.
3. Test `ask`, `delete`, and `keep` preferences.
4. Test `Remember my decision` with both buttons.
5. Force a failed request if practical and confirm art is preserved.
6. Delete two characters in quick succession and verify IDs do not cross.
7. Confirm no prompt appears when a character has no stored art.
8. Confirm resetting the preference returns behavior to `ask`.

## Release gate

A change is not complete until:

```text
npm run typecheck
npm test
npm run build
```

all pass, and the relevant manual checklist has been recorded in the pull request or release notes.
