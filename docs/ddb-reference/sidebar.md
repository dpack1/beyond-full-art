# Information Sidebar snapshot

**Last verified:** 2026-10-21

**Sheet:** public character 4741434, "Book", `https://www.dndbeyond.com/characters/4741434`

**Bundle:** `main.73ca5823.js` and `main.875602ca.css` from `media.dndbeyond.com/character-app/static/`

**Viewport:** 1440×1100. Pane opened by clicking Acrobatics (a skill pane). The machine-readable copy is [sidebar.json](sidebar.json).

This sheet has no inventory rows and no Notes tab, so an item pane and a notes textarea were not on the page. The note body (`ct-note-manage-pane`, header, textarea, help text) is the `NOTE_MANAGE` render in that same bundle. The shell around every pane is the same.

Underdark is not a control on this public sheet. Dark rules were read from the stylesheet: `ct-sidebar--is-dark-mode` turns the heading white, and `styles_dark__6-qrS` on the gap, the scroll body, and the border swaps those fills to `var(--ttui_grey-900)`.

## Open shell

`div.ct-sidebar__portal` is portaled to `document.body`. It has no rules of its own. Inside it: a mask, then an unclassed wrapper, then `div.swipeable`, then the dialog.

| Node | Classes | Computed, light, this viewport |
| --- | --- | --- |
| Mask | `styles_mask__nuvIu` `styles_visible__6s+G-` | Fixed, inset 0, z-index 1002, opacity transition 0.15s. `display: none` from 768px up. |
| Dialog | `ct-sidebar` `styles_sidebar__RrEHr` `styles_right__e4y1G` `styles_visible__6s+G-` | 340px wide, `position: absolute`, `top: calc(var(--top-navigation-height, var(--ttui-site-nav-height)) + 0.375rem)` (124px here), `z-index: 1`, transparent background, no shadow. Transition `left 0.15s, right 0.15s, box-shadow 0.15s`. Inline style `left: auto; right: 0px` (the stylesheet does not set `right` while the pane is open). Height `60.375rem` from 1200px up. Below 1200px the same class is `position: fixed; top: 0; z-index: 10001`. |
| Inner | `ct-sidebar__inner` | Absolute fill, column flex. |
| Edge controls | `styles_controls__NSnn3` | Flex, space-between, shown from 1200px. Buttons are transparent, 18px icons, opacity 0.25, full opacity on hover. |
| Pane | `styles_pane__AOt0h` | Column flex, relative. |
| Border | `styles_border__jHreB` | SVG `viewBox="0 0 340 18"`, height 18px from 1200px. Stroke and fill use `var(--theme-color)` and `var(--theme-background-solid)`. The bottom border adds `styles_bottom__De0fd` (`transform: rotate(180deg)`). |
| Gap | `styles_gap__kuwYv` | 10px tall from 1200px, 3px theme-color side borders, solid theme background. |
| Scroller | `styles_content__3knKz` | `data-scrollable-container="true"`, padding `0 10px 16px`, overflow-y auto, 3px theme-color side borders, text `var(--theme-contrast)`. |
| Header | `header.ct-sidebar__header` | Margin bottom 10px. Primary row is `ct-sidebar__header-primary` (flex, centered). |
| Title | `h1.ct-sidebar__heading` `styles_heading__j5Lvn` | 18px, weight 700, line-height 1.2, Roboto Condensed. Margin 0. |
| Note body | `ct-note-manage-pane` | Title in the heading. Callout `styles_callout__Sf-W2` is the save status. The field is `styles_textarea__7oQCq` around a `textarea`. |

`role="dialog"` and `aria-label="Information Sidebar"` are on the dialog.

## Edge controls

Visibility cluster `styles_visibility__MJ05x`: Hide sidebar (`styles_arrows__182cG`, double chevron) and Unlocked (open padlock).

Overlay cluster `styles_overlay__Uf4kU`, shown from 1600px: Set to overlay position (active class `styles_active__tWFiD`) and Set to fixed position.

Placement cluster `styles_placement__SZZi-`: Align Left and Align Right (active when right).

Each button sits in `span.ddbc-tooltip.ddbc-tooltip--dark-mode`.

Prev and Next are not in that bar. They are a `nav.styles_controls__-K4FO` inside the scroller, absolute, centered, rendered only when the pane history has more than one entry. Buttons use `styles_button__pEmHw`, labels `styles_label__qP9gK` ("Prev", "Next"), and a chevron `viewBox="0 0 320 512"`. Disabled at the ends.

The journal panel keeps Hide (it closes the note), Prev, and Next. Lock, overlay, fixed, and align have no journal action, so those buttons are not rendered.

## Journal placement

The native dialog is `position: absolute`. On the public sheet that resolves against `body`, which is `position: fixed`, so the pane sits on the right of the viewport. A signed-in sheet does not give the note panel that containing block. The note dialog therefore sets its own box: `position: fixed`, `right: 0`, `width: 340px`, `z-index: 10001`, `top` copied from the open native sidebar (otherwise the site nav height plus 6px), and `height` of the viewport minus that top. The edge controls stay in `ct-sidebar__inner`, above the pane, and stay content-sized. The toolbar's `flex: 1 1 100%` rule is not applied to them. Opening a note clicks the native sidebar's Hide control when that sidebar is wider than 200px, and repeats that close if the sheet opens it again.

## Hashes

`styles_sidebar__RrEHr`, `styles_right__e4y1G`, `styles_visible__6s+G-`, `styles_hidden__NRO1j`, `styles_left__N7X7-`, `styles_mask__nuvIu`, `styles_controls__NSnn3`, `styles_pane__AOt0h`, `styles_border__jHreB`, `styles_gap__kuwYv`, `styles_content__3knKz`, `styles_controls__-K4FO`, and the other `styles_*` names in the JSON are build output from this bundle. They are not stable hooks. The parity check compares them to a live pane.
