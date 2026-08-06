# Product Specification

## Working title

Beyond Full Art

The title is provisional.

## Problem

D&D Beyond character portraits are displayed at a small size. A user can open the existing character panel, but the portrait inside that panel is not clickable and cannot be viewed at a useful size.

Users often start with a larger character illustration, then crop it tightly around the face so it reads well as a portrait. D&D Beyond retains and shows the portrait crop, but does not provide a convenient place to preserve and view the original full artwork.

## Product vision

Make character art feel like a first-class part of the D&D Beyond character sheet without replacing or redesigning D&D Beyond.

The extension should eventually let the user keep an original full artwork image for each character, use a crop as the D&D Beyond portrait, and open the original artwork by clicking the portrait in the right-side panel.

## Identity key

Use the D&D Beyond character ID as the stable local key.

Example URL shape:

```text
https://www.dndbeyond.com/characters/900000001
```

Represent IDs as strings in code. Do not depend on JavaScript number precision or perform arithmetic on them.

## Phase 1, MVP

### User story

As a D&D Beyond user, I can click the portrait shown in the existing right-side character panel and view it fullscreen, so I can actually see the artwork.

### Required behavior

- Run on D&D Beyond character sheet pages.
- Preserve D&D Beyond's existing top-left portrait click behavior.
- Enhance the portrait displayed in the existing right-side panel.
- Open the currently displayed portrait image in a fullscreen overlay.
- Close with Escape, a close button, or backdrop click.
- Keep image aspect ratio and fit it within the viewport.
- Work after delayed rendering and client-side navigation.
- Do not upload, replace, or modify D&D Beyond data.

### MVP limitation

The image opened fullscreen may still be D&D Beyond's cropped portrait. The MVP proves the interaction and page integration only.

## Phase 2, full-art storage

### User story

As a user, I can upload the original full artwork for a character and have it stored locally, so clicking the character portrait opens the full image rather than only the portrait crop.

### Required behavior

- Use D&D Beyond's existing portrait upload flow as the upload entrypoint.
- Support that portrait-management flow in both the sheet sidebar and the builder modal when those surfaces exist.
- Save the selected portrait-upload file locally as full art without blocking or modifying D&D Beyond's upload behavior.
- Associate one active full-art image with a character ID.
- Store image bytes locally in extension-origin IndexedDB.
- Store metadata and preferences in `chrome.storage.local`.
- Display the stored full artwork in the fullscreen viewer when available.
- Fall back to the D&D Beyond portrait when no full artwork is stored.
- Allow replacement via a later portrait upload and explicit deletion of stored art.
- Clearly communicate that uninstalling the extension removes locally stored art.

### Current implementation defaults

- Supported image types: `image/png`, `image/jpeg`, `image/webp`
- Maximum image size: `3 MB`
- Preserve exact uploaded bytes
- One active full-art image per character
- No derived preview image yet
- The current implementation observes D&D Beyond's portrait upload input and does not add a separate extension-owned file picker

### Deferred product decisions

- Whether images should ever be resized or compressed before storage.
- Backup and export behavior.
- Multiple images per character.

## Phase 3, character deletion cleanup

### User story

As a user who deletes a D&D Beyond character, I can choose whether the extension also deletes the locally stored full artwork for that character.

### Prompt behavior

After D&D Beyond successfully deletes a character, and only when local art exists for that character, show:

**Delete stored full art?**

Actions:

- `Delete art`
- `Keep art`

Checkbox:

- `Remember my decision`

There is no Cancel action because D&D Beyond has already processed the character deletion. The extension prompt controls only local artwork cleanup.

### Remembered behavior

Store one global cleanup preference:

```text
ask | delete | keep
```

- Default is `ask`.
- With `Remember my decision` unchecked, perform the selected action once and remain on `ask`.
- With it checked, `Delete art` saves `delete` and `Keep art` saves `keep`.
- Provide a settings control to return the preference to `ask`.
- Never infer a remembered decision from a dismissed or failed dialog.

### Data safety

- Prompt only after a successful deletion response.
- If the deletion request fails, preserve local art and do not prompt.
- If the character ID cannot be determined confidently, preserve local art.
- If storage deletion fails, show an error and preserve recoverability where possible.

## Phase 4, cropping

Allow the user to upload original artwork, select a crop for portrait use, and preserve the original separately.

This phase requires research into whether and how D&D Beyond portrait upload can be safely automated beyond passive observation. Do not assume the extension can programmatically update D&D Beyond's portrait until verified.

## Non-goals for early phases

- Rebuilding the D&D Beyond character sheet.
- Cloud accounts or cloud sync.
- Sharing artwork with other users.
- AI image generation.
- Automatically collecting images from unrelated pages.
- Modifying D&D Beyond network requests.
- Blocking character deletion.
- Depending on undocumented endpoints for more data than the feature requires.

## Success criteria

The MVP is successful when a user can install the unpacked extension, open a character sheet, open the existing right-side portrait panel, click its portrait, and reliably view and dismiss a fullscreen image without disrupting the page.
