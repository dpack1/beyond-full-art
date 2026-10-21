# D&D Beyond character sheet reference

**Last verified:** 2026-10-20

**Reference and live-QA character:** Matilda Greywolf, Level 2 Warlock

**Sheet:** https://www.dndbeyond.com/characters/172153137

**Source:** logged-in desktop captures of that sheet, light mode and Underdark Mode. The original captures were 1920×1200, including browser chrome. The PNGs in this folder are those captures with the browser chrome and the site header cropped, then resized and compressed. Page HTML was not saved. Colors and spacing below were measured from the original screenshots. Class names are not readable from the images.

Read this document instead of opening the live site. Use the live site only to run the selector health check and the other live QA steps in [docs/TESTING.md](../TESTING.md). The selector strings the extension actually queries live in [`src/platform/dndbeyond/selectors.ts`](../../src/platform/dndbeyond/selectors.ts). Edit that file when a selector breaks. Update this document when the sheet's structure or look changes.

## Provenance

Each fact is tagged with one of:

- **from-code** — what the extension, its fixtures, and the selector map do today.
- **from-screenshot** — measured or read from the images in this folder.
- **unverified** — not in saved HTML, fixtures, or a screenshot.

`ddbc-tab-list__nav-item`, `ddbc-tab-list__nav-item--is-active`, `ct-primary-box`, and `ct-theme-dark` are strings the selector map asks the live check to find. They are **from-code** until that check passes. `ct-character-sheet--dark-mode` is **unverified**: it is not in the fixtures and no adapter uses it. The live selector-health check in [docs/TESTING.md](../TESTING.md#selector-health) is how those class names get verified.

The red lines on section frames, ability boxes, the active-tab underline, and the side-panel border are D&D Beyond's own borders, drawn in the character's theme color. Matilda's sheet decoration uses red (`#c53131` on these captures, about 2px, square corners). Light mode and Underdark Mode use that same theme color for the frames. Other characters can have other theme colors. Sizes below were measured to the outer edge of those borders on the original 1920×1200 captures. **from-screenshot**

Extension UI should take its accent and border color from the sheet's theme color at runtime, from the computed style of an existing frame or the active tab. Do not hardcode this red.

## Screenshots

| Capture | Light | Dark (Underdark Mode) |
| --- | --- | --- |
| Main sheet, Actions tab | [sheet-light.png](sheet-light.png) | [sheet-dark.png](sheet-dark.png) |
| Notes tab | [notes-tab-light.png](notes-tab-light.png) | [notes-tab-dark.png](notes-tab-dark.png) |
| Extras tab | [extras-tab-light.png](extras-tab-light.png) | [extras-tab-dark.png](extras-tab-dark.png) |
| Action slide-in (Longsword) | [sidebar-item-light.png](sidebar-item-light.png) | [sidebar-item-dark.png](sidebar-item-dark.png) |
| Notes slide-in with a text field (Organizations) | [sidebar-form-light.png](sidebar-form-light.png) | [sidebar-form-dark.png](sidebar-form-dark.png) |

## Layout regions

At this desktop width the sheet is a wide page over an illustrated background. **from-screenshot**

Top to bottom:

1. The D&D Beyond site header (logo, Play D&D, Rules, Library, Community, Marketplace, and the account control) is not in the committed images. It was cropped off with the browser chrome. The header fill in the original capture was `#232b2f`. **from-screenshot**
2. The character identity bar, also dark in both themes (`#2b2b2a` in this capture). It shows the small header portrait, the name Matilda Greywolf, the species and class line, Level 2, Short Rest, Long Rest, the campaign (Salty Eyes), and the manage control. **from-screenshot**
3. The sheet body, in three columns:
   - Left: decorative crest, then six ability scores, saving throws, senses, and proficiencies.
   - Middle: the skills list.
   - Right: the tabbed content box (Actions, Spells, Inventory, Features & Traits, Background, Notes, Extras).

The header portrait and the crest are not the surface the fullscreen viewer enhances. That viewer uses the right-side information sidebar, which is a different panel and is not open in these captures. **from-code**

Approximate sizes from the original 1920×1200 captures, measured to the outer edge of the theme-color borders. **from-screenshot**

| Region | Size |
| --- | --- |
| One ability score box | about 58×60px, with about 38px between boxes |
| Saving throws, senses, and the skills column | about 250px wide |
| Proficiencies block | about 264×350px |
| Right-hand content box | about 600×660px |
| Action or notes slide-in | about 340px wide, from the right edge of the window |

## Tab nav

**At this wide desktop width the tab nav sits at the top of the right-hand content box, not along the bottom of the page.** The row is the top edge of that box. The section body renders under the row. **from-screenshot**

Main row, left to right: Actions, Spells, Inventory, Features & Traits, Background, Notes, Extras. **from-screenshot**

The same labels are the set the journal adapter uses to recognize the row. **from-code**

A second row sits just under the main row and changes with the section. **from-screenshot**

| Section | Secondary tabs |
| --- | --- |
| Actions | All, Attack, Bonus Action, Reaction, Other, Limited Use |
| Notes | All, Orgs, Allies, Enemies, Backstory, Other |
| Extras | All, Familiar (plus a search field, "Search Names, Types, or Tags", and Manage Extras) |

The selector map asks the live check for these tab classes. They are not readable from the screenshots, and no page HTML was saved. The live selector-health check is how they get verified. **from-code**

| Class | Role |
| --- | --- |
| `ddbc-tab-list__nav-item` | One tab item, main row or secondary row |
| `ddbc-tab-list__nav-item--is-active` | The selected tab item |

The journal queries `ddbc-tab-list__nav-item` and the active class when it samples the theme color and copies the active tab's underline. It still finds Extras by its label, inserts a Journal button after that item, and mounts on the next sibling of the tab row. On the live-shaped fixture that sibling is `ddbc-tab-list__content`. While Journal is open, the other children of that region are concealed. The section toolbar copies a live section search input (`input[type="search"]`, or an input whose placeholder or accessible name contains "Search") and, when that input's parent only wraps the field, that parent's classes. Filter and Manage Notes follow the Extras row: search, then filter, then Manage. **from-code**

In light mode the inactive main-tab labels read as gray (about `#75838b`) and the active label is near-black (about `#13191d`). The secondary row sits on a light gray track (about `#eceeef`). **from-screenshot**

## Section and box markup

The selector map asks the live check for `ct-primary-box` on the boxed regions (ability scores, saving throws, skills, the tabbed content box, and the blocks like them). The class is not readable from the screenshots. **from-code**

Inner BEM pieces under that class were not in saved HTML. Do not invent them. Hashed `styles_*` classes are build output and are not stable hooks. **from-code**

## Right side panel

These captures show two different right-hand surfaces. Do not mix them up.

### Action and notes slide-in

Clicking a row such as Longsword, or a notes section such as Organizations, opens a panel over the right edge. **from-screenshot**

- The action panel titles the item (Longsword), offers Customize, and lists stats and tags.
- The notes panel titles the section (Organizations), has a text field ("Enter your notes here!"), and a short prompt under it.
- Light fill is near white (`#fefefe`). Dark fill is `#12181c`.
- No class name for this slide-in was captured. Do not guess one. The journal panel does not copy `ct-sidebar`. Its close control, and Back when a note was opened from another note, sit outside the content box, in the same places as the X and the arrows in these captures. **from-screenshot** for the placement, **from-code** for the journal panel.

### Information sidebar and portrait manager

The fullscreen viewer and the portrait tools hook a different panel. **from-code**

| Hook | What it is |
| --- | --- |
| `[aria-label="Information Sidebar"]` | Current right-side panel that holds the portrait |
| `.ct-sidebar__portal` | Portal root around that panel |
| `[data-testid="character-manage-pane"]` | Legacy manage pane. A 2026-10-10 inspection found sheets that no longer render it |
| `.ct-decoration-manager` | Portrait manager inside the sidebar or the builder modal |
| `.ct-decoration-manager__upload` and the file input under it | Native portrait upload |
| Button text `Change Portrait` | Confirmation that saves full art |

As of 2026-10-10, the first-level sidebar decorations view ("Current Decorations" / "Browse Decorations") did not show the upload manager. Open the portrait upload before expecting `.ct-decoration-manager`. **from-code**

## Theme

The dark captures are the sheet with Underdark Mode on. In the original captures, the site header and the character identity bar stay dark in both themes. The site header is cropped out of the committed images. **from-screenshot**

The menu path recorded with the captures is **Manage**, then **Character Settings**. That menu is not in these screenshots and was not in saved HTML. **unverified**

Class strings the live check looks for while dark mode is on:

| Class | What it marks | Tag |
| --- | --- | --- |
| `ct-theme-dark` | Dark theme is on. The live check looks for the class anywhere in the document. | from-code |
| `ct-character-sheet--dark-mode` | Sheet root while Underdark is on. The live-shaped fixture has it. The journal treats a class ending in `dark-mode` as dark. | from-code |

The live selector-health check is how both get verified. Run it as described in [docs/TESTING.md](../TESTING.md#selector-health).

The portrait edit panel does not read those classes. It walks up from the upload section, reads the computed background color, and adds `bfa-art-sync--light` or `bfa-art-sync--dark`. **from-code**

## Type, color, borders, spacing

The exact `font-family` was not in saved HTML. The UI is a sans-serif: small tracked labels (ability names, tab names), large numerals for scores, and ordinary body text in the slide-in. **from-screenshot**

Panel fills in this capture. **from-screenshot**

| Surface | Light | Dark |
| --- | --- | --- |
| Boxed sections and the content box | `#f8f8f8` to `#fefefe` | small boxes about `#182020`–`#182828`; content box about `#202830` |
| Proficiencies block | same near-white | `#303030` |
| Action / notes slide-in | `#fefefe` | `#12181c` |
| Body text | near `#000000` | `#f8f8f8` |
| Muted labels | gray, in the tab row about `#75838b` | about `#a0a8b0` |
| Heal chip in the hit-point block | about `#68d870` | same green chip on the dark block |

The box edges in these captures are the theme-color borders described above. Gaps between boxes show the illustrated page background, not a flat chrome color. **from-screenshot**

## What the extension hooks

The map in `src/platform/dndbeyond/selectors.ts` is the list to edit. This table is the reading guide. When a health test names an id, change that entry. Then, if the sheet's structure changed, update this doc in the same change.

`code` entries are queried today and must match the saved fixtures. Entries marked `live` are class strings in the selector map that the Playwright check looks for. They stay **from-code** until that check passes. `character-sheet-dark-mode` is **unverified**. The fixture test does not require the live entries. The Playwright check does, when a logged-in sheet is available, and that check is how the class names get verified.

### Fullscreen viewer

| Id | Selector | Source |
| --- | --- | --- |
| `character-manage-pane` | `[data-testid="character-manage-pane"]` | code |
| `character-portrait-image` | `img.ddbc-character-avatar__portrait[alt="Character portrait"]` | code |
| `character-portrait-surface` | `.ddbc-character-avatar__portrait` | code |
| `information-sidebar` | `[aria-label="Information Sidebar"]` | code |
| `sidebar-portal` | `.ct-sidebar__portal` | code |

### Full-art storage, portrait edit panel, portrait crop

| Id | Selector | Source |
| --- | --- | --- |
| `portrait-manager` | `.ct-decoration-manager` | code |
| `portrait-manager-avatar` | `img.ddbc-character-avatar__portrait` | code |
| `portrait-manager-custom-content` | `.ct-decoration-manager__custom-content` | code |
| `portrait-manager-custom-section` | `.ct-decoration-manager__custom` | code |
| `portrait-manager-upload-form` | `.ct-decoration-manager__upload-form` | code |
| `portrait-manager-upload-heading` | `.ct-decoration-manager__upload-heading` | code |
| `portrait-manager-upload-heading-rules` | `.ct-decoration-manager__upload-heading-rules` | code |
| `portrait-manager-upload-file` | `.ct-decoration-manager__upload-file` | code |
| `portrait-manager-upload-input` | `.ct-decoration-manager__upload-file-input[type="file"]` | code |
| `portrait-manager-upload` | `.ct-decoration-manager__upload` | code |
| `change-portrait-button` | `button` whose text is `Change Portrait` | code |

### Character card portraits

| Id | Selector | Source |
| --- | --- | --- |
| `campaign-character-card` | `.ddb-campaigns-character-card-header-upper` | code |
| `campaign-character-card-link` | `a.ddb-campaigns-character-card-header-upper-details-link[href^="/characters/"]` | code |
| `campaign-character-card-portrait` | `.ddb-campaigns-character-card-header-upper-portrait .image.user-selected-avatar` | code |
| `character-list-card-link` | `a[href*="/characters/"]` | code |
| `character-list-card-portrait` | `.image.user-selected-avatar, [style*="/avatars/"]` | code |

### Character journal

| Id | Selector | Source |
| --- | --- | --- |
| `sheet-tab-extras-control` | interactive control (`a`, `button`, `label`, tab, radio) whose text is `extras` | code |
| `sheet-tab-labels` | the same kind of element, one per sheet tab label | code |
| `sheet-tab-list` | `[role="tablist"]`, `[role="list"]`, `ul`, `ol`, `nav`, or `menu` | code |
| `character-sheet` | `.ct-character-sheet`, `.ct-character-sheet-shell` | code |
| `sheet-tab-nav-item` | `.ddbc-tab-list__nav-item` | code |
| `sheet-tab-nav-item-active` | `.ddbc-tab-list__nav-item--is-active` | code |
| `sheet-tab-content` | `.ddbc-tab-list__content` | code, fixture only |
| section search | `input[type="search"]`, or an input whose placeholder or accessible name contains `Search` | code. The journal copies the live element's classes. It does not hardcode a search class. |

### Sheet structure and theme (live check)

| Id | Selector | Source |
| --- | --- | --- |
| `primary-box` | `.ct-primary-box` | live |
| `theme-dark` | `.ct-theme-dark` | live, dark theme only |
| `character-sheet-dark-mode` | `.ct-character-sheet--dark-mode` | code, dark theme only |

## How to refresh this doc

1. Log in and open Matilda Greywolf, or replace her if she is no longer the reference character. Record the new URL and the date at the top.
2. Capture light mode and Underdark Mode (Manage, then Character Settings). At a wide desktop width, capture the main sheet, the Notes tab, the Extras tab, an action slide-in, and a notes slide-in with a text field.
3. Replace the PNGs in this folder. Keep the names in the table above.
4. Update any fact that changed. Keep the provenance tag. Delete facts you can no longer see.
5. If a class renamed, change that one entry in `src/platform/dndbeyond/selectors.ts`, then update the hook table here.
6. Run `npm test`, then the live selector-health check in [docs/TESTING.md](../TESTING.md#selector-health). That check is how the class names in this doc get verified.

A failing check names the selector id, the selector string, the features it breaks, what it targeted, and what to look for. The usual fix is one line in the selector map.
