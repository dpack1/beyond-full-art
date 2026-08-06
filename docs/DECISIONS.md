# Architecture Decision Log

## ADR-001: Chrome Manifest V3 and TypeScript

Status: Accepted

Use Chrome Manifest V3 and strict TypeScript.

Why:

- Manifest V3 is the current Chrome extension platform.
- TypeScript makes browser-message contracts, storage records, and DOM adapters easier to maintain.
- The runtime remains standard JavaScript.

## ADR-002: Plain DOM UI before a framework

Status: Accepted

Use plain DOM APIs and CSS for the viewer and early dialogs.

Why:

- The initial UI is small.
- A framework would add build weight and concepts without solving a current problem.
- Feature-local modules can remain readable without a component framework.

Revisit when the extension has enough screens and shared state that plain DOM code becomes harder, not merely different.

## ADR-003: Small bundler and normal source modules

Status: Proposed for scaffold

Use esbuild to bundle TypeScript entrypoints.

Why:

- Content scripts are easier to author as modules and bundle to browser-ready files.
- esbuild has a small configuration surface.
- It avoids a framework-specific extension abstraction.

Codex may choose an equivalently small setup if it documents a concrete advantage.

## ADR-004: Character ID is the storage key

Status: Accepted

Key all character-specific local data by the D&D Beyond character ID parsed from the character sheet URL or validated delete request.

Represent IDs as strings.

## ADR-005: Local-first storage split

Status: Accepted for Phase 2 direction

Use `chrome.storage.local` for preferences and metadata, and extension-origin IndexedDB for full image Blob data.

Why:

- Metadata is small and works naturally with extension storage.
- Full-resolution images can exceed normal extension-storage quotas quickly.
- Page-origin storage would be coupled to D&D Beyond browsing data and should not hold extension assets.

The exact large-file transfer path remains a required implementation spike.

## ADR-006: Network deletion is the primary cleanup signal

Status: Accepted as a direction, pending technical validation

Prefer the completed D&D Beyond deletion request over delete-button markup.

Why:

- Cleanup depends on successful deletion, not a click intent.
- Endpoint behavior is likely more semantically precise than UI structure.
- The extension does not need to block or alter the request.

Fallback behavior must preserve art when the character ID or request outcome is uncertain.

## ADR-007: Cleanup preference remembers the selected action

Status: Accepted

The cleanup prompt has two actions, `Delete art` and `Keep art`, plus `Remember my decision`.

When checked, the selected action becomes the global future preference. Default behavior is `ask`.

## ADR-008: Phase 1 ships without a background service worker

Status: Accepted

The fullscreen portrait viewer MVP ships as a content-script-only feature.

Why:

- Phase 1 does not need privileged browser events or extension-owned storage.
- Omitting a service worker keeps the scaffold smaller and easier to review.
- It preserves the narrow-permission strategy until later phases require more.
