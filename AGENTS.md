# Repository Instructions

## Product context

This repository contains a Chrome Manifest V3 extension for D&D Beyond character art.

Before changing behavior, read:

- `docs/PRODUCT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `docs/DECISIONS.md`

For deletion-related work, also read:

- `docs/NETWORK_DELETE_RESEARCH.md`

## Engineering priorities

In order of importance:

1. Do not lose user artwork.
2. Do not break or block normal D&D Beyond behavior.
3. Keep Chrome permissions as narrow as the current feature allows.
4. Keep code easy for unfamiliar developers to read and change.
5. Prefer a small, direct implementation over a generalized framework.
6. Make D&D Beyond integration assumptions easy to locate and replace.

## Code organization

Use strict TypeScript.

Organize code by feature and platform boundary. Do not put the whole extension in one content script or one service worker file.

A reasonable shape is:

```text
src/
  background/
  content/
  features/
    fullscreen-viewer/
    character-art/
    deletion-cleanup/
  platform/
    chrome/
    dndbeyond/
  shared/
  styles/
tests/
```

The exact tree may evolve, but preserve these boundaries:

- D&D Beyond selectors and endpoint details live under a D&D Beyond adapter.
- Chrome API access lives behind small wrappers where testing benefits from it.
- UI components own their markup, behavior, and styles.
- Storage code is separate from DOM integration.

Avoid large files. As a guideline, consider splitting files that approach 250 lines when they contain more than one responsibility. Do not split cohesive code merely to satisfy a line count.

## Implementation style

- Prefer plain TypeScript, DOM APIs, and CSS for injected UI.
- Do not add React or another UI framework unless a later feature clearly earns it.
- Prefer named functions and explicit data types.
- Avoid `any`. When unavoidable at a browser boundary, narrow it immediately and explain why.
- Keep side effects near entrypoints. Put parsing and decision logic in pure functions.
- Do not introduce a dependency for a task that is clear and small in native browser APIs.
- Do not create speculative abstraction layers for features that do not exist yet.
- Comments should explain why, browser quirks, or external assumptions, not restate the code.

## D&D Beyond integration rules

- Never spread raw CSS selectors throughout the codebase. Centralize them in a selector adapter.
- Treat D&D Beyond DOM structure and private endpoints as unstable external contracts.
- Do not guess a selector or request payload when it can be verified in the live site.
- When an assumption is verified, document the date and the observed behavior.
- Use `MutationObserver` narrowly. Avoid observing the entire document indefinitely when a scoped root is available.
- Do not interfere with D&D Beyond click handlers. Add behavior only where required and avoid `preventDefault()` unless there is a demonstrated need.
- Namespace injected classes, data attributes, custom events, and element IDs with a project-specific prefix.

## Chrome extension rules

- Use Manifest V3.
- Keep host permissions limited to D&D Beyond origins required by the current milestone.
- Do not request `webRequest`, `unlimitedStorage`, or other broad permissions before the feature that needs them is implemented.
- Do not execute remote code.
- Keep stored artwork local unless a future product decision explicitly adds cloud sync.
- Store preferences and small metadata in `chrome.storage.local`.
- Store full image bytes in extension-origin IndexedDB when full-art upload is implemented.
- Do not use page-origin localStorage or IndexedDB from a content script for extension data.
- Treat extension service workers as ephemeral. Persist state instead of relying on global memory.

## User experience rules

- The extension should look native enough to avoid visual friction, but should not imitate D&D Beyond so closely that ownership is confusing.
- Fullscreen dialogs must be keyboard accessible.
- Escape closes dialogs.
- Focus moves into an opened dialog and returns to the initiating element when it closes.
- A visible close button is required.
- Respect reduced motion.
- User-facing errors should explain what failed and preserve user data.

## Validation

Before declaring a change complete, run the repository equivalents of:

```text
npm run typecheck
npm test
npm run build
```

Add or update tests for non-trivial parsing, storage, preference, and request-correlation logic.

For D&D Beyond DOM changes, include concise manual verification steps in the final report.

## Documentation

Update documentation in the same change when behavior, architecture, permissions, storage, or external assumptions change.

Record meaningful architecture changes in `docs/DECISIONS.md`.

## ExecPlans

For complex features, multi-file refactors, or work expected to take more than one focused coding session, create and maintain an ExecPlan as described in `.agent/PLANS.md`.
