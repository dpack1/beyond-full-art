# Character Journal v2 design

This is the screen spec for the player wiki in
`.agent/plans/character-journal-v2.md`. A builder should be able to implement
the Journal tab, the list, and the slide-in panel from this file without
inventing layout, copy, or color.

Static mockups live in `.agent/design/journal-v2/`. Open `index.html`. The
PNG next to it is the reviewed rendering of each frame. Regenerate the HTML
with `node compose.mjs` from that folder. The frames set the sheet theme
themselves. They do not follow the operating system.

## Sheet look, 2026-10-20

Dylan reviewed the mockups and rejected them as a visual source. They do
not look like D&D Beyond. This file's behavior, states, flows, copy, and
decisions still stand. The color table and the PNG frames are not the
look to copy.

The journal has to look like the character sheet it is sitting in:

- Reuse the sheet's own DOM structure and class names so the page
  stylesheet paints it, and so light and dark follow the sheet. The tab
  copies the live tab control (`ddbc-tab-list__nav-item` on the classic
  sheet, or the button class on the current sheet). The list sits in the
  sheet content region, using the primary-box section pattern
  (`ct-primary-box`, `section` panes such as `ct-actions`). The panel
  reuses the sheet sidebar (`ct-sidebar`, `ct-sidebar__portal`,
  `ct-sidebar__inner`, `ct-sidebar__heading`) and is still our dialog on
  `document.body`, so a sheet `overflow: hidden` cannot clip it.
- Hashed module classes (`styles_tabButton__…`, `styles_sidebar__…`) are
  copied from the live elements at runtime. They are not hardcoded,
  because a deploy changes the hash. Classes whose name contains
  `hidden` are not copied.
- Where the extension still has to write CSS, colors, fonts, borders,
  and spacing are sampled from computed styles of a nearby tab, section,
  button, input, or the sidebar. The token table in this file is the
  fallback used only when a sample is missing or fails the contrast
  check. Do not read `prefers-color-scheme`.
- Theme detection is unchanged: `ct-theme-dark`, a class ending in
  `dark-mode`, `data-theme` / `data-appearance`, then the sheet
  background luminance. Apply it to the section and the panel, and
  re-apply when the sheet switches.

A public sheet, `https://www.dndbeyond.com/characters/4741434` ("Book"),
was loaded in Chrome on 2026-10-20. It is the current light sheet, not
Dylan's dark classic sheet. Observed there:

- Five tabs, `menu` > `li` > `button.styles_tabButton__wvSLf`: Actions,
  Spells, Inventory, Features & Traits, Extras. No Background or Notes
  tab. Active tab text `rgb(18, 24, 28)`, inactive `rgb(117, 131, 139)`,
  Roboto Condensed 14px/700 uppercase, active underline
  `3px solid rgb(197, 49, 49)`.
- Primary box `ct-primary-box` plus a hashed class. The open pane is
  `section.ct-actions` inside `.ct-primary-box__tab--actions`.
- Sidebar `ct-sidebar` plus hashed right-edge classes, hidden until
  opened. Inner hook `ct-sidebar__inner`.
- Sheet font `Roboto, Helvetica, sans-serif` at 13px. Inputs use a
  hashed class, near-white fill, 1px red border, 4px radius.
- No appearance toggle was visible, so this capture is light only.

Dylan's sheet on 2026-10-20 is Matilda Greywolf,
`https://www.dndbeyond.com/characters/172153137`. Those captures replace
the earlier Voxx Gwinryl frames as the visual source for the tab, the
section box, and the slide-in. They show the sheet, the Notes tab, the
Extras tab, the right pane on an action (Longsword), and the Notes pane
with a field (Organizations), each in light and Underdark. The files
were not retained on disk in this workspace, so they are not committed.
The public light capture remains at
`.agent/design/journal-v2/reference/live-sheet-light.png`.

The red rectangles on those frames outline regions. They are not the
sheet's border. The sheet's own accent is the active-tab underline and
small red links such as Manage Custom.

What to match:

- Journal is another tab in the same strip as Notes and Extras:
  uppercase, condensed, 3px red underline on the active tab, muted gray
  when inactive.
- The list sits in the same content box as Notes and Extras. The heading
  is the small uppercase label used by Organizations and Familiar. The
  search field matches Extras ("Search Names, Types, or Tags"): a full
  row, hairline border, 4px radius. Category chips match the Notes and
  Extras filters: a filled pill, dark on light and light on Underdark.
- The note panel is the right-hand pane used for Longsword and
  Organizations. Title on the left of the header, Close on the right,
  hairline under the header and along the left edge. It does not dim
  the sheet. Width follows a live `.ct-sidebar` when one is open, and
  otherwise the column width in these frames (about 340px). Full width
  at 760px and below. Body type is the sheet's text. Fields take the
  sampled input border and radius, the same shape as "Enter any notes
  here!". Hashed sidebar classes are copied at runtime and `hidden` is
  still dropped.

Build screenshots sit beside the public light reference and the
fixture's dark sheet under `.agent/design/journal-v2/build/`.

## What the screens match

The Sheet look section above is the visual authority. The color table and
the sentences below that name a mockup palette, a dimmed scrim, or a ban on
sidebar markup are the earlier design pass. Behavior, states, flows, and
copy in the rest of this file still stand.

The journal is drawn as part of the D&D Beyond character sheet, the surface
with `ct-` and `ddbc-` classes, not the marketing site. The sheet still uses
Roboto, uppercase tracked tabs, a 3px active underline, rectangular controls
with a 2px corner, and a right-edge slide-in. Those are the pieces this
design copies.

Observed on the owner's sheet and in this repo on 2026-10-20:

- Tabs are `div.ddbc-tab-list__nav-item`. The active item is
  `ddbc-tab-list__nav-item--is-active`, red label `#c5312d`, underline
  `inset 0 -3px 0 #c5312d`.
- Dark appearance is `ct-character-sheet--dark-mode` with `data-theme="dark"`.
  The dark sheet background measured for the pressed-chip bug is `#1b242b`.
  `#c5312d` on that background is 2.89:1.
- Body text on the light sheet is `#242527`.
- Light surfaces that the sheet actually paints, taken from the colors a
  sheet userscript has to replace: white `#ffffff`, tag and pill fill
  `#f2f2f2`, zebra `#faf8f7`, hairline `#e0e3e3`, secondary text `#838383`.

`#838383` on white is 3.79:1, and `#e0e3e3` on white is 1.28:1. Text and
input borders in this design are darkened just enough to clear WCAG AA. The
sheet's red, its background, its type, and its tab structure stay.

The panel is our dialog on `document.body`. It is not mounted inside
D&D Beyond's sidebar and it does not copy hashed classes. It sits on the
same edge, at a similar width, with the same header arrangement: title,
close X on the right, actions under the title.

## Theme

Do not read `prefers-color-scheme`. The journal follows the character
sheet's Appearance setting, including a change made while Journal is open.

Detection order, first match wins:

1. An ancestor class that is `ct-theme-dark`, or that ends in `dark-mode`
   (`ct-character-sheet--dark-mode` is the class recorded on 2026-10-20).
   `ct-theme-dark` is included because the sheet has used that name for the
   same setting.
2. `data-theme` or `data-appearance` of `dark` or `light` on an ancestor.
3. The computed background of the sheet. A luminance under 0.4 is dark.

Apply the result to the journal section and to the panel. Re-apply when
`class`, `style`, `data-theme`, or `data-appearance` changes on the sheet,
on `documentElement`, or on `body`. The existing `readSheetTheme` and
`observeSheetTheme` are the mechanism. Extend the class test so
`ct-theme-dark` counts as dark.

Sampled sheet colors are used when they already pass the contrast numbers
below. The tokens in this file are the values when the sheet is the known
light or dark appearance, and they are the fallback when a sample fails
contrast. The selected-chip red is never the raw `#c5312d` on the dark
sheet.

## Color tokens

Contrast is against the sheet background unless a second surface is named.
Text under 18px needs 4.5:1. The selected underline and input border need
3:1.

| Token | Light | On light | Dark | On `#1b242b` | Use |
| --- | --- | --- | --- | --- | --- |
| background | `#ffffff` | | `#1b242b` | | Sheet, section, panel |
| text | `#242527` | 15.34:1 | `#f2f4f6` | 14.28:1 | Titles, body, inactive tabs |
| muted | `#5c6166` | 6.26:1 | `#a8b4be` | 7.45:1 | Previews, unselected chips, hints. Replaces `#838383` (3.79:1) |
| surface | `#ffffff` | | `#24303a` | | Inputs, menus, panel fields |
| sunken | `#f2f2f2` | | `#24303a` | | Tags, confirm fill, hover |
| tag text | `#5c6166` on `#f2f2f2` is 5.59:1 | | `#a8b4be` on `#2a3842` is 5.70:1 | | Category tag |
| line | `#e0e3e3` | decorative | `#314049` | decorative | Row and header dividers. Not the only edge of a control |
| border | `#6f757a` | 4.67:1 | `#8b9aa6` | 5.45:1 | Inputs, buttons, menus, close |
| selected | `#c5312d` | 5.45:1 | `#ff8a84` | 6.91:1 | Active tab label, selected chip label, 3px underline |
| accent fill | `#c5312d` | white label 5.45:1 | `#c5312d` | white label 5.45:1 | Primary button fill. Dark edge is `#ff8a84` so the button clears 3:1 against the sheet |
| danger | `#9d2b28` | 7.47:1 | `#ffb4ae` | 9.29:1 | Delete, errors |
| success | `#146c3a` | 6.49:1 | `#8fd0a8` | 8.81:1 | Saved |
| link | `#0c5f8c` | 6.93:1 | `#7ec8f0` | 8.55:1 | Resolved wikilinks. The sheet's bright blue `#1b9af0` is 3.03:1 on white and is not used |
| focus | `#0b5cab` | 6.70:1 | `#9ec9ff` | 9.19:1 | 2px outline, 2px offset |
| needs | `#6e5414` on `#faf6ea` is 6.61:1 | | `#f0d48a` on `#3a3424` is 8.54:1 | | Needs details. Not the error red |
| scrim | `rgba(9, 13, 18, 0.48)` | | `rgba(0, 0, 0, 0.55)` | | Over the sheet while the panel is open |
| hover | `#f2f2f2` | | `#2c3a44` | | Row, menu, mention |

CSS variables, set on the section and the panel from the theme helper:

```css
--bfa-journal-background
--bfa-journal-text
--bfa-journal-muted
--bfa-journal-surface
--bfa-journal-sunken
--bfa-journal-line
--bfa-journal-border
--bfa-journal-selected
--bfa-journal-accent
--bfa-journal-accent-edge
--bfa-journal-danger
--bfa-journal-success
--bfa-journal-link
--bfa-journal-focus
--bfa-journal-needs
--bfa-journal-needs-bg
```

`data-bfa-theme="light"` or `"dark"` is set on both roots so a token can
be overridden per mode. `color-scheme: dark` is set on the dark roots so
native checkboxes and scrollbars follow the sheet.

## Typography

Font stack, inherited from the sheet where it already uses Roboto, and set
explicitly on the panel because the panel is on `document.body`:

```css
font-family: Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
```

| Role | Size | Weight | Case | Tracking |
| --- | --- | --- | --- | --- |
| Character name (sheet, not ours) | 28px, 22px at 375px | 700 | as the sheet shows it | 0 |
| Sheet tab | 12px | 700 | uppercase | 0.04em |
| Panel title | 22px, 20px at 375px | 700 | player's text | 0 |
| Row title | 15px | 700 | player's text | 0 |
| Body, textarea, read prose | 15px / 1.55 | 400 | player's text | 0 |
| Read heading (`h2` from `##`) | 16px | 700 | player's text | 0 |
| Field text | 14px | 400 | as typed | 0 |
| Preview, mention line, banner | 13px / 1.4 | 400 | as written | 0 |
| Button | 12px | 700 | uppercase | 0.04em |
| Chip | 11px | 700 | uppercase | 0.04em |
| Toolbar button | 11px | 700 | uppercase | 0.04em |
| Tag | 10px / 16px line | 700 | uppercase | 0.06em |
| Section label ("Mentioned in") | 12px | 700 | uppercase | 0.06em |

Player text is never uppercased. Chrome (tabs, chips, buttons, tags,
section labels) is uppercased, which is how the sheet labels its own
navigation and tags.

## Spacing, shape, and targets

- Corner radius on controls, tags, and thumbnails is 2px. The sheet's
  buttons are squared off. Do not use the marketing site's 8px radius.
- Section padding: 16px 18px 28px. At 760px and below: 12px 12px 20px.
- Stack gap between quick note, search, chips, and the list: 12px.
- Row padding: 10px 2px. Gap between text and thumbnail: 12px.
- Panel padding: header 12px 16px, body 16px.
- Control gap: 8px. Toolbar gap: 6px.
- Desktop targets are at least 36px tall.
- At 760px and below, targets grow to 44px: fields, buttons, chips, rows,
  mentions, menu rows, listbox rows, and the close control. The close
  control is 44×44.

## Breakpoints

- Above 760px the panel is `min(28rem, 100vw)` (448px at the root font
  size), fixed to the right edge of the viewport.
- At 760px and below the panel is the full viewport. The quick-note button
  and the New note button each move onto their own row, full width of the
  section. Chips stay one horizontal row.

The sheet column is whatever width the content region already has. The
list is a single column in that width. It does not become a split editor.

## Sheet chrome

The mock shows the character header and the tab strip so the journal can
be judged in place. The extension does not restyle that header.

### JournalTab (M2)

The tab is inserted after Extras. Visible label is `JOURNAL` via
`text-transform`. The accessible name is `Journal`.

The hit target is the whole tab item, including its padding. Keyboard
activation still works when a click arrives without a pointerdown.

Active state copies the sheet's own active class
(`ddbc-tab-list__nav-item--is-active`, or whichever class is actually
present on a selected tab). Do not paint a second red if that class is
present.

If the computed active color is under 4.5:1 against the tab bar, which is
the case for `#c5312d` on `#1b242b`, keep the 3px bar and set the label to
the selected token (`#ff8a84` on the known dark sheet). Inactive tabs use
the sheet text color. Hover uses `#121212` in light and `#ffffff` in dark,
matching the sheet.

```css
min-height: 44px;
padding: 0 12px;
font-size: 12px;
font-weight: 700;
letter-spacing: 0.04em;
text-transform: uppercase;
box-shadow: inset 0 -3px 0 transparent;
```

Active:

```css
color: var(--bfa-journal-selected);
box-shadow: inset 0 -3px 0 var(--bfa-journal-selected);
```

At 375px the tab strip scrolls horizontally. Journal is the last tab, so
the visible end of the strip is Notes, Extras, Journal. Do not wrap the
tabs onto a second line.

## Section order

`JournalSection` (M2 host, M3 content) is the only child shown in the
sheet content region while Journal is selected. From top to bottom:

1. `QuickNoteBar` (M4)
2. File-note status, only when the last file failed (M4)
3. `JournalSearch` and `NewNoteMenu` (M3, M4)
4. `CategoryChips` (M3)
5. `MigrationNotice` or the migration error (M3)
6. `JournalList` (M3)

The section scrolls inside the sheet pane. Quick note, search, and chips
scroll with it. They are not a frozen toolbar.

## QuickNoteBar (M4)

One row above 760px: a text field, then a primary button.

| | |
| --- | --- |
| Field accessible name | Note for today's session |
| Placeholder | Note for today's session |
| Button | File note |
| Height | 36px, 44px at 760px and below |
| Field | surface fill, 1px `border` token, 2px radius, 14px text, 0 10px padding |

At 760px and below the button is on the next row, full width. There is no
global shortcut.

Enter files the line. The button does the same. The field starts empty.
After a successful file it is cleared. After a failed file the text stays
and this line appears under the bar, `role="alert"`, danger color:

> That note could not be filed. It is still in the field.

The filed line is a markdown bullet on today's session: `- 20:17 Bought a
map from [[Voss]]`. The time is the player's local 24-hour hour and minute.
The session title, when the bar creates the entry, is `Session · ` plus the
locale long date, for example `Session · October 20, 2026`. A later quick
note the same day appends to the most recently updated session that already
has today's `sessionDate`.

`[[` in the field opens `LinkAutocomplete`, anchored under the field, inset
on the right so it does not cover File note.

## JournalSearch and NewNoteMenu (M3, M4)

One row: the search field grows, New note sits at the end. At 760px and
below, New note is a full-width row under the field.

| | |
| --- | --- |
| Accessible name | Search notes |
| Placeholder | Search notes |
| Button | New note, `aria-haspopup="menu"` |

Search matches title, body, `#tags`, and image file names. Chip counts do
not change while a search is active. They are the character's totals. The
rows on screen are the selected chip and the search, both applied.

Empty search result, one line, 15px, weight 700:

> No matches

`NewNoteMenu` opens under the button, aligned to the right edge. At 375px
it spans the section width. Surface fill, 1px border, 2px radius, shadow
`0 8px 24px rgba(9, 13, 18, 0.18)`. A label `NEW NOTE` in muted 11px, then
one row per type, in this order: Session, NPC, Place, Item, Quest,
Backstory. Each row is 36px, 44px on phone, 14px text, sentence case. Hover
uses the hover token. Choosing a type closes the menu and opens the panel
in edit mode with that type's starter headings and an empty title. Focus
moves to the panel title field... the title is the panel heading, edited
in the same title shown in the header. See EditView.

Escape closes the menu and leaves focus on New note.

## CategoryChips (M3)

`role="radiogroup"`, name `Categories`. Each chip is `role="radio"`.

Order is fixed: All, Sessions, NPCs, Places, Items, Quests, Backstory.
The count is part of the visible label, separated by a space: `NPCS 1`.
All includes `unset` entries. A chip with a zero count still shows the
zero, except during the loading and migration-error states, which hide
every count.

One row. Overflow scrolls on the x axis. Chips do not wrap. At 375px the
row fades the last 28px so the cut chip reads as something to scroll, not
as a broken label.

```css
min-height: 36px; /* 44px at 760px and below */
padding: 0 10px;
font-size: 11px;
font-weight: 700;
letter-spacing: 0.04em;
text-transform: uppercase;
color: var(--bfa-journal-muted);
box-shadow: inset 0 -3px 0 transparent;
```

Selected:

```css
color: var(--bfa-journal-selected);
box-shadow: inset 0 -3px 0 var(--bfa-journal-selected);
```

Arrow keys move the selected chip and filter the list. The selected chip
is the contrast fix: light `#c5312d` (5.45:1 on white), dark `#ff8a84`
(6.91:1 on `#1b242b`). The v1 red `#c5312d` on `#1b242b` is 2.89:1 and
must not return.

Sort, with no control on screen:

- All and every chip except Sessions: `updatedAt` descending.
- Sessions: `sessionDate` descending, then `updatedAt` descending. A
  session with no `sessionDate` sorts after the dated ones.

Empty category, the word from the chip, lowercased in the sentence:

> No sessions
> No NPCs
> No places
> No items
> No quests
> No backstory

All, when the character has no entries:

> No notes

Those lines are 15px, weight 700, text color. They are labels. They are
not instructions.

## MigrationNotice and load states (M3)

When the open character has any `type: "unset"` entry that migration
created (`needsDetails` is false), one line sits above the rows:

> Earlier notes are uncategorized.

Text color, 13px. It is a status, not a lesson. It stays until those
entries have a type. It is hidden when a chip other than All is selected,
because unset entries are not in that list.

Migration failure replaces the rows. It does not show `No notes` and it
does not show zero counts. One alert, danger color, 1px border, 10px 12px
padding:

> Your existing notes were left unchanged.

Loading replaces the rows with one muted line. Counts are hidden.

> Loading notes

## JournalRow (M3, M5, M6)

Each row is a button. Accessible name is the type, the title, and
`needs details` when the badge is present. Example: `Unsorted, Old Gate,
needs details`.

```text
[ tag ] [ Needs details ] Title                          [ 48px thumb ]
preview, one line, muted
Mentioned in 3
```

- The type tag and the title share the first line, baseline aligned, 8px
  gap. The title is 15px/700, single line, ellipsis.
- Preview is plain text, 13px, muted, one line, ellipsis. At 760px and
  below it may wrap to two lines (`-webkit-line-clamp: 2`).
- Mention count is `Mentioned in 3`, 13px, muted. Hide the line when the
  count is 0. The number is other entries whose resolved links point here.
- Thumbnail is 48×48, 2px radius, 1px line border, `object-fit: cover`,
  on the right, vertically centered. The column is always 48px. When the
  entry has no image the column is empty, with no border and no icon, so
  titles still line up and a text note does not look like a broken picture.
  The thumbnail is the first image until a chooser exists.
- Unsorted is the visible word for `type: "unset"`.
- Needs details is a second tag, gold tokens, not danger red.
- Hover fills the row with the hover token.
- Row min-height is 36px, 44px at 760px and below.
- A 1px line token divides rows.

Tags: 10px/700, uppercase, tracking 0.06em, padding 1px 6px, 2px radius,
sunken fill, muted text. Needs details uses the needs fill and needs text.

## JournalPanel (M3)

`position: fixed` on `document.body`, `role="dialog"`, `aria-modal="true"`,
labelled by the entry title. `data-bfa-journal-panel`. Width
`min(28rem, 100%)`. Full viewport at 760px and below. Right edge. A scrim
covers the rest of the viewport. The list stays mounted underneath and is
`inert` while the dialog is open. Do not set `inert` on the D&D Beyond
document.

Z-index is above the sheet and below the photo viewer (`2147483646`) and
the fullscreen viewer. Use `2147483000` for the scrim and the panel unless
a live check finds a sheet layer above that. Stay under the viewers.

The panel slides in from the right over 160ms. Under
`prefers-reduced-motion: reduce` it appears and disappears with no slide.

Close is an X, top right, 36×36 (44×44 on phone), 1px border, accessible
name `Close`. Escape closes the panel and returns focus to the row, the
New note button, or the quick-note field that opened it.

Header grid, so Close is first in the tab order and still sits on the
right, which is where the sheet puts the sidebar close control:

```text
[ Back ]  Title                         [X]
[ Edit ]              [ tag ] [ status ]
```

Back is omitted until the player has followed a link. The title is 22px
/700, one line, ellipsis. Edit is a secondary button, label `Edit`. In
edit mode the same button reads `Done editing` and returns to read mode
after any in-flight save settles.

Status sits on the header's second row, always in view, including on a
short phone panel:

| State | Copy | Color |
| --- | --- | --- |
| Saving | Saving… | muted, weight 500 |
| Saved | Saved | success, weight 700 |
| Failed or blocked | Not saved | danger, weight 700 |

The specific error is a banner in the body, not only the header word.

## ReadView (M3, M5)

The body is the rendered markdown. Headings from `##` are 16px/700, not
uppercase. Paragraphs and lists are 15px/1.55. Resolved `[[Name]]` is a
button that looks like a link: link token, 1px solid underline, accessible
name the title. Unresolved `[[Name]]` is a button in the needs color with
a dotted underline. Accessible name is `{Name}, needs details`. Following
either replaces the panel contents. Panels do not stack. Back appears.

A checkbox in the read view is a real 16px checkbox we create. Toggling it
patches that task line and autosaves. The accent token tints it.

Images in the prose are content width, max 100%, 1px line border, 2px
radius. The same pictures are repeated as the image strip, because the
strip is the launcher for the existing photo viewer and it lists every
image on the entry even if a markdown line was removed. Strip tiles are
72×72, file name under them in 11px muted. In read mode a tile opens the
viewer. Remove is not shown in read mode.

`Backlinks` (M5): an uppercase label `Mentioned in`, then one full-width
button per referring entry (tag + title, min-height 36px, 44px on phone).
If nothing refers to this entry, omit the heading and the list.

A placeholder with an empty body shows the header, the Unsorted tag, the
Needs details tag, and Mentioned in. It does not show an empty-state
lecture.

## EditView and FormatToolbar (M4)

Done editing replaces Edit. The toolbar is under the header banners and
above the textarea. Buttons, words, not a contenteditable surface:

Bold, Italic, Heading, List, Checkbox, Link, Image.

Each is a secondary button, 11px, min-height 36px (44px on phone), and
wraps to a second line rather than shrinking. Accessible name is the
visible word. Each inserts markdown around the selection and returns focus
to the textarea.

| Button | Inserts |
| --- | --- |
| Bold | `**selection**` |
| Italic | `*selection*` |
| Heading | `## ` at the start of the line |
| List | `- ` at the start of the line |
| Checkbox | `- [ ] ` at the start of the line |
| Link | `[[selection]]`, or `[[ ]]` with the caret between the brackets when nothing is selected |
| Image | clicks the file input |

The file input has `tabindex="-1"`, accepts `image/png,image/jpeg,image/webp`,
and is not in the tab order.

The textarea is the source of truth. 15px/1.55, surface fill, 1px border,
2px radius, padding 10px 12px, min-height 220px, vertical resize. Font is
Roboto, the same as the sheet, not a monospace face.

The title is edited in the panel heading. Clicking the heading, or
focusing it after New note, replaces it with a borderless field of the
same 22px/700 size. Empty on blur stores `Untitled entry`.

Starter headings are the initial body only, for a type chosen from New
note, or for a placeholder whose body is still empty when the player
picks a type. They are ordinary markdown. Deleting them is how the player
skips them.

- NPC: Who they are to me, Where, What they want, We owe / they owe, My suspicions.
- Session: What happened, Who we met, Promises, Loot, Open questions, Best moment.
- Quest: Goal, Given by, Reward, Next step.
- Item: Where we found it, Who carries it, What we know.
- Place: Why it matters, Who is there.
- Backstory: What I remember.

Each heading is a `## ` line followed by a blank line. A `[[Name]]`
placeholder starts with an empty body and type unset. The quick-note bar
does not ask for a type.

`Delete note` is a danger button pinned to the bottom of the panel, with
a 1px line above it, so a long note does not hide it. It opens
DeleteConfirm. It does not delete immediately.

Autosave runs after a short pause, on close, and when the page hides.
There is no Save button. Closing while a save is in flight waits for that
save, or shows the error, and does not drop the text.

## Confirms (M4)

Discard, delete, and replace-draft share one pattern. An
`role="alertdialog"` inside the panel, under the header, scrolled into
view. Focus moves to the dialog. Tab stays inside it until it closes.
The first button is the safe one and is where focus lands. Escape closes
the confirm and keeps the draft or the note.

| Case | Question | Safe | Danger |
| --- | --- | --- | --- |
| Leave with an unsaved note | This note is not saved yet. | Keep editing | Discard |
| Delete | Delete this note? | Keep note | Delete note |
| Stale reload | Replace this draft with the saved note? | Keep draft | Replace draft |

The confirm fill is the sunken token, 1px border, padding 12px. The
question is 14px/1.4. Buttons are the secondary and danger buttons.

## StaleCopyWarning (M4)

When the stored `updatedAt` is newer than the copy the panel loaded, the
header reads `Not saved` and the body opens with an alert:

> This note was updated in another window. Your draft is still here.

A secondary button `Reload saved note` opens the replace confirm. The
textarea is not cleared. Replace, after the confirm, loads the stored
note. Keep draft leaves the text on screen and does not write.

## CharacterMismatchBanner (M2, M4)

When the URL character id and the id the note was opened with differ, the
header reads `Not saved`, autosave is off, and an alert replaces the
editing actions:

> This note belongs to another character. It will not be saved on this sheet.

`Discard` closes the panel without writing. The in-flight save that
started earlier still finishes for the original id and must not paint
into the new character's list.

## LinkAutocomplete (M5)

Opens on `[[` in the quick-note field and in the textarea. `role="listbox"`.
Rows are entries whose titles contain the typed name, recently updated
first, then a final row `Create “{typed name}”` in the link color, weight
700. Each entry row shows the type in muted uppercase and the title.
Arrow keys move, Enter chooses, Escape dismisses the list and leaves the
typed text. Choosing an entry writes `[[Name]]` and nothing else. Create
writes `[[Name]]`, files or keeps the surrounding edit, and creates an
unset placeholder with Needs details without opening the panel. The quick
note still files.

The list is at least as wide as the field, surface fill, 1px border, the
same shadow as the type menu. On phone, rows are 44px.

## DuplicatePicker (M5)

When a wikilink matches more than one title, read mode shows the picker
under that link instead of navigating. The editor does not guess.

> Two notes are named Marcus

Then one button per match: type tag, title, and the short locale date on
the right (`Oct 12, 2026`). The date is how a player tells two identical
names apart. The plan's picker was type and title only. The date is the
extra, and it is muted 12px. Choosing a row navigates the panel.

## Images (M3, M4)

Adding an image writes the blob first, then the markdown
`![file name](bfa-journal-image:{id})`, and deletes the new blob if the
note save fails. The strip updates when the blob is stored.

Reject a file over 3 MB, or a type other than PNG, JPEG, or WebP, with an
alert under the toolbar. The textarea is unchanged.

> That image is over 3 MB. The note was not changed.
> Use a PNG, JPEG, or WebP image.

Remove, in edit mode only, is an 11px uppercase danger button under the
tile: `Remove`. It removes that image's markdown line and, after the note
save succeeds, the blob.

The row thumbnail and the inline image use the same bytes. The photo
viewer already traps focus and stays above the panel.

## Errors

Every failure leaves the player's text on screen.

| Failure | Where | Copy |
| --- | --- | --- |
| Quick note | under the bar | That note could not be filed. It is still in the field. |
| Save, generic | banner under the header, plus header `Not saved` | This note could not be saved. Your text is still here. |
| Quota | same | Storage is full. This note is still on screen. |
| Image too big | under the toolbar | That image is over 3 MB. The note was not changed. |
| Image type | under the toolbar | Use a PNG, JPEG, or WebP image. |
| Migration | in place of the rows | Your existing notes were left unchanged. |

Banners are `role="alert"`, danger color, 13px/1.4. On a phone-height
panel they sit under the header, which does not scroll away.

## Keyboard and focus

Section order:

1. Quick-note field
2. File note
3. Search notes
4. New note
5. Type menu rows, while the menu is open
6. Category chips
7. Rows

Chip arrows move the selection. The menu and the autocomplete listbox
take arrow keys while open.

Panel order:

1. Close
2. Back, when a link has been followed
3. Edit, or Done editing
4. Confirm, when one is open. Focus is trapped there. Escape keeps the draft or the note.
5. Banner actions (Reload saved note, Discard on the character banner)
6. Toolbar, edit mode only
7. Title field, when the heading is being edited
8. Textarea, or the read view's checkboxes and wikilinks in document order
9. Image tiles, and Remove in edit mode
10. Mentioned in buttons
11. Delete note

The file input is not in this order.

Focus ring: 2px solid focus token, 2px offset, on `:focus-visible`. The
opening element receives focus back when the panel closes. A confirm
receives focus when it opens.

## Reduced motion

The 160ms panel slide is the only motion. `prefers-reduced-motion: reduce`
removes it. Loading is the text `Loading notes`, not a spinner.

## Component index

| Component | Milestone | Class hook |
| --- | --- | --- |
| JournalTab | M2 | `bfa-character-journal-tab` |
| JournalSection | M2, M3 | `bfa-character-journal-section` |
| QuickNoteBar | M4 | `bfa-journal-quick-note` |
| JournalSearch | M3 | `bfa-journal-search` |
| NewNoteMenu | M4 | `bfa-journal-new-note` |
| CategoryChips | M3 | `bfa-journal-chips` |
| MigrationNotice | M3 | `bfa-journal-notice` |
| JournalList, JournalRow | M3 | `bfa-journal-list`, `bfa-journal-row` |
| RowThumbnail | M3 | `bfa-journal-thumb` |
| TypeTag, NeedsDetailsBadge | M3, M5 | `bfa-journal-tag`, `bfa-journal-tag-needs` |
| MentionCount | M5 | `bfa-journal-mention` |
| JournalPanel | M3 | `bfa-journal-panel` |
| ReadView | M3 | `bfa-journal-read` |
| EditView | M4 | `bfa-journal-editor` |
| FormatToolbar | M4 | `bfa-journal-toolbar` |
| SaveStatus | M4 | `bfa-journal-status` |
| DiscardConfirm, DeleteConfirm | M4 | `bfa-journal-confirm` |
| StaleCopyWarning | M4 | `bfa-journal-stale` |
| CharacterMismatchBanner | M2, M4 | `bfa-journal-character` |
| LinkAutocomplete | M5 | `bfa-journal-autocomplete` |
| Wikilink | M5 | `bfa-journal-wikilink` |
| DuplicatePicker | M5 | `bfa-journal-picker` |
| Backlinks | M5 | `bfa-journal-backlinks` |
| ImageStrip | M3, M4 | `bfa-journal-strip` |

Markup for the list belongs in `character-journal-list.ts`. Markup for the
panel belongs in `character-journal-panel.ts`. Strings for the starter
headings belong in `character-journal-templates.ts`. Colors belong in
`character-journal.css`, fed by `character-journal-theme.ts`.

## Frames

Desktop frames are 1180×940. Phone frames are 375×812. Each exists in
light and dark. Files are `{name}-{light|dark}.png`.

| Frame | What it proves |
| --- | --- |
| list-populated | Tab, quick note, search, chips, migration line, rows, thumbs, mentions, needs details |
| list-empty | No notes, zero counts |
| list-search | Search keeps the other chips' counts and filters rows |
| list-no-matches | No matches |
| list-filter | Selected chip, NPCs |
| list-empty-category | No quests |
| list-new-note | Type menu |
| list-autocomplete | Quick-note listbox and Create |
| list-file-error | Text kept, error under the bar |
| list-focus | Focus ring on the quick-note field |
| list-loading | Loading notes, counts hidden |
| list-migration-error | Existing notes left unchanged, no empty list |
| panel-read | Read mode, links, checkbox, image, mentioned in, scrim |
| panel-placeholder | Unsorted, Needs details, Back, mentioned in |
| panel-edit | Toolbar, starter headings, Saving… |
| panel-error | Storage is full, text kept |
| panel-stale | Other window, reload, replace confirm |
| panel-discard | Keep editing focused |
| panel-delete | Keep note focused |
| panel-autocomplete | Editor listbox |
| panel-duplicate | Two notes named Marcus, with dates |
| panel-character | Note belongs to another character |
| panel-image | Oversized file rejected, thumbnail and Remove kept |
| phone-list | Stacked File note, scrolling chips, two-line preview |
| phone-empty | Stacked controls, No notes |
| phone-panel-read | Full-viewport read panel |
| phone-panel-edit | 44px targets, wrapped toolbar |
| phone-panel-discard | Confirm fully on screen |

## Design sign-off

Reviewed against the plan milestones on 2026-10-20. The mockups were
rendered with Playwright and checked in both themes at 1180px and 375px.

### M1. Pure model

No screen. The list preview the functions have to produce is specified:
plain text, markdown markers removed, about 90 grapheme clusters, ellipsis
when cut, a trailing 🎲 kept whole. Row copy in the frames is that plain
text.

### M2. Sheet host

The Journal tab is the last tab, after Extras, uppercase, 12px/700, 44px
tall, with the sheet's 3px underline. Light active color is the sheet red
`#c5312d` (5.45:1 on white). Dark active color is `#ff8a84` (6.91:1 on
`#1b242b`) because the sheet red on the dark sheet is 2.89:1. Inactive
tabs use the sheet text color. The section fills the content region under
the tab strip. The character-mismatch banner is specified and framed. The
mount, the active-class copy, and the preference teardown are behavior,
not extra screens.

Matches the sheet: same tab type, same underline, same red in light, same
Roboto.

### M3. Migration, list, and read panel

Framed in both themes: populated list, empty list, search, no matches,
selected chip, empty category, loading, migration notice, migration
error, read panel, thumbnails, image in the note, image strip. Backup
failure does not look like an empty journal. A second open is not a
screen. Unset migrated notes stay under All, labeled Unsorted, which is
the resolved default.

Matches the sheet: the list is the sheet's content pane. Rows are compact
like inventory rows. Tags use the sheet's `#f2f2f2` pill. The read panel
uses the sheet's right-edge sidebar arrangement.

### M4. Editing and capture

Framed in both themes: edit with starter headings, toolbar words, Saving…,
storage-full error, quick note, failed file, new-note menu, discard
confirm, delete confirm, stale warning, image rejection. The confirm is
inside the panel, focused on the safe button, and fully on screen at
375px. The file input is not a control in the frames and is specified as
`tabindex="-1"`. Quest status is not shown. There is no open-threads
page. Session titles use the locale date. There is no oldest-first
control and no shortcut.

Matches the sheet: primary File note is the sheet's red fill with white
type (5.45:1). Secondary buttons are rectangular, uppercase, 2px corners.
The textarea uses the sheet's input colors, not a white field on the dark
sheet.

### M5. Links

Framed in both themes: quick-note autocomplete, editor autocomplete,
placeholder with Needs details, Back, Mentioned in, mention counts on
rows, and the duplicate picker. Create does not ask for a category.
Needs details is gold, not the error red, so a new note does not look
broken.

Matches the sheet: the listbox and the type menu are the sheet's surface,
border, and row height. Links are underlined text buttons, which is how
the sheet's description links behave, at a blue that passes.

### M6. Reading quality

Tokens above are the contrast pass, including the selected chip that was
2.89:1. Phone frames cover the list, the empty list, the read panel, the
edit panel, and the discard confirm. Targets grow from 36px to 44px at
the 760px breakpoint. Focus order is specified, and `list-focus` shows
the ring. Reduced motion is specified as no slide. The live-sheet
checklist stays in the implementation pull request, as the plan says.

### How each frame follows the sheet

- Light frames use the sheet's white page, `#242527` text, `#f2f2f2`
  tags, `#c5312d` active tab and primary button, and Roboto.
- Dark frames use the measured sheet background `#1b242b`, light text
  `#f2f4f6`, and a lifted field `#24303a`. The active tab and the
  selected chip use `#ff8a84` so the sheet's red language survives the
  contrast fix.
- Both themes use the same tab geometry, the same 3px underline, the
  same uppercase chrome, the same 2px corners, and the same right-edge
  panel with the close control on the right.
- Theme comes from the sheet class (`ct-character-sheet--dark-mode` or
  `ct-theme-dark`), from `data-theme`, or from the sheet's computed
  background. It does not come from the operating system. The section
  and the panel both update when the sheet class changes.

## Plan changes from this pass

Dylan accepted every default in the plan's open questions. Those are
marked resolved in the decision log. The design pass also settled the
items the plan had left for a UI review. The plan file now records the
same answers.

- Migrated notes stay `unset`, shown as Unsorted under All. They do not
  land in Sessions.
- A new `[[Name]]` placeholder stays unset, with Needs details, and the
  quick-note bar does not ask for a type.
- Duplicate titles stay legal. The picker adds the short date so two
  identical names can be told apart.
- Quest status stays stored and unused. There is no open-threads view.
  Checkboxes still toggle in read mode.
- Session titles stay `Session · {locale date}`. One quick-note target
  per day: the most recently updated session with today's date.
- A stale panel does not overwrite a newer copy.
- No quick-note shortcut in this version.
- The thumbnail stays the first image. No chooser.
- The 3 MB cap stays.
- Oldest-first is not a control. Sessions sort by `sessionDate`, then
  `updatedAt`. Everything else sorts by `updatedAt`.
- Implementation branches off `cursor/character-journal-cade`. Pull
  request #6 stays unmerged.
- Selected chip and active tab: `#c5312d` in light, `#ff8a84` in dark.
- Mention count reads `Mentioned in 3`, and is hidden at 0.
- Phone targets are 44px.
- Empty copy is `No notes`, `No matches`, and `No {category}`.
- Starter headings are the ones already in the plan.
- Quick-note placeholder is `Note for today's session`. The button is
  `File note`.
- Delete is pinned to the bottom of the panel.
- Back is the second tab stop when a link has been followed.
- Chip counts ignore the current search.
- A failed migration does not show an empty journal.
