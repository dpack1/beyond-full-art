# Character journal v2

## Goal

Replace the split note list and editor with a player-only wiki on the existing
Journal tab.

When this plan is complete, a player on a D&D Beyond character sheet can:

- File a one-line note into today's session from a bar at the top of the tab.
- Browse Sessions, NPCs, Places, Items, Quests, and Backstory, or search
  titles, `#tags`, and note text.
- Open any entry in a slide-in side panel, read rendered markdown, and switch
  to Edit with a small formatting toolbar.
- Link notes with `[[Name]]`. A name that does not exist yet becomes a
  placeholder entry marked Needs details. Each entry shows where it is
  mentioned.
- Attach the images they already use (PNG, JPEG, WebP), with a thumbnail on
  the row and the picture in the note.

Notes and photos already stored by the current journal come with them. A
failed save still leaves the text on screen. Nothing is written to D&D Beyond.

This plan is the spec for that work. It does not implement it. The current
journal on pull request #6 stays as it is until an implementation branch picks
this plan up.

## Scope

Included:

- A schema version 2 entry, and a one-way migration of existing version 1
  notes and photos that can be reversed from a backup copy.
- Category chips, search, compact rows, and the quick-note bar on the Journal
  tab.
- A read-first side panel with rendered markdown, an Edit toggle, autosave,
  optional starter headings, and backlinks.
- `[[Name]]` links, autocomplete, and Needs details placeholders.
- Images on the new entries, including the photos already stored.
- Light and dark appearance sampled from the sheet, keyboard use, and a layout
  that works in the sheet column and at phone width.
- The sheet-integration bugs still open on pull request #6, fixed as part of
  the new host rather than left for the old editor.
- Unit tests, DOM tests, and Playwright coverage whose screenshots are
  reviewed against a written checklist. A live-sheet checklist stays in the
  implementation pull request.

Excluded:

- Game-master tools: statblocks, maps, relationship graphs, calendars,
  initiative, encounter prep, and sharing with the party or the GM.
- Required fields, character limits, and more than the six categories plus
  free `#tags`.
- Sync into D&D Beyond's Notes, Backstory, Extras, or Maps journal.
- Cloud sync, accounts, and any new Chrome permission. `unlimitedStorage`,
  `downloads`, and `webRequest` stay unrequested.
- A collected "open threads" page, in-character dates, and a secret marker.
  Checkboxes still work inside a note so a later view can read them.
- Popup access, export and download, a versioned file-format document, and
  import. Those stay deferred. The version 2 record is shaped so a later
  export can write markdown plus image files without another migration.

## Current state

Pull request #6 (`cursor/character-journal-cade`, head `4e2722a`) is open and
unmerged. The journal is not listed in `.agent/FEATURES.md`. Its living spec
is `.agent/plans/character-journal.md`.

What that branch does:

- Inserts a Journal tab after Extras and mounts an extension-owned section in
  the sheet content area. The popup preference
  `bfa.preferences.characterJournalEnabled` hides the tab and does not delete
  notes.
- Stores one array of entries per character at
  `bfa.characterJournal.entries.<characterId>` in `chrome.storage.local`.
  Photo bytes live in extension-origin IndexedDB under
  `bfa.journal.image.<id>`. The service worker is the only writer. Character
  ids are strings.
- Each entry is schema version 1: `title`, `blocks` (one text block plus image
  blocks), `characterId`, `createdAt`, `updatedAt`, `id`. See
  `src/features/character-journal/character-journal-types.ts`.
- The section is a split list and editor with search, an all-notes or
  with-photos filter, and newest or oldest order.
- Writes re-read and merge by entry id
  (`src/features/character-journal/character-journal-records.ts`). Records that
  fail validation stay in the array and are omitted from the list.
- The sheet host is `src/platform/dndbeyond/character-sheet-tabs-adapter.ts`
  and `src/content/character-sheet.ts`. Theme sampling lives in
  `character-journal-theme.ts`. The photo viewer and the fullscreen viewer
  already trap focus.

Owner testing on 2026-10-20 fixed the first click, dark text, scroll clipping,
unsaved-text loss, and a delete dropped during save. A later review and the
QA pass on draft pull request #8 left the bugs in Lessons from pull request #6.
Those bugs are still open at `4e2722a`. This plan does not change that branch.

Anyone who has used the unpacked extension already has version 1 notes. Treat
those notes as player data even though the feature has not shipped.

## External assumptions

The Journal tab still depends on D&D Beyond's sheet navigation. That DOM is an
unstable contract. Assumptions already recorded on 2026-10-13 and 2026-10-20
in `docs/ARCHITECTURE.md` still apply: the Extras label, the tab strip, the
content region as the sibling of that strip, capture-phase pointerdown on the
tab item, and appearance via `ct-character-sheet--dark-mode` or
`data-theme="dark"`.

New assumptions to verify on a live sheet before the panel CSS is finished,
and to record with the date in `docs/ARCHITECTURE.md`:

- The sheet can change the character id without a full load (`history.pushState`
  or an equivalent client route). QA reproduced this on a fixture, not on
  dndbeyond.com. Confirm whether the live sheet does it. The code path has to
  be safe either way.
- D&D Beyond's item and decoration sidebars are visual references only. Confirm
  which edge they enter from, whether a scrim covers the sheet, and a rough
  width. Do not mount inside that sidebar, and do not copy its hashed classes
  or its markup.
- Confirm a key the sheet does not already use before adding a quick-note
  shortcut. Maps uses J for its journal. The sheet is a different surface.
  Until that check, v2 has no global shortcut.
- `chrome.storage.local` quota is the shared extension quota (10 MiB in
  current Chrome, `QUOTA_BYTES`). Confirm the value in the implementation
  environment and surface it in the quota error. IndexedDB for image bytes is
  separate and is already how journal photos are stored.
- A content script shares the page DOM with dndbeyond.com. Any HTML parsed
  from a note and assigned with `innerHTML` can run as page script (an
  `onerror` handler is enough) and can act with the player's D&D Beyond
  session. The renderer assumption is that note text is untrusted input even
  though the usual author is the player. Import, deferred for later, would
  make that threat concrete.

Verification: one live character sheet in light and dark, plus the Playwright
fixtures that already model the nested scroller, the nested active tab, and a
`pushState` character change. A saved copy of the live DOM is still
outstanding from the version 1 plan.

## Approach

### Player loop

The Journal tab stays after Extras. Choosing it still hides the native pane
and shows the extension section. The section is no longer a list beside an
editor.

From top to bottom the section holds:

1. A quick-note field and a file button. Enter files the line. The field
   starts empty. Placeholder text can name the action ("Note for today's
   session") and is the designer's wording.
2. A search field. Matching covers the title, `#tags` in the body, the body
   text, and image file names so a photo saved under version 1 is still
   findable.
3. One row of chips: All, Sessions, NPCs, Places, Items, Quests, Backstory.
   Each chip shows a count. All includes entries whose type is still unset.
   The chips scroll sideways when they do not fit. They do not wrap into a
   second row.
4. Compact rows for the selected chip, recently updated first. A session row
   uses `sessionDate` when it has one, then `updatedAt`. Each row shows the
   type, the title, one plain-text line of preview, the mention count, and a
   thumbnail when the entry has an image. A Needs details badge shows on
   placeholders. The newest-or-oldest control and the with-photos chip go
   away. Photos remain visible as thumbnails and inside the note.

Choosing a row opens the side panel in read mode. The list stays mounted
under the panel. Edit is a toggle, not the default. Following a `[[Name]]`
link replaces the panel contents and keeps a back step. Panels do not stack.

Creating an entry is a type choice (the same six types) and then the panel.
The body starts with that type's starter headings when the player has not
typed anything. Headings are ordinary markdown. Deleting them is the way to
skip them. Nothing checks that they are still present.

Autosave writes after a short pause in typing, when the panel closes, and
when the page is hidden. The panel shows Saving, Saved, or the real error.
There is no character cap and no Save button required for the happy path.
Delete still asks first. Closing a panel with a save in flight waits for that
save or shows the error. It does not drop the text.

### Data model

Schema version becomes 2. The markdown body is the source of truth for prose,
tags, checkboxes, and `[[links]]`. Derived facts (tag list, outgoing links,
mention counts) are computed when the list or panel renders. They are not a
second copy that can drift.

```ts
export const CHARACTER_JOURNAL_SCHEMA_VERSION = 2 as const;

export type JournalEntryType =
  | 'backstory'
  | 'item'
  | 'npc'
  | 'place'
  | 'quest'
  | 'session'
  | 'unset';

export type JournalQuestStatus =
  | 'abandoned'
  | 'active'
  | 'done'
  | 'failed';

export interface CharacterJournalEntry {
  body: string;
  characterId: string;
  createdAt: string;
  featuredImageId: string | null;
  id: string;
  images: CharacterJournalImage[];
  needsDetails: boolean;
  questStatus: JournalQuestStatus | null;
  schemaVersion: 2;
  sessionDate: string | null;
  title: string;
  type: JournalEntryType;
  updatedAt: string;
}

export interface CharacterJournalImage {
  altText: string;
  blobKey: string;
  byteSize: number;
  fileName: string;
  height: number | null;
  id: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number | null;
}
```

Rules:

- `characterId`, entry ids, and image ids are strings generated by the
  extension. Never coerce a character id through a JavaScript number.
- `title` is trimmed. An empty title is stored as `Untitled entry`, the same
  fallback as version 1.
- `type: 'unset'` is a placeholder or a migrated note the player has not
  categorized. It appears under All only.
- `needsDetails` is true only for entries created from a `[[link]]` the player
  has not edited. Migration sets it false. The first successful edit from the
  panel clears it.
- `questStatus` is null except on quests. The field exists so a later status
  control does not need a migration. The control itself waits on Open
  questions.
- `sessionDate` is `YYYY-MM-DD` in the player's local calendar, or null. The
  quick-note bar sets it. A renamed session title does not clear it.
- `featuredImageId` points at an image on the same entry, or null. Until the
  player can choose one, the first image is the thumbnail.
- `images[].blobKey` stays `bfa.journal.image.` plus the image id, validated
  by the existing `isJournalImageBlobKey` check.
- Timestamps stay ISO strings.
- A record that fails validation stays in the stored array and is counted as
  unreadable. Saving a different entry must not drop it. This is the version 1
  rule and it stays.

Tags are `#` plus letters, numbers, and hyphens, length 1 to 40, read from
the markdown token stream. A heading is not a tag. A tag inside a code span
is not a tag. The chip row does not grow a chip per tag. Search matches them.

Links are `[[Name]]` in the body. The name is trimmed, cannot contain `]` or
a newline, and is at most 200 characters. Resolution is by title within the
same character, compared with `trim` and `toLocaleLowerCase`. Accents stay
significant so a search for an accented name still works.

- One match: the link opens that entry.
- No match: read mode shows the name as unresolved. From autocomplete, the
  player can create a placeholder instead.
- Several matches: read mode shows a short picker (type, title, and the
  short locale date, so two identical names can be told apart). The editor
  does not guess.

Autocomplete writes `[[Name]]` and nothing else, so the textarea stays
readable. Renaming an entry whose previous title matched exactly one entry
rewrites that exact `[[Old name]]` token in other entries of the same
character. An ambiguous old name is left alone. The rewrite is the only
automatic edit of someone else's body, and it is limited to that token.

Mention count is the number of other entries whose resolved links point at
this entry. Placeholders created from a link therefore show a count of at
least one once the naming entry has saved.

`questStatus` and a future export sidecar can identify entries by id. The
markdown the player edits does not contain ids.

### Storage and limits

Text and metadata stay in `chrome.storage.local` under the same per-character
key. Image bytes stay in extension-origin IndexedDB. The content script still
does not use page-origin storage.

```text
bfa.preferences.characterJournalEnabled
bfa.characterJournal.schemaVersion          // 2 once this code ships
bfa.characterJournal.entries.<characterId>  // mixed array: v2 entries plus any unreadable records
bfa.characterJournal.backup.v1.<characterId>
bfa.journal.image.<imageId>                 // IndexedDB, unchanged
```

The global schema key is the code's version, not the per-character migration
latch. An entry's own `schemaVersion` is the latch. A character who has never
opened the journal after the upgrade still has version 1 records until the
first successful migration.

Limits, on purpose:

- No product character cap. The 2,048-character limit D&D Beyond briefly put
  on campaign text is the outcome to avoid.
- The practical ceiling for text is `chrome.storage.local` quota, shared with
  portrait metadata and preferences. A year of session notes fits. Image bytes
  do not count against it.
- Each new image is still PNG, JPEG, or WebP up to 3 MB. There is no separate
  cap on how many images a character can have. IndexedDB disk quota is the
  ceiling. A quota failure on either store says storage is full and leaves the
  draft on screen, which the current quota copy already does.
- Do not request `unlimitedStorage` in this version. If a real journal hits
  the text quota, that request is a later decision, with the draft still
  intact.
- The photo message keeps the base64 field. In this Chromium,
  `chrome.runtime.sendMessage` delivers an `ArrayBuffer` as a plain object, so
  a buffer-only put is rejected. That was decided on the version 1 branch and
  stays.
- `createImageBitmap` still skips files over 1 MB and still stores null
  dimensions when either side is over 4096. The file is still saved.

Writes keep the version 1 merge: re-read the array, merge by entry id, keep
the newer `updatedAt` for that id, preserve unreadable records, retry when
the array changed (the current four attempts). Two windows adding different
entries both survive.

Two windows editing the same entry do not. Last-write-wins would drop a
note, which QA saw once. Before an autosave, if the stored `updatedAt` is
newer than the copy the panel loaded, do not write. Show that the note
changed in another window and let the player reload the panel. Reloading
replaces the open draft only after they confirm. Add the unit test that
delays `storage.local.set` and saves two different notes, which the review
asked for and which a single browser run cannot lock.

The body stored is the textarea string. Autosave does not re-serialize
markdown. A checkbox toggle from read mode patches that one task-list line.
A rename rewrites matching `[[tokens]]` only. Those are the only writers that
change a body the player did not type.

### Migration

Migration runs on the character whose journal is opening, inside the
implementation that can also read version 2. It is idempotent.

1. Read the raw array. If there is no version 1 entry, stop.
2. If `bfa.characterJournal.backup.v1.<characterId>` is absent, write the raw
   array there. If that write fails, stop. Do not convert the live key. The
   player sees an error that their existing notes were left unchanged.
3. Map each readable version 1 entry to version 2. Leave unreadable values and
   existing version 2 entries as they are.
4. Write the array with the merge writer. Read it back. Every version 1 id
   that was readable before the write must be present as version 2 with the
   same `blobKey` values. On a mismatch, write the backup back over the live
   key and show the error.
5. Leave the backup in place. Do not delete image blobs. The backup duplicates
   text, not bytes.

Version 1 to version 2 field mapping:

- `body` is the text blocks joined with a blank line, which is what
  `getTextFromJournalEntry` already does. After that text, append one
  markdown image per image block, in order:
  `![file name](bfa-journal-image:<imageId>)`.
- `images` is the image blocks, same ids and blob keys. `altText` starts as
  the file name. `featuredImageId` is the first image, or null.
- `type` is `unset`. `needsDetails` is false. `questStatus` and `sessionDate`
  are null. Title and timestamps are copied. `schemaVersion` is 2.

A note that was only photos still migrates: the body is the image lines, and
the row has a thumbnail. A rough-draft text entry with no image blocks
migrates the same way.

The version 1 reader treats `schemaVersion === 1` as required. After a
successful migration, an old build would hide those notes and, because of the
unreadable-record rule, would not delete them. Ship the reader and the
migration together. There is no production population on schema 1, only
unpacked copies, and those copies update with the extension.

### Markdown rendering and sanitization

Rendered notes are inserted into dndbeyond.com. That is the security
boundary.

Use the `marked` lexer and a local DOM builder. Add `marked` as a direct
dependency, pinned, and import it only from the character-sheet bundle
(`src/content/character-sheet-entry.ts` already pulls the journal in). Do not
import it from the service worker or the popup.

Why a dependency: headings, nested lists, emphasis, links, fenced code, and
task lists are the kind of parser that looks small and then accepts raw HTML
by mistake. `AGENTS.md` allows a dependency when the task is not a small
native API. Walking `marked.lexer` tokens is the part we review. Hand-rolling
the lexer is the larger risk.

Why no HTML sanitizer library: the builder never turns note text into an HTML
string and never assigns note text through `innerHTML`, `outerHTML`,
`insertAdjacentHTML`, or `document.write`. Event-handler attributes and
`<script>` therefore have no parser to run them. DOMPurify would be the
requirement if a later change rendered HTML strings. That change does not
land without a sanitizer and a review of this section.

Builder rules:

- Call `marked.lexer` with GitHub-flavored markdown and HTML parsing disabled.
  Split `[[Name]]` out in our own pre-pass and lex the surrounding segments,
  so a link name is never interpreted as markdown structure.
- For each token, create an element with `document.createElement` and set
  text with `textContent`. Unknown token types produce nothing.
- Allowed elements: `p`, `h1` through `h3`, `ul`, `ol`, `li`, `strong`, `em`,
  `a`, `code`, `pre`, `blockquote`, `br`, and a checkbox `input` we create
  ourselves. The toolbar's heading button inserts `## `, so three levels are
  enough. Deeper headings render as `h3`.
- Links: `http:` and `https:` only, after `URL` parsing. Set
  `rel="noopener noreferrer"`. Reject `javascript:`, `data:`, `blob:`,
  `vbscript:`, and protocol-relative URLs. The visible text is the link text
  from the token, not the URL, unless the player wrote the URL as the text.
- Images: the only source that becomes an `img` is
  `bfa-journal-image:<imageId>` where the id matches `^[A-Za-z0-9-]+$` and
  the image belongs to this entry. The `src` is a blob URL we created from
  IndexedDB. Any other image destination, including `https` images, renders
  as text ("Image not loaded") and does not fetch.
- No raw HTML, no `style` or `class` or `id` from the note, no SVG, no iframe,
  no event-handler attributes.
- Checkboxes in read mode are real controls. Toggling one patches that task
  line in the stored body and autosaves. If the line cannot be found
  unambiguously, the box does not change and the player uses Edit.
- Wikilinks render as buttons that navigate the panel. They are not `<a href>`.

Preview text uses the same walker, takes the text content, collapses
whitespace, and cuts on grapheme clusters (`Intl.Segmenter` with
`granularity: 'grapheme'`, or `Array.from` when the segmenter is missing).
`String.prototype.slice` counts UTF-16 units and splits 🎲. A preview of 86
`a` characters plus 🎲 must not contain a lone surrogate. The cut length stays
about 90 clusters, with an ellipsis when the text is longer. Markdown markers
do not appear in the preview.

Tests for the builder, kept next to it, include at least: raw HTML, an image
with an `onerror` attribute, a `javascript:` link, an SVG payload, a remote
image URL, a blob image URL typed by hand, a mismatched tag, a heading that
must not become a tag, a `#tag` that must, a `[[Name]]` with a bracket inside
the name, and the emoji preview.

### Side panel and the sheet

The panel is extension-owned DOM with `data-bfa-journal-panel`. It is appended
to `document.body`, not into the sheet scroller and not into D&D Beyond's
sidebar. `position: fixed` on the body avoids the sheet's `overflow: hidden`
and any transform that would trap a fixed descendant. Width is `min(28rem,
100%)`. On viewports at or below the existing 760px journal breakpoint it
covers the viewport. Above that, it sits on the right and the journal list
remains on the sheet underneath.

The panel is a dialog: `role="dialog"`, `aria-modal="true"`, labelled by the
entry title. Reuse `trapTabKey` and `restoreFocus` from
`src/features/fullscreen-viewer/focus.ts`. Focus moves to the dialog when it
opens. Escape closes it and returns focus to the row or the quick-note field
that opened it. A visible Close button is required. The photo viewer
(`z-index: 2147483646`) and the fullscreen viewer stay above the panel so a
picture can open on top of it. The panel sits above the sheet content and
below those two.

While the dialog is open, set `inert` on the journal section so the list is
not a second tab stop. Remove `inert` on close, on teardown, and on a
character change. Do not set `inert` on the whole D&D Beyond document. A
failure to remove it would freeze the sheet.

Read mode shows the rendered body, the image strip (the existing viewer,
opened from a thumbnail), the type, the Needs details badge when set, and
"Mentioned in" as buttons for the entries that link here. Edit mode shows a
textarea and a toolbar. The toolbar buttons are Bold, Italic, Heading, List,
Checkbox, Link, and Image. Each has an accessible name and inserts markdown
around the selection, then returns focus to the textarea. The Image button
clicks a file input with `tabIndex = -1` and no place in the tab order. The
input accepts `image/png`, `image/jpeg`, and `image/webp`. Adding an image
writes the blob first, then the markdown reference, and deletes the new blob
if the note save fails. That order matches `attachImage` today.

Theme: call the existing `readSheetTheme` and `observeSheetTheme` for both the
section and the panel. Also treat a `ct-theme-dark` class as dark. Do not
read `prefers-color-scheme`. Selected chips, badges, and links use a color
that passes the theme helper's contrast check against the sampled background
in light and in dark. The current pressed chip is `#c5312d` with no dark
override, about 2.89:1 on the dark panel `#1b242b`. Chip text is 11px, so the
bar is 4.5:1. The design pass sets the selected label and the 3px underline
to `#c5312d` in light (5.45:1 on white) and `#ff8a84` in dark (6.91:1 on
`#1b242b`). A hardcoded red inset on the tab, used when the native active
class was not copied, has the same problem. Prefer the sheet's own active
class, and use `#ff8a84` only when that class's computed color fails the
4.5:1 check. Layout, copy, and the rest of the tokens are in
`.agent/plans/character-journal-v2-design.md`.

Reduced motion: the panel appears and disappears without a slide.

Resilience of the host, in the same code that mounts the list:

- Mount the section on the content region next to the tab strip
  (`findContentHost`). `findJournalMount` currently walks every descendant and
  keeps the last node with `overflow: auto` or `scroll`, which is why QA saw
  the section inside `ct-primary-box`. Stop searching descendants.
  `fitJournalToVisiblePane` can still measure a clipping ancestor and set the
  section's max height so the list scrolls inside the sheet.
- Learn the native active class from any tab-list element that currently has
  one, not only from the Extras node passed to `rememberNativeActiveClass`. A
  sheet that opens on Actions never puts that class on Extras. When Journal
  opens, remove that class from every element in the tab list that is not the
  journal item, including a nested `span` that `findNativeTabs` does not
  return. QA's Extras control was that nested span, so the underline stayed.
- On a URL change, parse the new character id before any further save. A dirty
  panel keeps the id it was opened with and disables autosave while the URL id
  differs. The panel says which character the note belongs to. Discard, then
  the next open reads the new id. A save already in flight finishes for the id
  captured when it started, and its completion must not paint that entry onto
  the new character or announce Saved for the new character. `syncCharacterRoute`
  today only calls `requestHide()`, and a dirty draft leaves
  `state.characterId` on the previous id, which is the QA failure.
- Turning the popup preference off calls `requestHide` with the teardown as
  its completion. Keep editing currently drops that completion, so the tab
  stays after the preference is off. Hold the pending teardown and run it the
  next time the journal actually hides. The preference stays off. The tab
  remains only while the unsaved note is still open.
- The discard prompt lives in the panel, receives focus, and is scrolled into
  view if the panel itself scrolls. Escape keeps the draft. The version 1
  prompt is inline near Save, so on a short pane it sits below the fold, takes
  no focus, and ignores Escape.
- Startup still removes a journal tab, tab item, and section left by an
  extension reload, and also removes a leftover panel. The tab observer stays
  narrowed to the sheet shell and still stops after repeated strip and insert
  cycles. Panel loads keep a generation token so a slow read cannot fill a
  panel that has already closed.
- Claim the Journal hit target on capture-phase pointerdown, including
  padding, and keep keyboard activation working when a click arrives with no
  pointerdown. `preventDefault` stays limited to that hit target and to the
  panel's Tab and Escape handling.

### Accessibility and narrow widths

Tab order on the section: quick-note field, its file button, search, the chip
radiogroup, then the rows. Chips are `role="radiogroup"` and `role="radio"`.
Arrow keys move the selected chip. Rows are buttons whose accessible name
includes the type and the title.

The panel tab order: Close, Back (only after a link has been followed), Edit
(or Done editing), the toolbar when editing, the textarea or the read view,
the mention buttons, Delete. Delete stays pinned to the bottom of the panel.
Toolbar controls are buttons, not a contenteditable surface. The file input
is not focused by Tab. A confirm traps focus until Escape or a choice, and
Escape keeps the draft.

At the 760px breakpoint and below:

- The panel is full viewport. Close returns to the list.
- Chips remain one horizontally scrolling row.
- The quick-note button moves under the field if the pair would overflow.
- The row keeps the type, title, and thumbnail. The preview can wrap to two
  lines. The mention count stays visible as "Mentioned in 3".
- Touch targets keep at least the current 36px minimum. At 760px and below
  they grow to 44px.

Also check the sheet's desktop column, which is already narrow. Capture that
width on the live sheet rather than assuming a viewport. The list has to be
usable there with the panel closed.

Empty copy is a label, not instructions: no entries, no matches for a search,
and an empty category each have one line. The current plan's ban on in-app
instructions still applies.

### Starter headings

Inserted only as the initial `body` of a new entry of that type. They are
markdown the player can delete. Proposed wording, from the player side:

- NPC: Who they are to me, Where, What they want, We owe / they owe, My
  suspicions.
- Session: What happened, Who we met, Promises, Loot, Open questions, Best
  moment.
- Quest: Goal, Given by, Reward, Next step.
- Item: Where we found it, Who carries it, What we know.
- Place: Why it matters, Who is there.
- Backstory: What I remember.

A placeholder created from `[[Name]]` gets an empty body and type `unset`.
Choosing a type later, while the body is still empty, inserts that type's
headings.

### Quick note

Enter on the quick-note field appends the line to the session entry whose
`sessionDate` is today, creating that entry when it is missing. The title of a
created session is `Session ·` plus the locale date. Further notes that day
append to the most recently updated session with today's date, so a second
session the player created by hand is left alone when it is older. The
appended line is a markdown bullet prefixed with the local time, then the
player's text, for example `- 20:17 Bought a map from [[Voss]]`.

`[[` in the quick-note field and in the editor opens a listbox of entries,
recently updated first. Arrow keys move, Enter chooses, Escape dismisses the
list and leaves the typed text. A row at the end creates a placeholder with
the typed name, type `unset`, and Needs details, without opening the panel.
The quick note still files.

A failed file leaves the text in the bar.

### Source layout

Version 2 changes the section's behavior, so the split the version 1 review
deferred is in scope. Keep D&D Beyond selectors in
`src/platform/dndbeyond/`. Keep Chrome storage in `src/platform/chrome/`. The
journal feature owns the domain and the DOM.

```text
src/features/character-journal/
  character-journal-types.ts        version 2 types and guards; version 1 guard stays for migration input
  character-journal-migrate.ts      pure mapping and the backup confirmation
  character-journal-markdown.ts     lexer walk, DOM builder, preview, checkbox line patch
  character-journal-links.ts        [[Name]] parse, resolve, tag parse, mention counts, rename rewrite
  character-journal-templates.ts    starter headings
  character-journal-query.ts        chip filter, search, row preview
  character-journal-list.ts         chips, rows, quick-note bar
  character-journal-panel.ts        dialog, read view, editor, toolbar
  character-journal-service.ts      load, autosave, images, migration orchestration
  character-journal-section.ts      show, hide, character binding, host lifecycle
  character-journal.css
```

`character-journal-section.ts` stays the show/hide controller. It should not
grow back past the size that made the review ask for a split. The list and the
panel own their markup.

### Documentation during implementation

Update these in the implementation pull request, not in this plan:

- `docs/PRODUCT_SPEC.md` for the wiki behavior, local-only storage, and the
  absence of a character cap.
- `docs/ARCHITECTURE.md` for the mount point, the panel, the storage keys, and
  the live-sheet checks with dates.
- `docs/DECISIONS.md` with an ADR that supersedes ADR-018 and ADR-019 for new
  writes: markdown body plus an image list, version 2, and the lexer-based
  renderer. ADR-017 (extension-owned and local) and ADR-020 (follow the sheet)
  still hold. Record the sanitizer decision in that ADR.
- `docs/IMPLEMENTATION_PLAN.md` and `docs/TESTING.md` for the new exit
  criteria and the live checklist.
- `.agent/plans/character-journal.md` stays the spec for the unmerged version 1
  slice. Point it at this file when implementation starts, so the two plans do
  not diverge in silence.

## Milestones

Each milestone is shippable on its own and has a check that does not depend on
later milestones. Implementation branches off `cursor/character-journal-cade`.
It does not merge pull request #6.

- [x] **M1. Pure model.** Version 2 types, the version 1 mapping, link and tag
      parsing, the markdown builder, grapheme preview, and the rename rewrite
      are pure functions with unit tests. The sheet still runs the version 1
      UI, and storage is still written as version 1. Done when the sanitizer
      corpus and a fixture migration of a text-plus-photo entry pass, and
      `npm run typecheck` and `npm test` pass.
- [x] **M2. Sheet host.** Fix mount parent, character-id binding, popup-off
      teardown, and the active underline, on the current UI. Done when the
      Playwright cases in Validation fail on `4e2722a` and pass here, including
      the screenshots for a single active tab and a section whose parent is
      the content region.
- [x] **M3. Migration, list, and read panel.** Opening Journal migrates that
      character, writes the backup, and shows chips, search, rows (with
      thumbnails from migrated photos), and a read-only panel with rendered
      markdown and the photo strip. A forced backup failure leaves the version
      1 array in place. Done when a version 1 fixture note and its photo
      appear after reload, and a second open does not rewrite the backup.
- [x] **M4. Editing and capture.** Edit toggle, toolbar, autosave, starter
      headings, create, delete, the quick-note bar, and the same-note conflict
      warning. The discard confirm is in the panel and focused. The file input
      is not in the tab order. Done when a quick note is on today's session
      after reload, a failed save leaves the textarea filled, and the conflict
      unit test plus the delayed two-note save test pass.
- [x] **M5. Links.** Autocomplete, placeholders with Needs details, backlinks,
      mention counts, and back navigation inside one panel. Done when
      `[[New name]]` creates an unset entry, the naming session lists it under
      Mentioned in, and renaming a unique title updates the token.
- [x] **M6. Reading quality.** Light and dark contrast for chips and text,
      phone and sheet-column layout, reduced motion, and a keyboard pass from
      the tab through the panel and back. Done when the screenshot checklist
      has been looked at and the live-sheet checklist is written into the
      implementation pull request. M6 can share a branch with M4 and M5, and
      it is still a separate sign-off.

Quest status UI is not a milestone. The field is stored as null. If the owner
answers yes in Open questions, add one milestone for the status control and
an Active filter on the Quests chip.

## Validation

Automated, from the repo root, on each milestone that touches the sheet:

```text
npm run typecheck
npm test
npm run build
npm run test:e2e
```

M1 can stop after `npm test`. The last milestone also runs `npm run test:all`.

Unit tests:

- Version 2 accepts a full entry and rejects a bad blob key, a non-string
  character id, and an unknown type.
- Migration maps text and images, keeps unreadable records, and is idempotent
  on an already-version-2 array.
- Backup confirmation fails closed when a mapped id or blob key is missing.
- Merge keeps two different entries and refuses a stale write over a newer
  stored copy of the same id. A delayed `set` still keeps both new entries.
- The sanitizer corpus listed under Markdown rendering.
- Preview of 86 `a` characters plus 🎲 does not contain a lone surrogate.
- Tag parse ignores headings and code spans. Link parse resolves unique,
  missing, and duplicate titles. Rename rewrite touches only a unique exact
  token.
- Search matches a title, a `#tag`, and body text, including an accented word.
- Checkbox line patch flips one box and leaves the surrounding markdown
  unchanged.

DOM tests:

- The section's parent is the content region when a nested child scrolls.
- Opening Journal clears `is-active` on a nested tab span, and copies the
  active class when the sheet loads with Actions selected.
- A `pushState` to another character id does not let a following save write
  the draft onto the new id. An in-flight save's success does not render as
  that new character's list.
- Preference off, Keep editing, then a real close, removes the tab.
- The discard confirm is focused and inside the panel viewport.
- Tab from the editor does not land on the file input.
- Escape closes the panel and returns focus. Escape on the confirm keeps the
  draft.
- The pressed chip's computed color contrasts with `#1b242b` and with the
  light panel.

Playwright, against the unpacked extension and a fixture with a viewport-locked
pane, a nested scroller, a tab strip that can rewrite itself, dark `#1b242b`
and light, and a nested active tab. Port the fixture shapes QA used on draft
pull request #8. Do not depend on that branch.

Screenshot review is a person looking at the images, not only an assertion on
a pixel count. Save the shots under the test output and attach them to the
implementation pull request. Check each one for clipped text, overlap, a
second underline, a white input on the dark sheet, and a confirm the viewport
does not contain.

- Journal list, dark and light, with chips, a row, a thumbnail, and a mention
  count.
- Pressed chip on dark. The label is readable.
- Read panel and edit panel, dark and light.
- Quick-note bar with a filed line visible on the session after the panel
  opens.
- Discard confirm, fully on screen, on a short pane.
- Phone width, list and full-screen panel.
- Emoji at the end of a long preview, rendered as one glyph.
- After opening Journal, the tab strip shows one active item.

Live sheet, in the implementation pull request, after `npm run build` and a
reload of the unpacked extension:

1. Journal is still the uppercase tab after Extras. One pointerdown on the
   label and on the padding opens it. The previous tab is not underlined,
   including when the sheet loaded on Actions.
2. The list replaces the main pane. It is not inside a nested scroller.
3. Light and dark, including a toggle while Journal is open. Chip text stays
   readable.
4. File a quick note. Reload. It is on today's session.
5. Open an entry, read it, edit it, reload. The markdown survived without
   being rewritten into something else.
6. Create `[[Someone new]]` from autocomplete. The placeholder shows Needs
   details and appears under Mentioned in on the note that named them.
7. Add a PNG under 3 MB. The row thumbnail and the panel both show it. A file
   over 3 MB is rejected and the note text remains.
8. Unsaved edit, switch to Spells, choose to keep editing. The confirm was on
   screen. The draft is still there.
9. Turn the popup setting off, keep editing, then close. The Journal tab
   leaves.
10. If the live sheet can change character without a reload, a note in progress
    does not appear on the next character.
11. Phone width or a narrow window: chips scroll sideways, the panel covers
    the screen, Close returns to the list.
12. Keyboard only: open Journal, file nothing, open a row, Edit, Close. Focus
    returns to the row. Tab never lands on an invisible file input.
13. A version 1 note and photo created before the upgrade are present once,
    with the text intact.

## Risks and rollback

Risks:

- Migration is the data-loss hazard. A partial write, or a version 2 reader
  bug that hides entries, is worse than a late release.
- D&D Beyond can change the tab strip, the content sibling, or the sidebar
  the panel is visually aligned with.
- `marked` can add a token we do not map. The builder's default is to drop
  unknown tokens, which is safe and can swallow a construct we meant to show.
  The corpus has to grow when we rely on a new construct.
- A leaked `inert` or a panel that is not removed on extension reload can
  block the sheet.
- The version 1 backup doubles text usage in `chrome.storage.local` until it
  is removed. A character already near the quota cannot migrate, by design.
- Two windows on the same note can still lose text if the player confirms a
  reload without reading the warning.
- Title-based links break when two entries share a name. That is a known
  limit, called out in Open questions.

Data protection:

- The backup key is written before the live key changes, and it is never
  overwritten once present.
- Image blobs are not copied and not deleted by migration.
- Unreadable records stay in the array.
- Autosave failure leaves the textarea and the quick-note field alone.
- A stale panel cannot overwrite a newer stored copy of the same id.
- Delete still requires confirmation.
- Rollback does not need to repair D&D Beyond data. The feature never writes
  there.

Rollback:

- Ship the host fixes (M2) only if you need them before the wiki. They do not
  change the schema.
- To undo the wiki after migration has run, restore
  `bfa.characterJournal.backup.v1.<characterId>` over the live entries key and
  remove the version 2 UI. Do this only if the backup's ids match what the
  player expects to recover. Edits made after migration exist only in the
  version 2 records, so a restore drops those edits. Say that in the release
  note for anyone testing unpacked builds.
- Hiding the feature is the popup preference. It already removes the tab
  without deleting storage. Fix its pending-teardown bug in M2 so that path is
  real.
- Leave both storage keys in place during a code rollback. A later build can
  read the backup.

## Progress log

- 2026-10-20: Plan written from the unmerged journal on pull request #6, the
  player-notes research in the uploaded report, and the open review and QA
  comments through `4e2722a`. No product code changed. Pull request #6 was not
  modified.
- 2026-10-20: Design pass. Dylan accepted every open-question default. Screen
  spec, tokens, and reviewed mockups are in
  `.agent/plans/character-journal-v2-design.md` and
  `.agent/design/journal-v2/`. No extension source changed.
- 2026-10-20: Implementation on `cursor/character-journal-v2-build`. M1 through
  M6 are in this branch. The journal stays unshipped until Dylan approves it.
  Visuals follow Matilda Greywolf (`172153137`), not the mockup PNGs. The
  pressed-chip check is the pill label against the pill fill. `#ff8a84` is a
  fallback token only.
- 2026-10-20: Merged `main` at `193b2c9`. Journal selectors moved into the
  Character journal group of `src/platform/dndbeyond/selectors.ts`. The notes
  panel does not reuse `ct-sidebar`. Accent, border, and the active-tab
  underline are sampled from the sheet. Closing a note returns to the list.

## Decision log

- 2026-10-20: Keep the Journal tab and the local, per-character storage
  boundary from ADR-017. Version 2 changes the record shape, not where the
  journal lives.
- 2026-10-20: The body is markdown the player typed. Autosave stores that
  string. It does not round-trip through the renderer. This protects spacing,
  headings the player deleted, and any syntax the renderer does not understand.
- 2026-10-20: Render with `marked`'s lexer and DOM nodes we create. Do not add
  an HTML sanitizer library while no HTML string is produced. Add one before
  any future path assigns parsed markdown through `innerHTML`.
- 2026-10-20: Links store `[[Name]]`, not an entry id. Unique titles resolve
  and follow renames. Duplicate titles ask the player to pick. Stable ids in
  the markdown would survive duplicates and would show UUIDs in the editor.
- 2026-10-20: Migrated notes use `type: 'unset'` and `needsDetails: false`.
  Filing a backstory into Sessions because it is old would mislabel player
  writing. The player recategorizes.
- 2026-10-20: Placeholders from `[[Name]]` use `type: 'unset'` and
  `needsDetails: true`, and the quick-note bar does not open the panel to ask
  for a type.
- 2026-10-20: One quick-note target per local day, keyed by `sessionDate`. The
  title shows the locale date. A counter such as "Session 12" needs campaign
  knowledge the sheet does not have.
- 2026-10-20: `questStatus` is stored and unused in the UI until the owner asks
  for the control. Checkboxes render and toggle. There is no Open threads page
  in this version.
- 2026-10-20: The first image is the thumbnail. A chooser can be added without
  a migration because `featuredImageId` is already on the record.
- 2026-10-20: Same-note saves from a stale panel are refused. Different notes
  still merge by id.
- 2026-10-20: The side panel is our dialog on `document.body`, visually similar
  to D&D Beyond's slide-in and independent of its markup.
- 2026-10-20: Popup access, export, a format document, and import stay deferred.
  Version 2 fields are plain strings, dates, and image metadata so an export
  can be a later reader of this same shape.
- 2026-10-20: No new Chrome permissions, no character cap, no remote images,
  no GM-only fields.
- 2026-10-20: Dylan accepted the defaults for every open question. Migrated
  notes stay uncategorized (`unset`, shown as Unsorted under All). A new
  `[[Name]]` placeholder gets no category. Duplicate titles stay allowed.
  Quest status and the gathered open-threads view stay deferred.
  Checkboxes still toggle in read mode. Session titles use the locale date,
  and a second quick note that day appends to the most recently updated
  session with today's date. A stale panel does not overwrite a newer copy.
  There is no quick-note shortcut. The thumbnail stays the first image. The
  3 MB cap stays. Oldest-first is dropped. Implementation branches off
  `cursor/character-journal-cade`, and pull request #6 stays unmerged.
- 2026-10-20: Design pass. Selected chip and active-tab fallback are
  `#c5312d` in light and `#ff8a84` in dark. Phone targets are 44px. Mention
  counts read "Mentioned in 3" and hide at zero. The duplicate picker adds
  the short date. Empty copy, starter headings, and the quick-note label
  are the ones in the design spec. Theme detection includes
  `ct-theme-dark` and does not read the operating system preference.
- 2026-10-20: Dylan rejected the mockup visuals. Matilda Greywolf
  (`https://www.dndbeyond.com/characters/172153137`) is the visual source:
  the Journal tab sits in the Notes and Extras strip, the list sits in that
  content box, and the panel is the right-hand Longsword / Organizations
  pane. Category chips are filled pills. The panel is about 340px, does not
  dim the sheet, and does not copy `ct-sidebar`: the reference did not capture
  a class for that slide-in, and `ct-sidebar__portal` is the portrait sidebar.
  Accent, border, and the active-tab underline are the character theme color,
  sampled from a frame or the active tab. Hashed classes are copied at runtime.

## Lessons from pull request #6

Sources: the pair review at `add4a33`, the re-review at `1d43394`, the tab
pass at `42c5b18`, the QA pass and root-cause notes at `42c5b18` (draft pull
request #8's Playwright run against this head). Items those reviews marked
fixed are not re-specified here. The ones still open are acceptance criteria
for the milestones named below.

1. **A client-side character change saves the first character.**
   `syncCharacterRoute` only hides the section. A dirty draft keeps the old
   id, Save stays enabled, and a save started before the hide still writes
   that id. QA saved a note on `169418374`, moved to `169418376`, and found
   the text on the first character. **M2.** Bind the draft id and the URL id
   separately. Block autosave when they differ. Do not report an in-flight
   save as the new character's journal.
2. **The section mounts in the nested scroller.** `findJournalMount` keeps the
   last descendant with `overflow: auto`. QA's parent was `ct-primary-box`
   while `ct-character-sheet-content` was `overflow: hidden`. **M2.** Mount on
   the content region beside the tab strip. Do not search descendants. The
   version 2 panel is on `document.body` anyway, so the list host and the
   panel host are different problems. Fix both.
3. **Popup off, then Keep editing, leaves the tab.** Teardown is the
   `requestHide` callback, and Keep editing drops it. **M2.** Run the pending
   teardown on the next real hide.
4. **The previous tab keeps its underline.** The active class is copied from
   Extras only, and it is cleared only on `findNativeTabs` (role controls and
   direct children). A nested `span` with `is-active` survives. A sheet that
   loads on Actions has no class on Extras to copy, so Journal falls back to a
   hardcoded red inset. **M2.** Learn the class from any active tab, and strip
   it from every element in the tab list.
5. **The discard prompt sits below the fold.** `renderConfirm` does not scroll
   or take focus, and Escape does not dismiss it. **M4.** The confirm is in
   the panel, focused, on screen. Escape keeps the draft.
6. **The file input is an invisible tab stop.**
   `.bfa-character-journal-photo-input` is 1×1 and `opacity: 0`, with no
   `tabindex="-1"`. **M4.** The toolbar's Image button activates it. Tab does
   not.
7. **Preview splits an emoji.** `getJournalEntryPreview` uses
   `text.slice(0, 87)`, which cuts a surrogate pair. Search still matched,
   because search does not slice. **M1 and M3.** Cut on grapheme clusters.
8. **The selected dark chip is about 2.89:1.** `#c5312d` on `#1b242b`, no dark
   override, 11px text. **M6.** The pressed chip uses a color that passes the
   existing contrast helper in both themes. Cover it with a DOM test so the
   hardcoded red cannot return unnoticed.

Also carry these forward. They are not all player-visible bugs, and the
version 1 review already named them:

- The section controller was 961 lines after the last split. Version 2 splits
  list, panel, markdown, and links when the behavior changes, which is this
  work.
- Same-note edits in two windows keep one copy. M4 refuses the stale write
  instead of leaving that as an unspoken last-write-wins.
- The delayed-`set` unit test for two different notes is still missing. M4
  adds it.
- Extension-reload cleanup, the show-generation token, quota copy, keeping
  unreadable records, revoking photo blob URLs, and the base64 photo payload
  stay. The panel adds its own leftover-node cleanup.
- A saved copy of the live DOM is still outstanding. M6's checklist is the
  place that gets closed, with a date in `docs/ARCHITECTURE.md`.
- Export, a session counter, clipboard paste beyond the image button, undo
  delete, and HEIC stay out of this plan. Paste of an image file can reuse the
  image button's path later without a schema change. It is not a milestone.

## Open questions

Resolved on 2026-10-20. Dylan accepted every default. None of these add or
remove a milestone.

1. Migrated notes have no category. Resolved: they stay `unset` and show
   under All as Unsorted. They do not land in Sessions. Affects M3.
2. A `[[Name]]` that does not exist becomes an unset placeholder, and the
   quick-note bar does not ask for a type. Resolved: it stays that way.
   Affects M5.
3. Duplicate titles are allowed. `[[Marcus]]` resolves only when one entry
   has that name. Resolved: titles are not unique. The read-mode picker
   shows type, title, and the short date. Affects M5.
4. Quest status is reserved on the record and not shown. Resolved: the
   control does not ship in this version. No milestone is added.
5. Checkboxes toggle in read mode. There is no gathered view. Resolved:
   toggling stays in read mode, and the open-threads view stays deferred.
   Affects M4.
6. Today's session is titled with the local date, and a second quick note
   the same day appends to the most recently updated session with that
   date. Resolved: no "Session 12" counter, and a second session that day
   is not an equal quick-note target. Affects M4.
7. A stale panel refuses to overwrite a newer copy. Resolved: that refusal
   stays. Last-write-wins does not. Affects M4.
8. No quick-note shortcut in this version. Resolved: a shortcut is not
   required. Affects M4.
9. The thumbnail is the first image. Resolved: no chooser in this version.
   Affects M6.
10. The 3 MB per-image cap stays. Resolved: a session does not keep a
    larger original. Affects storage limits.
11. Oldest-first is dropped. Resolved: it stays dropped. Sessions sort by
    `sessionDate`, then `updatedAt`. Every other chip sorts by `updatedAt`
    only. Affects M3.
12. Implementation branches off `cursor/character-journal-cade` and leaves
    pull request #6 unmerged. Resolved: do not wait for #6 to merge.

## Designer decisions

Resolved on 2026-10-20 in `.agent/plans/character-journal-v2-design.md`.
The answers below are the ones a builder needs. The design file has the
spacing, type scale, and both themes.

- Chips stay in the fixed order, with the count on the chip, in one
  scrolling row. Unselected text is `#5c6166` in light and `#a8b4be` in
  dark. Selected text and the 3px underline are `#c5312d` in light and
  `#ff8a84` in dark. Both clear 4.5:1 at 11px.
- Every category uses the same tag. The word distinguishes it. Unsorted is
  the label for `unset`. Needs details is a gold tag, not the error red.
- A row is type tag, title, one preview line, `Mentioned in 3` (hidden at
  zero), and a 48px thumbnail column. The column stays when there is no
  image, empty, so titles line up.
- The panel is the right edge, `min(28rem, 100%)`, full viewport at 760px
  and below, with a scrim. The list stays mounted underneath. Reduced
  motion removes the 160ms slide. Do not reuse the sheet sidebar's markup.
- Edit sits under the title, opposite the status. The button reads Edit or
  Done editing. The toolbar is words: Bold, Italic, Heading, List,
  Checkbox, Link, Image.
- A resolved wikilink is an underlined link-colored button. An unresolved
  one is dotted and uses the Needs details color. The duplicate picker
  adds the short date.
- Backlinks are headed `Mentioned in`. An entry with no mentions shows
  nothing.
- The quick-note field is the first row. Placeholder: `Note for today's
  session`. Button: `File note`.
- Empty lines: `No notes`, `No matches`, `No sessions`, `No NPCs`,
  `No places`, `No items`, `No quests`, `No backstory`.
- Starter headings are the player-side lines already in Approach.
- Saving…, Saved, and Not saved sit in the panel header. The full error
  is a banner under the header, so a phone-height panel still shows it.
- At 760px and below, the preview may wrap to two lines and targets grow
  to 44px. The type, title, thumbnail, and mention count stay visible.
