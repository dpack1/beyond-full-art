# Open Questions and Validation Items

These are not product ambiguities that block the MVP. They are implementation details that require live evidence or a later product decision.

## MVP live-site questions

- Which stable DOM attributes or structural relationships identify the right-side character panel portrait?
  - Observed on 2026-08-06 from the provided manage-pane subtree: `[data-testid="character-manage-pane"]` contains `img.ddbc-character-avatar__portrait[alt="Character portrait"]`, with `.ct-sidebar__portal` available as a sidebar portal root.
- Does D&D Beyond replace the portrait node when the panel rerenders?
- Does client-side navigation reuse the same document?
- Is `currentSrc` the best available image URL, or is a larger source already present in `srcset`, a parent link, or page data?
- Are there alternate character sheet layouts at different viewport widths?

## Full-art storage questions

- Which stable DOM attributes identify D&D Beyond's portrait-management upload flow across the sheet sidebar and builder modal?
  - Observed on 2026-08-06 from the provided DOM captures: both flows contain `.ct-decoration-manager` with `.ct-decoration-manager__upload` and `.ct-decoration-manager__upload-file-input[type="file"]`.
- Maximum accepted file size.
  - Current implementation default: `3 MB`, aligned to the observed D&D Beyond portrait-upload UI text.
- Supported MIME types.
  - Current implementation default: `image/png`, `image/jpeg`, `image/webp`
- Whether to keep exact source bytes or normalize images.
  - Current implementation preserves exact source bytes.
- Whether to create a smaller preview for faster viewer startup.
  - Current implementation does not create one.
- How to transfer a large selected File into extension-origin IndexedDB without wasteful encoding.
  - Current implementation uses structured-clone transfer of an `ArrayBuffer` plus metadata to the MV3 service worker.
- Whether a future phase should also support a separate full-art file that differs from the current D&D Beyond portrait upload.
- Whether bulk export or backup is required before public release.
  - Current implementation supports downloading the active stored full art from the fullscreen viewer and per-item download from the popup inventory.

## Character copy questions

- Should a later pass also offer to copy stored full art? This pass copies the journal and photos only.

## Deletion cleanup questions

- Is the characters list the only user-accessible deletion surface?
- Is the observed endpoint consistent across accounts and current site versions? The 2026-08-06 headers screenshot shows 200 OK. The extension accepts 200 and 204.
- Does `chrome.webRequest` expose a DELETE JSON request body in the target Chrome version? The cleanup path works without it. A live delete should still confirm whether the body arrives, because that path does not trust the page for the character id.
- Can request completion be reliably correlated after service worker suspension?
- Is the request always associated with the active tab?
- What should an orphan-art manager look like when the user chooses to keep art after deleting a character?

## Cropping questions

- Can D&D Beyond's existing portrait upload flow accept a generated crop through supported UI interaction?
- Is direct endpoint integration allowed or desirable?
- Which crop aspect ratio and preview sizes match D&D Beyond's portrait rendering?
