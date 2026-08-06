You are starting a new Chrome extension repository from the context files already present in this working tree.

Read `AGENTS.md`, `.agent/PLANS.md`, and every file under `docs/` before writing implementation code. Inspect the two images under `reference/`, but treat them as context for a later deletion-cleanup phase, not as MVP scope.

Create and maintain an ExecPlan at `.agent/plans/phase-1-mvp.md`.

Then scaffold and implement Phase 1, the fullscreen portrait viewer MVP.

## Technical direction

- Chrome Extension Manifest V3.
- Strict TypeScript.
- Plain DOM and CSS for injected UI, no React or other UI framework.
- Use esbuild as the small bundler and Vitest for unit tests unless repository evidence gives a strong reason to choose otherwise.
- Keep source code split by responsibility. Do not build one giant content script.
- Centralize all D&D Beyond URL parsing and selectors in an adapter module.
- Keep the manifest permissions minimal for this milestone. Do not request `webRequest` or `unlimitedStorage` yet.
- Add formatting and linting only if they remain lightweight and the setup is obvious to a new contributor.

## MVP behavior

On a D&D Beyond character sheet URL such as `/characters/<characterId>`:

1. Allow D&D Beyond's existing portrait interaction to behave normally.
2. Detect the portrait image that appears in the right-side character panel after the user opens that panel.
3. Make that panel portrait clearly clickable without replacing it or changing the page layout.
4. Clicking it opens the same image URL in a fullscreen overlay.
5. The overlay has a dark backdrop, a visible close button, useful alternative text, and an image constrained to the viewport without distortion.
6. Escape closes the overlay.
7. Clicking the backdrop closes it, clicking the image does not.
8. Focus moves into the overlay and returns to the portrait when the overlay closes.
9. Opening and closing repeatedly must not duplicate listeners, styles, or DOM nodes.
10. The behavior must survive client-side navigation and delayed rendering.

## Live-site validation

If browser inspection is available, inspect the current D&D Beyond DOM and validate selectors against the live character sheet. Do not guess class names.

If browser inspection is unavailable:

- put all unverified selectors in one clearly named adapter,
- add diagnostics that make selector failures easy to understand in development,
- document the exact manual selector-validation step still required,
- do not pretend the integration has been validated.

Prefer stable attributes, semantic relationships, image URLs, and scoped structural selectors over generated class names. Add a small DOM fixture test for the observer and viewer wiring.

## Deliverables

- A readable repository structure.
- `manifest.json` generated or copied into the build output.
- Build, watch, typecheck, and test scripts.
- Unit tests for character ID parsing and overlay state/behavior where practical.
- A concise developer README with setup, build, load-unpacked, and manual test instructions.
- Updated architecture or decision docs for any choice that differs from the supplied context.
- A final report containing:
  - files and behavior implemented,
  - commands run and their results,
  - permissions requested and why,
  - live D&D Beyond checks completed,
  - remaining manual validation or known risks.

Do not implement full-art upload, IndexedDB image storage, cropping, or deletion cleanup in this phase. Leave clean extension points, not speculative implementations.
