# Feature List

This file tracks completed, user-facing features that are already part of the extension. The human runbook is `README.md`. Agent instructions are `AGENTS.md`. The D&D Beyond sheet reference is `docs/ddb-reference/`.

Future work belongs in `.agent/plans/` until it ships.

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

### Character journal

Status: shipped (beta)

Dylan approved this after live testing. It is on main as `acd760c`.
Journal ZIP backup and restore were approved after live export/import QA on
2026-10-22.

- Adds a Journal tab on the character sheet, after Extras.
- Opens each note in a slide-in panel that mirrors D&D Beyond's Information Sidebar.
- Closes a note when the user clicks outside the slide-in panel, while protecting unsaved edits with the existing discard confirmation.
- Searches, filters, and creates notes from a toolbar with search, Filter, and Manage Notes.
- Reads markdown, and edits it with an icon toolbar and an edit toggle.
- Preserves progress through long notes when switching between reading and editing.
- Exports every local journal as a ZIP with Markdown notes, photo files, and versioned `backup.json` recovery data.
- Imports that backup globally or for one matching character while preserving newer local notes and existing photos.
- Embeds photos inline as `![[img:<id>|caption|width]]`. The image button, paste, and drop insert one at the cursor. Large photos are resized automatically. The bytes stay in IndexedDB.
- Follows the sheet's light and dark theme.

Known caveats:

- Journal ZIP folders use the character ID until full-name capture is reliable.
- A long title is cut off in the edit-mode input.
- A plain line right after a list item joins that bullet. That is ordinary markdown.

Deferred follow-ups:

- Companion portrait manual visual QA and release
- Companion name, stats, health, and controls below the character header
- Cleanup when a character is deleted
