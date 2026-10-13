# D&D Beyond Character Deletion Research

## Observed behavior

Observed from Chrome DevTools on 2026-08-06 while deleting a character from:

```text
https://www.dndbeyond.com/characters
```

The screenshots in `docs/reference/` show:

```text
Request URL: https://character-service.dndbeyond.com/character/v5/character
Request method: DELETE
Status: 204 No Content
Request payload: { "characterId": 900000001 }
```

Reference files:

- `docs/reference/characters-delete-network-request.png`
- `docs/reference/characters-delete-request-payload.png`

This is an observed private-site behavior, not a supported public API contract.

## Product interpretation

The extension should react only after D&D Beyond has completed the deletion successfully. The extension does not cancel, delay, replace, or alter the request.

When local full art exists for the deleted character:

- preference `ask`: show the cleanup dialog,
- preference `delete`: delete local art,
- preference `keep`: preserve local art.

## Preferred implementation experiment

Start with `chrome.webRequest` in the Manifest V3 service worker because it can observe request lifecycle events without depending on D&D Beyond button markup.

Candidate flow:

1. Register a narrow `onBeforeRequest` listener for the exact character-service path.
2. Require method `DELETE` and initiator `https://www.dndbeyond.com`.
3. Attempt to decode a candidate character ID from the request body.
4. Store only short-lived candidate data keyed by `requestId`.
5. On `onCompleted`, require a successful status, then process cleanup.
6. On `onErrorOccurred`, discard the candidate.
7. Expire stale candidates defensively.

Do not use blocking listeners. The feature does not need to cancel or modify traffic.

## Important uncertainty

Chrome's webRequest documentation clearly supports requesting `requestBody`, but its documented `raw` body wording calls out PUT and POST. The observed D&D Beyond request uses DELETE with a JSON body.

Therefore, do not assume the DELETE body is available through `chrome.webRequest`. Verify it in the target Chrome version.

## Fallback experiment

If `chrome.webRequest` can observe completion but cannot expose the DELETE body, use a minimal MAIN-world network observer on the D&D Beyond characters page:

- wrap `fetch` and XMLHttpRequest only enough to identify the exact deletion request,
- do not modify arguments, headers, body, response, timing, or errors,
- capture only the character ID and success outcome,
- send a sanitized event to the isolated content script,
- validate every event before forwarding it to the service worker,
- namespace the event and keep the payload minimal.

Risks:

- page code can observe or spoof MAIN-world communication,
- D&D Beyond can change its network library,
- wrapping platform functions must preserve identity and behavior carefully.

Because the consequence is local cleanup, any ambiguity must resolve to keeping the art.

## Permissions to validate

A webRequest implementation is expected to require:

```json
{
  "permissions": ["webRequest"],
  "host_permissions": [
    "https://www.dndbeyond.com/*",
    "https://character-service.dndbeyond.com/*"
  ]
}
```

Keep the URL event filter narrower than the host permission wherever possible.

## Test matrix

- Successful 204 deletion with art, preference `ask`.
- Successful deletion without art.
- Successful deletion with preference `delete`.
- Successful deletion with preference `keep`.
- Server failure.
- Network failure.
- Malformed or missing request body.
- Duplicate lifecycle events.
- Two deletions in separate tabs.
- Service worker suspension between events.
- D&D Beyond endpoint path change.

## Safety invariant

No code path may delete local art unless all are true:

1. a character ID was parsed and validated,
2. the request matched the exact deletion operation,
3. successful completion was observed,
4. local art exists for that character,
5. the active preference or explicit user decision is `delete`.
