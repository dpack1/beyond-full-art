# Contributing

Beyond Full Art is MIT licensed. See [LICENSE](LICENSE).

## Setup

Node.js 20 (`.nvmrc` is `20.18.0`).

```text
nvm use
npm install
npm test
npm run build
```

Load `dist/` from `chrome://extensions`. The human steps are in [README.md](README.md). The working agreement for code changes is [AGENTS.md](AGENTS.md).

## What to keep intact

- Do not lose stored artwork, notes, or photos.
- Do not block D&D Beyond's own clicks.
- Put a new D&D Beyond selector in `src/platform/dndbeyond/selectors.ts`.
- Keep character ids as strings.
- Keep Chrome permissions as narrow as the feature needs.
- Do not commit `dist/`, `release/`, `node_modules/`, or `test-results/`.

A change to storage, requests, or selectors needs `npm run typecheck`, `npm test`, and `npm run build`. Content-script changes also need `npm run test:e2e` when a local fixture can see them.

## Reports

Bugs and features go to [GitHub issues](https://github.com/dpack1/beyond-full-art/issues). Security reports follow [SECURITY.md](SECURITY.md). Please leave out character files, session cookies, and backup-folder contents.
