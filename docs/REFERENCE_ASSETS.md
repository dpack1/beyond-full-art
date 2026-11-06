# Reference Assets

Deletion-cleanup research is recorded as sanitized text in
`docs/NETWORK_DELETE_RESEARCH.md`. Raw browser network captures are not kept in
the repository because headers and payloads can contain cookies, account data,
and private character identifiers.

Character-sheet screenshots and the layout notes live in `docs/ddb-reference/`. The reference character is Matilda Greywolf.

Public feature highlights for the root README live in `assets/readme/`. A live
README capture shows Matilda only and omits the browser tab strip, URL, toolbar,
and D&D Beyond account bar. It is reviewed as public content before commit. A
significant UI or flow change replaces the affected README image in the same
change; a wording-only change does not.

Keep each live PNG as the source capture. The README displays its annotated SVG
from `assets/readme/svg/`, which embeds that PNG and uses the shared red label,
white text, warm parchment connector curve, and red-and-white target treatment.
Update the source and wrapper together.

Do not substitute Playwright fixture screenshots for live README feature
highlights. Fixtures document and test extension behavior; they are not
presented as Matilda's live sheet.

The 2026-08-06 observation is not a guarantee that D&D Beyond will preserve
the same private endpoint or payload.
