<p align="center">
  <img src="assets/readme/banner.png" alt="Beyond Full Art banner" width="900" />
</p>

Beyond Full Art is a Chrome Manifest V3 extension for D&D Beyond character art. It keeps D&D Beyond's portrait flow and adds local full-art storage, a portrait crop tool, a fullscreen viewer, sharper character-card portraits, and a local character journal.

This file is the runbook: what the extension does, how to install it, and how to build, run, and test it. Product and architecture detail lives in `docs/`. Agent-facing conventions live in `AGENTS.md`.

## The problems it solves

### Cropping full-size character art can be awkward

If you start with a full illustration, getting the portrait framing right is awkward. You usually have to crop the image somewhere else first, upload it, then repeat the process until it looks right.

Beyond Full Art adds an in-browser portrait crop flow so you can frame the portrait you want while keeping the original full image.

### Character art is often too small to fully appreciate

Portraits on the sheet are tiny. That means it is hard to appreciate your own character art, and it is even harder to get a nice look at another player's character in a campaign.

Beyond Full Art adds a fullscreen viewer so character art can actually be seen at a useful size.

## Features

The toolbar icon opens one popup. That popup holds the optional settings and the stored-art inventory.

### Fullscreen viewer

On a character sheet, the extension makes the portrait in the right-side information panel open a fullscreen overlay. If full art is stored for that character, the viewer shows that image. Otherwise it shows the current D&D Beyond portrait. Escape, the close button, or the backdrop dismisses it, and focus returns to the portrait.

### Portrait edit panel

Inside D&D Beyond's portrait manager (the sheet sidebar and the builder modal), the extension injects its own status and actions. That panel shows the current stored full art, a preview of a newly chosen image, and **Crop portrait** or **Edit portrait crop**. Narrow sidebars use a compact layout. It keeps D&D Beyond's file picker and saves the selected file locally only after the native **Change Portrait** button is used.

### Portrait crop

The crop dialog frames a square from the stored full art, or from a file that has been chosen but not yet confirmed. Applying the crop produces a 512×512 PNG and hands it back through D&D Beyond's existing portrait upload input. The original full art stays stored separately. Replacing the full art invalidates the saved crop.

### Art download and removal

When the viewer is showing stored full art, **Download full art** saves that file through a normal browser download. The same viewer can **Remove stored full art**. Removal deletes only the local copy. The D&D Beyond portrait stays as it is. Downloads use a temporary link and the existing `storage` permission.

### Extension popup: settings and stored-art inventory

Click the toolbar icon to open the popup.

- **Improve character card portraits** upgrades small campaign and My Characters avatars to a sharper image URL. It is on by default.
- **Character Journal tab** shows or hides the sheet's Journal tab. Turning it off does not delete entries. It is on by default.
- **Stored full art** lists every locally saved full-art image, with the file name, character ID, size, and updated date. Each row can **Open** the character sheet, **Download** the image, or **Delete** the local copy.

### Character card portraits

On campaign pages and `https://www.dndbeyond.com/characters`, enabled card portraits swap to a larger avatar URL after the page renders. A card pulses while it upgrades and flashes briefly when the sharper image is in place.

### Character journal

On a character sheet, a **Journal** tab is inserted after D&D Beyond's **Extras** tab. The journal is an extension-owned section in the sheet content area. It can create, edit, save, and delete text entries for that character. An Images area is visible as a placeholder for a later image upload. Entries stay in `chrome.storage.local`, separate from D&D Beyond notes, backstory, and extras.

### Not built yet

Character-deletion cleanup is specified in `docs/PRODUCT_SPEC.md` and researched in `docs/NETWORK_DELETE_RESEARCH.md`. The extension does not yet notice when a D&D Beyond character is deleted, and it does not offer to delete the matching local art.

## Screenshots

<table>
  <tr>
    <td align="center" valign="top">
      <strong>Fullscreen art viewing</strong>
      <br />
      Open character art at a size that actually lets you appreciate it.
      <br /><br />
      <img src="assets/readme/svg/fullscreen-viewer.svg" alt="Fullscreen art viewer opened from the character portrait" height="320" />
    </td>
    <td align="center" valign="top">
      <strong>Better portrait cropping</strong>
      <br />
      Frame a square portrait from full-size art without leaving D&amp;D Beyond.
      <br /><br />
      <img src="assets/readme/svg/portrait-crop-dialog.svg" alt="Portrait crop dialog with live drag and zoom editing" height="320" />
    </td>
  </tr>
</table>

### Where to find these in D&D Beyond

<p align="center">
  <strong>Character sheet</strong><br />
  Open the normal portrait area on the character sheet to view art fullscreen, then use the portrait tools in the sidebar.
</p>
<p align="center">
  <img src="assets/readme/svg/sidebar-entry-point.svg" alt="Right-side character pane with the normal portrait entry point" height="320" />
  <img src="assets/readme/sidebar-compact-layout.png" alt="Compact right-sidebar portrait tools on the character sheet" height="320" />
</p>

<p align="center">
  <strong>Builder modal</strong><br />
  Use the portrait manager in the builder to save full art, preview the portrait crop, and keep the portrait and artwork connected in one flow.
</p>
<p align="center">
  <img src="assets/readme/builder-current-full-art.png" alt="Builder portrait manager showing the current custom portrait and current full art" height="320" />
  <img src="assets/readme/svg/builder-proposed-full-art.svg" alt="Builder portrait manager showing the proposed full art and portrait preview before confirming" height="320" />
</p>

## Install

There is no Chrome Web Store release yet. Install the unpacked build.

### 1. Build the extension

Node.js 20 is required (`.nvmrc` is `20.18.0`).

```bash
nvm use
npm install
npm run build
```

If your local `node` path is not already active, use:

```bash
PATH="$HOME/.nvm/versions/node/$(cat .nvmrc)/bin:$PATH" npm run build
```

The build writes a loadable extension to `dist/`. Chrome loads those compiled files directly.

### 2. Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository's `dist/` folder.

## How to use

### View full art

1. Open a D&D Beyond character sheet.
2. Click the normal portrait to open D&D Beyond's portrait pane.
3. Click the portrait inside that pane.
4. The extension opens the image fullscreen.

### Save full art

1. Open D&D Beyond's portrait manager.
2. Choose a portrait image through D&D Beyond's normal upload flow.
3. Click D&D Beyond's native portrait confirmation button.
4. The extension saves that same source image locally as full art.

### Crop a portrait

1. Open the portrait manager after full art is available.
2. Choose **Crop portrait** or **Edit portrait crop**.
3. Drag and zoom until the portrait framing looks right.
4. Apply the crop.
5. Finish the D&D Beyond portrait flow if it asks you to confirm the change.

### Download or remove stored art

1. Open the fullscreen viewer for a character that has stored full art.
2. Choose **Download full art** or **Remove stored full art**.
3. Or open the toolbar popup and use **Download** or **Delete** on that character's inventory row. **Open** goes to the character sheet.

### Improve character card portraits

1. Click the extension icon in Chrome.
2. Enable or disable **Improve character card portraits**.
3. Open a D&D Beyond campaign page or the My Characters page.
4. When enabled, character cards progressively swap to a sharper portrait source after the page renders.

### Use the character journal

1. Leave **Character Journal tab** enabled in the popup.
2. Open a character sheet and choose **Journal**, immediately after **Extras**.
3. Write a title and note, then **Save**. **New entry** starts another note. **Delete** removes the selected entry.
4. Choose a native D&D Beyond tab to return to the normal sheet. Disabling the popup setting hides the Journal tab and leaves the saved entries in place.

## Developer runbook

### Architecture

```text
D&D Beyond tab
  -> content scripts (sheet, card portraits)
  -> feature UI (viewer, edit panel, crop dialog, journal)
  -> runtime messages
  -> service worker
       -> chrome.storage.local (metadata, preferences, journal text)
       -> IndexedDB (full-art and crop image bytes)

Toolbar popup
  -> the same storage and art messages
```

| Path | Role |
| --- | --- |
| `src/content/` | Content-script entrypoints. The sheet entry installs the page features. |
| `src/features/` | Viewer, art controls, crop, card portraits, and journal UI. |
| `src/platform/dndbeyond/` | Selectors, URL parsing, and D&D Beyond DOM adapters. |
| `src/platform/chrome/` | Storage, IndexedDB, and runtime-message validation. |
| `src/background/service-worker.ts` | Owns art reads and writes. Treat it as ephemeral. |
| `src/popup/` | Toolbar popup: two settings and the stored-art inventory. |
| `src/shared/` | Small DOM, download, and result helpers. |
| `tests/unit`, `tests/dom`, `tests/e2e` | Pure logic, jsdom fixtures, and Playwright extension fixtures. |
| `docs/` | Spec, architecture, decisions, test checklists, and deletion research. |

D&D Beyond selectors and private endpoints are unstable. They belong in `src/platform/dndbeyond/`. The longer design notes are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Commands

| Command | What it does |
| --- | --- |
| `npm run build` | Clean `dist/` and bundle the extension. |
| `npm run watch` | Rebuild the script bundles when source changes. Leave it running while you work. |
| `npm run typecheck` | Strict TypeScript check. No emit. |
| `npm test` | Vitest unit and DOM tests. |
| `npm run test:e2e` | Build, then run Playwright against local fixtures. |
| `npm run test:all` | Typecheck, unit/DOM tests, build, and Playwright. |

`npm run watch` copies `manifest.json`, icons, and `src/popup/settings.html` once at startup. After editing those static files, stop watch and run `npm run build`. CSS imported with `?raw` is part of the script bundles, so watch does rebuild it.

### Start and stop

This is an unpacked extension, not a server.

1. Run `npm run build`, or leave `npm run watch` running.
2. Load `dist/` from `chrome://extensions`, as in [Install](#install).
3. Open a D&D Beyond character, campaign, or My Characters page.

After a source change:

1. Let `npm run build` or the watch rebuild finish.
2. Click **Reload** on the Beyond Full Art card in `chrome://extensions`.
3. Refresh the D&D Beyond tab so the content scripts load again.

Stop it without deleting saved art by turning the extension off in `chrome://extensions`. **Remove** uninstalls it and drops extension storage, including local art and journal entries. Stop `npm run watch` with Ctrl+C. That stops the rebuild process.

### Tests

Automated tests use saved DOM fixtures and do not call the live site. Playwright routes D&D Beyond URLs to those fixtures. If Chromium is missing, run `npx playwright install chromium` once. Headed debugging:

```bash
BFA_PLAYWRIGHT_HEADLESS=false npm run test:e2e
```

Manual checklists for the live site are in [docs/TESTING.md](docs/TESTING.md). A change that touches a D&D Beyond adapter still needs a live check; the fixture suite cannot prove the current site DOM.

### Where to read next

- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/TESTING.md](docs/TESTING.md)
- [AGENTS.md](AGENTS.md)

## Privacy

- Your artwork and journal entries are stored locally in your browser.
- The extension does not upload your art to an external service.
- Removing the extension removes access to the stored local art and journal entries.
- There is currently no cloud sync.

## Storage expectations

- For normal use, local storage should be fine.
- Storage use grows as you save more full-art images.
- If you save artwork for a lot of characters, the extension can start taking up a noticeable amount of browser storage.
- The biggest factor is the size of the original images you save.
- Right now, the extension keeps one active full-art image per character, plus any saved portrait crop for that character.
- Supported uploads are PNG, JPEG, and WebP, up to 3 MB.
- If you expect to store art for a large roster, occasionally remove artwork you no longer need.

## Current status

Available now:

- Fullscreen art viewer
- Local full-art storage
- Portrait edit panel inside D&D Beyond's portrait manager
- Portrait crop workflow
- Full-art download from the viewer and from the popup inventory
- Optional character-card portrait enhancement
- Local character journal tab
- Manual removal of stored full art

Planned next:

- Cleanup of local art when a D&D Beyond character is deleted

## Known limits

- No Chrome Web Store release yet.
- Local art is tied to the browser where you installed the extension.
- Only one active full-art image is stored per character right now.
- There is not yet a built-in storage dashboard or usage meter beyond the popup inventory summary.
- Journal images are a placeholder. Entries are text only.

## Disclaimer

This is an independent fan-made extension. It is not affiliated with or endorsed by D&D Beyond or Wizards of the Coast.
