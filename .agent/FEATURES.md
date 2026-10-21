# Feature List

This file tracks completed, user-facing features that are already part of the extension. The human runbook is `README.md`. Agent instructions are `AGENTS.md`. The D&D Beyond sheet reference is `docs/ddb-reference/`.

Future work belongs in `.agent/plans/` until it ships. The character journal is not in the shipped list. Version 2 is implemented on the journal branch and stays here until Dylan approves it.

## Shipped Features

### Fullscreen portrait viewer

Status: complete

- Enhances the existing D&D Beyond character-sheet portrait experience without replacing the page UI.
- Opens the current character art in an accessible fullscreen viewer.
- Supports keyboard-friendly close behavior, focus restore, and backdrop dismissal.

### Local full-art storage

Status: complete

- Watches D&D Beyond portrait upload flows and preserves one original full-art image per character locally.
- Stores image bytes in extension-owned storage.
- Uses stored full art in the fullscreen viewer when available.
- Allows stored full art to be removed from the viewer.
- Allows stored full art to be downloaded from the fullscreen viewer.
- Lists stored full-art records in the extension popup with per-item open, download, and delete actions.

### Portrait crop workflow

Status: complete

- Lets a user keep full art locally while creating a separate D&D Beyond portrait crop.
- Supports crop creation and editing from the extension workflow.
- Keeps D&D Beyond portrait updates and extension full-art viewing aligned without overwriting the original full art.
- Supports both character-sheet and builder flows with extension-aware UI enhancements.

### Campaign card portrait quality upgrade

Status: complete

- Improves D&D Beyond campaign character-card portrait clarity by swapping eligible avatar URLs to higher-resolution requests.
- Keeps D&D Beyond's card layout, links, and portrait choices intact.
- Preloads upgraded images before swapping them into the page.
- Includes a popup setting so the enhancement can be enabled or disabled.
