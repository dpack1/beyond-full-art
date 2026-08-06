# Beyond Full Art

<p align="center">
  <img src="assets/readme/banner.png" alt="Beyond Full Art banner" width="900" />
</p>

Beyond Full Art is a Chrome extension for D&D Beyond that makes character portraits and artwork feel a little better to use.

It keeps D&D Beyond's existing portrait flow, but adds two quality-of-life improvements: an easier way to crop portrait art and a better way to view full character artwork.

## The Problems It Solves

### 1. Cropping full-size character art can be awkward

If you start with a full illustration, getting the portrait framing right is awkward. You usually have to crop the image somewhere else first, upload it, then repeat the process until it looks right.

Beyond Full Art adds an in-browser portrait crop flow so you can frame the portrait you want while keeping the original full image.

### 2. Character art is often too small to fully appreciate

Portraits on the sheet are tiny. That means it is hard to appreciate your own character art, and it is even harder to get a nice look at another player's character in a campaign.

Beyond Full Art adds a fullscreen viewer so character art can actually be seen at a useful size.

## What It Adds

- A fullscreen art viewer launched from the existing D&D Beyond portrait flow
- A local full-art save for each character
- A portrait crop tool for turning full artwork into a clean square portrait
- A workflow that stays inside D&D Beyond instead of replacing its UI
- Local-only artwork storage in your browser

## Why Use It

Beyond Full Art is for players who want a smoother character-art experience without turning D&D Beyond into a different app.

- Crop portraits from full-size art without leaving D&D Beyond
- View your own character art and your party's character art at a useful size
- Keep the portrait and the full artwork tied together
- Avoid juggling separate offline crop steps every time you want to tweak the framing

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

## How To Install

There is no Chrome Web Store release yet.

### 1. Build the extension

```bash
nvm use
npm install
npm run build
```

If your local `node` path is not already active, use:

```bash
PATH="$HOME/.nvm/versions/node/$(cat .nvmrc)/bin:$PATH" npm run build
```

### 2. Load it in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the repository's `dist/` folder

## How To Use

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
2. Choose `Crop portrait` or `Edit portrait crop`.
3. Drag and zoom until the portrait framing looks right.
4. Apply the crop.
5. Finish the D&D Beyond portrait flow if it asks you to confirm the change.

## Privacy

- Your artwork is stored locally in your browser
- The extension does not upload your art to an external service
- Removing the extension removes access to the stored local art
- There is currently no cloud sync

## Storage Expectations

- For normal use, local storage should be fine
- Storage use grows as you save more full-art images
- If you save artwork for a lot of characters, the extension can start taking up a noticeable amount of browser storage
- The biggest factor is the size of the original images you save
- Right now, the extension keeps one active full-art image per character, plus any saved portrait crop for that character
- If you expect to store art for a large roster, it is a good idea to occasionally remove artwork you no longer need

## Current Status

Available now:

- Fullscreen art viewer
- Local full-art storage
- Portrait crop workflow
- Manual removal of stored full art

Planned next:

- Better cleanup when a D&D Beyond character is deleted

## Known Limits

- No Chrome Web Store release yet
- Local art is tied to the browser where you installed the extension
- Only one active full-art image is stored per character right now
- There is not yet a built-in storage dashboard or usage meter

## For Developers

If you want the product and architecture details, start here:

- [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/TESTING.md](docs/TESTING.md)

Repository-specific contributor guidance lives in [AGENTS.md](AGENTS.md).

## Disclaimer

This is an independent fan-made extension. It is not affiliated with or endorsed by D&D Beyond or Wizards of the Coast.
