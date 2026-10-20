/**
 * D&D Beyond selectors the journal touches.
 *
 * A separate change is collecting every sheet selector into this module.
 * The block marked "Journal" is the journal's group. When that change
 * lands, keep this group inside the shared map instead of growing a
 * second list.
 *
 * Hashed module classes (`styles_tabButton__…`, `styles_sidebar__…`)
 * are copied from the live node at runtime. They are recorded in
 * `.agent/design/journal-v2/reference/live-sheet-light.json` and are
 * not constants here, because a D&D Beyond deploy changes the hash.
 *
 * Each constant names the feature that breaks when the selector misses.
 * `JOURNAL_SELECTOR_HEALTH` is the list the health test walks.
 */

export interface SelectorHealthCheck {
  feature: string;
  fixture: JournalSelectorFixture;
  name: string;
  selector: string;
}

export type JournalSelectorFixture = 'classic-tabs' | 'primary-box' | 'sidebar';

// --- Journal ---------------------------------------------------------------
// Observed 2026-10-20. Visual source: Matilda Greywolf, character
// 172153137 (Notes, Extras, and the right pane). Public light sheet
// 4741434 confirmed the stable class names. Hashed classes stay out.

/** Theme, tab observer, and style sampling. Miss: the journal never follows the sheet. */
export const JOURNAL_SHEET_CLASS = 'ct-character-sheet';
export const JOURNAL_SHEET_SHELL_CLASS = 'ct-character-sheet-shell';
export const JOURNAL_SHEET_ROOT_SELECTOR =
  `.${JOURNAL_SHEET_CLASS}, .${JOURNAL_SHEET_SHELL_CLASS}`;

/** Underdark / Appearance dark. Miss: the journal stays on the light fallback. */
export const JOURNAL_DARK_MODE_CLASS = 'ct-character-sheet--dark-mode';
export const JOURNAL_THEME_DARK_CLASS = 'ct-theme-dark';

/**
 * Classic tab strip (the owner's older sheet and the repo fixtures).
 * Miss: Journal is not inserted, or the active underline stays on Extras.
 */
export const JOURNAL_CLASSIC_TAB_NAV_CLASS = 'ddbc-tab-list__nav';
export const JOURNAL_CLASSIC_TAB_ITEM_CLASS = 'ddbc-tab-list__nav-item';
export const JOURNAL_CLASSIC_TAB_ACTIVE_CLASS = 'ddbc-tab-list__nav-item--is-active';
export const JOURNAL_CLASSIC_TAB_CONTENT_CLASS = 'ddbc-tab-list__content';

/**
 * Current sheet tab control. The hash changes; the adapter copies
 * whatever class the live tab button has. This selector only finds a
 * button inside the sheet so the copy has a starting node.
 * Miss: the Journal tab is not created on the 2024 sheet.
 */
export const JOURNAL_CURRENT_TAB_BUTTON_SELECTOR =
  `.${JOURNAL_SHEET_CLASS} button, .${JOURNAL_SHEET_SHELL_CLASS} button`;

/**
 * Section box for the open tab. The list reuses the label and tab
 * classes so the page stylesheet paints the heading.
 * Miss: the journal list does not pick up the sheet's section header.
 */
export const JOURNAL_PRIMARY_BOX_CLASS = 'ct-primary-box';
export const JOURNAL_PRIMARY_TAB_CLASS = 'ct-primary-box__tab';
export const JOURNAL_PRIMARY_LABEL_CLASS = 'ct-primary-box__label';

/**
 * Right-hand slide-in used by attacks and the Notes categories.
 * Miss: the note panel is an unstyled overlay instead of the sheet pane.
 * Width, border, and header type are sampled from the live node.
 */
export const JOURNAL_SIDEBAR_CLASS = 'ct-sidebar';
export const JOURNAL_SIDEBAR_INNER_CLASS = 'ct-sidebar__inner';
export const JOURNAL_SIDEBAR_PORTAL_CLASS = 'ct-sidebar__portal';
export const JOURNAL_SIDEBAR_HEADER_CLASS = 'ct-sidebar__header';
export const JOURNAL_SIDEBAR_HEADING_CLASS = 'ct-sidebar__heading';
export const JOURNAL_SIDEBAR_SELECTOR = `.${JOURNAL_SIDEBAR_CLASS}`;

/**
 * Button class fragments the sheet uses on Heal, Damage, and similar
 * controls. The journal copies a whole class list at runtime. These
 * fragments are how it recognizes a neutral button. Miss: File note and
 * Edit fall back to the extension's own button shape.
 */
export const JOURNAL_NATIVE_BUTTON_CLASS_FRAGMENTS = 'ddbc-button ct-button';

/** Text sample. Miss: chip and body color fall back to the token table. */
export const JOURNAL_TEXT_SAMPLE_SELECTOR =
  `.${JOURNAL_CLASSIC_TAB_ITEM_CLASS}, .ct-character-sheet-tab, h1, h2, p`;

/** Field sample. Miss: inputs lose the sheet's radius and border. */
export const JOURNAL_FIELD_SAMPLE_SELECTOR =
  `.${JOURNAL_SHEET_CLASS} input, .${JOURNAL_PRIMARY_BOX_CLASS} input, input`;

export const JOURNAL_SELECTOR_HEALTH: readonly SelectorHealthCheck[] = [
  {
    feature: 'Journal theme and the tab observer. The list never mounts on this sheet.',
    fixture: 'classic-tabs',
    name: 'JOURNAL_SHEET_ROOT_SELECTOR',
    selector: JOURNAL_SHEET_ROOT_SELECTOR,
  },
  {
    feature: 'Journal tab insertion on the classic strip. The underline cannot move to Journal.',
    fixture: 'classic-tabs',
    name: 'JOURNAL_CLASSIC_TAB_NAV_CLASS',
    selector: `.${JOURNAL_CLASSIC_TAB_NAV_CLASS}`,
  },
  {
    feature: 'Active tab underline. Extras keeps the red rule when Journal opens.',
    fixture: 'classic-tabs',
    name: 'JOURNAL_CLASSIC_TAB_ACTIVE_CLASS',
    selector: `.${JOURNAL_CLASSIC_TAB_ACTIVE_CLASS}`,
  },
  {
    feature: 'Journal mount. The list is appended outside the sheet content.',
    fixture: 'classic-tabs',
    name: 'JOURNAL_CLASSIC_TAB_CONTENT_CLASS',
    selector: `.${JOURNAL_CLASSIC_TAB_CONTENT_CLASS}`,
  },
  {
    feature: 'Journal section heading. The list title does not follow the sheet header.',
    fixture: 'primary-box',
    name: 'JOURNAL_PRIMARY_LABEL_CLASS',
    selector: `.${JOURNAL_PRIMARY_LABEL_CLASS}`,
  },
  {
    feature: 'Note panel. The slide-in does not reuse the sheet sidebar.',
    fixture: 'sidebar',
    name: 'JOURNAL_SIDEBAR_SELECTOR',
    selector: JOURNAL_SIDEBAR_SELECTOR,
  },
  {
    feature: 'Note panel header. The title does not use the sidebar heading.',
    fixture: 'sidebar',
    name: 'JOURNAL_SIDEBAR_HEADING_CLASS',
    selector: `.${JOURNAL_SIDEBAR_HEADING_CLASS}`,
  },
  {
    feature: 'Note panel chrome. Hashed sidebar classes cannot be copied.',
    fixture: 'sidebar',
    name: 'JOURNAL_SIDEBAR_INNER_CLASS',
    selector: `.${JOURNAL_SIDEBAR_INNER_CLASS}`,
  },
];
