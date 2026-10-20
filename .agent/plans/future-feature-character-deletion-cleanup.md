# Future Feature: Character Deletion Cleanup

## Goal
When a user deletes a D&D Beyond character that has locally stored full art, the extension safely decides what to do with that local art: prompt the user, delete it automatically, or keep it automatically based on an explicit stored preference.

## Scope
Included:

- Detect D&D Beyond character deletions narrowly and without blocking them.
- Correlate a successful deletion with one validated character ID.
- Check whether local full art exists for that character.
- Apply the stored cleanup preference: `ask`, `delete`, or `keep`.
- Show the cleanup dialog only after successful deletion and only when relevant local art exists.
- Persist and reset the cleanup preference.
- Add tests for request decoding, correlation, preference handling, and cleanup failure behavior.
- Update documentation for any new permissions, architecture boundaries, and observed D&D Beyond assumptions.

Excluded:

- Cropping, portrait generation, or any changes to upload/viewer behavior outside cleanup.
- Additional recovery UI beyond the current popup inventory and scoped cleanup decision.
- Blocking, delaying, or modifying D&D Beyond deletion requests.
- Broad data retention policies beyond the single global cleanup preference.
- Automatic cleanup on signals other than verified D&D Beyond character deletion.

## Current state
Phase 2 is complete:

- Full art can be stored locally per D&D Beyond character ID.
- Stored image bytes live in extension-origin IndexedDB.
- Stored metadata lives in `chrome.storage.local`.
- The fullscreen viewer prefers stored art and falls back to the D&D Beyond portrait.
- Users can remove stored full art manually from the fullscreen viewer.
- Users can download stored full art from the fullscreen viewer.
- The popup lists locally stored full-art records with per-item open, download, and delete actions.

What does not exist yet:

- No automatic deletion observer.
- No cleanup preference storage for automatic post-delete decisions.
- No post-deletion cleanup dialog.
- No `webRequest` permission.
- No MAIN-world bridge for network observation fallback.

## External assumptions
- The D&D Beyond characters page still issues a deletion request to `https://character-service.dndbeyond.com/character/v5/character` with method `DELETE`.
- A successful deletion still returns HTTP `204 No Content`.
- The request body still contains a JSON `characterId`.
- Chrome MV3 `webRequest` can observe the request lifecycle for the narrow target URL.
- It is not yet proven that `webRequest` exposes a DELETE request body in the target Chrome version.
- If `webRequest` cannot expose the body, a minimal MAIN-world fetch/XHR observer can capture only the sanitized character ID and completion result without changing page behavior.

Verification plan:

- Re-verify the request URL, method, status code, initiator, and body shape on the live site before implementation.
- Confirm whether `chrome.webRequest.onBeforeRequest` exposes the DELETE request body in the target Chrome build.
- If not, validate a MAIN-world observer prototype before asking for permanent architecture changes.
- Confirm behavior across retries, duplicate events, multiple tabs, and service worker suspension.

## Approach
Phase 4 should preserve the project’s core safety rule: never lose user artwork unless deletion is explicit and fully verified.

### Preferred design

Start with a narrow MV3 service-worker request observer:

1. Register `chrome.webRequest` listeners for the exact character-service deletion endpoint.
2. On `onBeforeRequest`, validate the origin and method, then attempt to parse one candidate `characterId`.
3. Store short-lived candidate request state keyed by `requestId`.
4. On `onCompleted`, require a successful response and then continue cleanup evaluation.
5. On `onErrorOccurred`, discard the pending candidate and preserve local art.

### Fallback design

If request bodies for DELETE are unavailable through `webRequest`:

1. Inject a minimal MAIN-world network observer only on the D&D Beyond characters page.
2. Detect the exact deletion request shape without mutating arguments, responses, timing, or errors.
3. Emit a namespaced, sanitized event containing only the candidate `characterId` and success/failure signal.
4. Receive and validate that event in the isolated content script, then forward a typed message to the service worker.

This fallback is less desirable because page code can observe or spoof MAIN-world communication. Any ambiguity must resolve to keeping the art.

### Cleanup decision flow

After successful correlation:

1. Load stored art metadata for the candidate character ID.
2. If no art exists, stop.
3. Load the global cleanup preference.
4. If preference is `keep`, stop.
5. If preference is `delete`, delete metadata first or bytes first only if failure handling remains recoverable; prefer the order already used by manual delete flows.
6. If preference is `ask`, show the cleanup dialog and wait for an explicit choice.
7. If the user chooses `Delete art`, perform the same delete path used elsewhere.
8. If `Remember my decision` is checked, persist the chosen preference.

### Storage additions

Add a narrow preference record in `chrome.storage.local`:

```ts
type CleanupPreference = 'ask' | 'delete' | 'keep';
```

Keep it separate from per-character art metadata so the two concerns do not drift together.

### UI additions

- A small cleanup dialog with:
  - message: `Delete stored full art?`
  - actions: `Delete art`, `Keep art`
  - checkbox: `Remember my decision`
- A settings control to reset the stored preference back to `ask`

The dialog must remain non-blocking with respect to D&D Beyond. Deletion has already happened before the extension prompt appears.

## Milestones
- [ ] Re-verify the live D&D Beyond deletion request and confirm the current request shape.
- [ ] Prove or reject `webRequest` request-body access for the DELETE body in the target Chrome version.
- [ ] Decide the observation boundary: pure `webRequest` or MAIN-world fallback.
- [ ] Add the minimum permissions and host permissions required by the chosen design.
- [ ] Implement typed request-correlation state in the service worker with expiration and failure cleanup.
- [ ] Add cleanup-preference storage and reset behavior.
- [ ] Implement the post-deletion cleanup decision flow and art deletion integration.
- [ ] Build the cleanup dialog and any minimal settings surface needed for preference reset.
- [ ] Add automated tests for parsing, correlation, preference transitions, and cleanup failures.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Perform manual browser validation across successful delete, failed delete, duplicate events, and no-art cases.

## Validation
Automated:

- `npm run typecheck`
- `npm test`
- `npm run build`

Unit coverage target:

- cleanup-preference validation and defaulting
- request-body decoding and character-ID validation
- request correlation and expiry rules
- duplicate completion handling
- failure-to-delete behavior

DOM/UI coverage target:

- dialog rendering only when relevant art exists
- remember-preference checkbox transitions
- settings reset behavior

Integration/manual coverage target:

1. Delete a character with stored art while preference is `ask`.
2. Choose `Keep art` once and confirm no preference is persisted.
3. Choose `Delete art` once and confirm the art is removed.
4. Repeat with `Remember my decision` enabled for both `delete` and `keep`.
5. Reset the preference to `ask` and confirm the dialog returns.
6. Delete a character with no stored art and confirm no prompt appears.
7. Simulate request failure or cancellation and confirm no prompt appears and no art is removed.
8. Attempt deletion in multiple tabs and confirm correlation stays scoped to the correct request.

## Risks and rollback
Primary risks:

- `webRequest` may not expose the DELETE request body, forcing a higher-risk fallback.
- Request correlation may break under duplicate events, retries, or service worker suspension.
- A permissive observer could accidentally trigger on unrelated traffic.
- Cleanup bugs could delete user art incorrectly.

Safety rules:

- Never delete local art without a validated character ID and a confirmed successful deletion.
- On uncertainty, preserve art.
- Keep pending request state short-lived and easy to inspect.
- Reuse the existing art-deletion implementation path instead of creating a second deletion flow.

Rollback:

- Remove the observation hook and permission changes.
- Keep the manual in-viewer delete path from Phase 2 intact.
- If the dialog or correlation logic proves unreliable, ship no automatic cleanup rather than a partial cleanup feature.

## Progress log
- 2026-08-06: Drafted the Phase 4 ExecPlan after Phase 2 merged to `main`.

## Decision log
- 2026-08-06: Treat `webRequest` as the first-choice observation seam, but do not commit to it until DELETE-body visibility is proven in the target Chrome version.
- 2026-08-06: Preserve the project’s default safety policy for ambiguous cleanup signals: keep the user’s local art.
