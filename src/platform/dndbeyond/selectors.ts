/**
 * D&D Beyond selector map.
 *
 * Every D&D Beyond selector or class string this extension depends on lives
 * here. Grouped by the feature that breaks when the selector stops matching.
 * Extension-owned `bfa-` classes and `data-bfa-` attributes are a separate
 * section at the bottom; they are not D&D Beyond's contract.
 *
 * `source: 'code'` entries are queried by the extension and must match the
 * saved fixtures. `source: 'live'` entries are class strings the Playwright
 * check looks for. No sheet HTML was saved, and the screenshots do not show
 * class names, so those strings are not verified until that check passes.
 * The journal reads the sheet root, the classic tab item, and a class ending
 * in `dark-mode`. `ct-primary-box` and `ct-theme-dark` stay live-only.
 * See docs/ddb-reference/README.md and docs/TESTING.md.
 *
 * When a health test names an entry, change that one selector. A renamed
 * class is usually the whole fix.
 */

export interface DdbSelectorEntry {
  readonly id: string;
  readonly selector: string;
  /** What this element is on the D&D Beyond page. */
  readonly targets: string;
  /** Features that break, or that have to be retargeted, when this misses. */
  readonly features: readonly string[];
  /** What to look for on the page when this selector misses. */
  readonly lookFor: string;
  /** Saved fixture ids that must contain a match. Empty for live-only entries. */
  readonly fixtures: readonly string[];
  readonly source: 'code' | 'live';
  /** Required on a logged-in character sheet, without opening another panel. */
  readonly liveSheet: boolean;
  /** Present only while Underdark Mode is on. */
  readonly darkThemeOnly: boolean;
  /** A match must have this normalized text. */
  readonly matchText?: string;
  /** Each normalized text must appear on its own matching element. */
  readonly matchTexts?: readonly string[];
}

const FULLSCREEN_VIEWER = 'Fullscreen viewer';
const FULL_ART_STORAGE = 'Full-art storage';
const PORTRAIT_EDIT_PANEL = 'Portrait edit panel';
const PORTRAIT_CROP = 'Portrait crop';
const CARD_PORTRAITS = 'Character card portraits';
const CHARACTER_JOURNAL = 'Character journal';

interface SelectorDraft {
  id: string;
  selector: string;
  targets: string;
  features: readonly string[];
  lookFor: string;
  fixtures?: readonly string[];
  source?: 'code' | 'live';
  liveSheet?: boolean;
  darkThemeOnly?: boolean;
  matchText?: string;
  matchTexts?: readonly string[];
}

function selector(draft: SelectorDraft): DdbSelectorEntry {
  const entry: DdbSelectorEntry = {
    darkThemeOnly: draft.darkThemeOnly ?? false,
    features: draft.features,
    fixtures: draft.fixtures ?? [],
    id: draft.id,
    liveSheet: draft.liveSheet ?? false,
    lookFor: draft.lookFor,
    selector: draft.selector,
    source: draft.source ?? 'code',
    targets: draft.targets,
  };
  if (draft.matchText !== undefined) {
    return {...entry, matchText: draft.matchText};
  }
  if (draft.matchTexts !== undefined) {
    return {...entry, matchTexts: draft.matchTexts};
  }
  return entry;
}

// --- Fullscreen viewer: right-side portrait panel ---

const characterManagePane = selector({
  features: [FULLSCREEN_VIEWER],
  fixtures: ['manage-pane'],
  id: 'character-manage-pane',
  lookFor: 'The legacy right-side character manage pane. The stable hook is the data-testid, not a hashed styles_* class. Current sheets may omit this pane and use the information sidebar instead.',
  selector: '[data-testid="character-manage-pane"]',
  targets: 'Legacy right-side character manage pane that holds the panel portrait.',
});

const characterPortraitImage = selector({
  features: [FULLSCREEN_VIEWER],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'character-portrait-image',
  lookFor: 'An img whose class contains ddbc-character-avatar__portrait and whose alt text is "Character portrait". Current sheets often use a div with a background-image instead; that case is the portrait surface entry.',
  selector: 'img.ddbc-character-avatar__portrait[alt="Character portrait"]',
  targets: 'Legacy portrait image inside the manage pane or portrait manager.',
});

const characterPortraitSurface = selector({
  features: [FULLSCREEN_VIEWER],
  fixtures: ['manage-pane', 'information-sidebar', 'portrait-manager'],
  id: 'character-portrait-surface',
  lookFor: 'The portrait surface in the right-side panel. It may be an img or a div, and the image may be a CSS background. Ignore hashed styles_avatar__* classes.',
  selector: '.ddbc-character-avatar__portrait',
  targets: 'Any character portrait surface, image or background div.',
});

const informationSidebar = selector({
  features: [FULLSCREEN_VIEWER],
  fixtures: ['information-sidebar'],
  id: 'information-sidebar',
  lookFor: 'The right-side character panel exposed to accessibility as "Information Sidebar". This is not the action or notes slide-in shown in docs/ddb-reference.',
  selector: '[aria-label="Information Sidebar"]',
  targets: 'Current right-side information sidebar that holds the panel portrait.',
});

const sidebarPortal = selector({
  features: [FULLSCREEN_VIEWER],
  fixtures: ['manage-pane', 'information-sidebar'],
  id: 'sidebar-portal',
  lookFor: 'The sidebar portal root, class ct-sidebar__portal, that wraps the right-side panel when the sheet renders it.',
  selector: '.ct-sidebar__portal',
  targets: 'Sidebar portal root used to scope the portrait search.',
});

const sidebarInner = selector({
  features: [CHARACTER_JOURNAL, FULLSCREEN_VIEWER],
  fixtures: ['sidebar-shell'],
  id: 'sidebar-inner',
  lookFor: 'The open Information Sidebar column, class ct-sidebar__inner. It is inside the dialog the sheet labels Information Sidebar. The collapsed sidebar still has this node. Verified 2026-10-21 on character 4741434.',
  selector: '.ct-sidebar__inner',
  targets: 'Information Sidebar inner column.',
});

const sidebarHeading = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['sidebar-shell'],
  id: 'sidebar-heading',
  lookFor: 'The pane title, class ct-sidebar__heading, inside the open sidebar. A skill pane and a note pane both use it. Verified 2026-10-21.',
  selector: '.ct-sidebar__heading',
  targets: 'Information Sidebar pane title.',
});

const sidebarScroll = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['sidebar-shell'],
  id: 'sidebar-scroll',
  lookFor: 'The sidebar body scroller. The open pane marks it with data-scrollable-container="true" on the content node inside .ct-sidebar. It is absent while the sidebar is collapsed.',
  selector: '.ct-sidebar [data-scrollable-container="true"]',
  targets: 'Information Sidebar scroll container.',
});

const sidebarNote = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['sidebar-shell'],
  id: 'sidebar-note',
  lookFor: 'The notes pane body, class ct-note-manage-pane. The sheet mounts it only for a character note (Organizations and the other note keys). A skill pane does not have it.',
  selector: '.ct-note-manage-pane',
  targets: 'Character note pane inside the Information Sidebar.',
});

// --- Portrait manager: full-art storage, edit panel, crop ---

export const PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_CLASS =
  'ct-decoration-manager__upload-heading-rules';
export const PORTRAIT_MANAGER_UPLOAD_FILE_CLASS =
  'ct-decoration-manager__upload-file';
export const PORTRAIT_MANAGER_UPLOAD_FILE_INPUT_CLASS =
  'ct-decoration-manager__upload-file-input';

const portraitManager = selector({
  features: [FULL_ART_STORAGE, PORTRAIT_EDIT_PANEL, PORTRAIT_CROP],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager',
  lookFor: 'The portrait manager root, class ct-decoration-manager, in the sheet sidebar or the builder modal. The first-level "Current Decorations" view may not show it until portrait upload is open.',
  selector: '.ct-decoration-manager',
  targets: 'Portrait manager root in the sheet sidebar or the builder modal.',
});

const portraitManagerAvatar = selector({
  features: [PORTRAIT_EDIT_PANEL],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-avatar',
  lookFor: 'The img.ddbc-character-avatar__portrait inside the portrait manager, used as the fallback viewer image.',
  selector: 'img.ddbc-character-avatar__portrait',
  targets: 'Portrait image inside the portrait manager.',
});

const portraitManagerCustomContent = selector({
  features: [PORTRAIT_EDIT_PANEL],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-custom-content',
  lookFor: 'The current custom portrait block, class ct-decoration-manager__custom-content.',
  selector: '.ct-decoration-manager__custom-content',
  targets: 'Current custom portrait content inside the portrait manager.',
});

const portraitManagerCustomSection = selector({
  features: [PORTRAIT_EDIT_PANEL],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-custom-section',
  lookFor: 'The "Current Custom Portrait" section, class ct-decoration-manager__custom.',
  selector: '.ct-decoration-manager__custom',
  targets: 'Custom portrait section the edit panel moves into its top layout.',
});

const portraitManagerUploadForm = selector({
  features: [PORTRAIT_EDIT_PANEL, FULL_ART_STORAGE],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-upload-form',
  lookFor: 'The upload form, class ct-decoration-manager__upload-form, next to the upload heading.',
  selector: '.ct-decoration-manager__upload-form',
  targets: 'Portrait upload form inside the upload section.',
});

const portraitManagerUploadHeading = selector({
  features: [PORTRAIT_EDIT_PANEL],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-upload-heading',
  lookFor: 'The "Upload Portrait" heading block, class ct-decoration-manager__upload-heading.',
  selector: '.ct-decoration-manager__upload-heading',
  targets: 'Upload heading the edit panel moves into its intro column.',
});

const portraitManagerUploadHeadingRules = selector({
  features: [PORTRAIT_EDIT_PANEL],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-upload-heading-rules',
  lookFor: 'The size and file-size rules under the upload heading, class ct-decoration-manager__upload-heading-rules.',
  selector: `.${PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_CLASS}`,
  targets: 'Upload rules text the compact layout shortens.',
});

const portraitManagerUploadFile = selector({
  features: [PORTRAIT_EDIT_PANEL],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-upload-file',
  lookFor: 'The file-control wrapper, class ct-decoration-manager__upload-file. The edit panel only uses it to keep the control from overflowing.',
  selector: `.${PORTRAIT_MANAGER_UPLOAD_FILE_CLASS}`,
  targets: 'Wrapper around the native portrait file control.',
});

const portraitManagerUploadInput = selector({
  features: [FULL_ART_STORAGE, PORTRAIT_EDIT_PANEL, PORTRAIT_CROP],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-upload-input',
  lookFor: 'The file picker in the portrait upload form, sheet sidebar or builder. D&D Beyond usually renamed the class. Find the input with type="file".',
  selector: `.${PORTRAIT_MANAGER_UPLOAD_FILE_INPUT_CLASS}[type="file"]`,
  targets: 'Native file input inside the portrait manager upload form.',
});

const portraitManagerUpload = selector({
  features: [FULL_ART_STORAGE, PORTRAIT_EDIT_PANEL, PORTRAIT_CROP],
  fixtures: ['manage-pane', 'portrait-manager'],
  id: 'portrait-manager-upload',
  lookFor: 'The upload section, class ct-decoration-manager__upload, that contains the file input and the Change Portrait button.',
  selector: '.ct-decoration-manager__upload',
  targets: 'Portrait upload section inside the portrait manager.',
});

export const CHANGE_PORTRAIT_BUTTON_TEXT = 'Change Portrait';

const changePortraitButton = selector({
  features: [FULL_ART_STORAGE, PORTRAIT_CROP],
  fixtures: ['portrait-manager'],
  id: 'change-portrait-button',
  lookFor: 'The native button labeled "Change Portrait" in the portrait upload section. Full art is saved only after this button is used. A renamed label is the usual break.',
  matchText: CHANGE_PORTRAIT_BUTTON_TEXT,
  selector: 'button',
  targets: 'Native Change Portrait confirmation button.',
});

// --- Character card portraits ---

/** Avatar image path on www.dndbeyond.com. Card upgrades build paths from this. */
export const DND_BEYOND_AVATAR_PATH_PREFIX = '/avatars/';

const campaignCharacterCard = selector({
  features: [CARD_PORTRAITS],
  fixtures: ['campaign-card', 'campaign-thumbnail-card'],
  id: 'campaign-character-card',
  lookFor: 'The upper header of a campaign character card, class ddb-campaigns-character-card-header-upper.',
  selector: '.ddb-campaigns-character-card-header-upper',
  targets: 'Campaign character card header.',
});

const campaignCharacterCardLink = selector({
  features: [CARD_PORTRAITS],
  fixtures: ['campaign-card', 'campaign-thumbnail-card'],
  id: 'campaign-character-card-link',
  lookFor: 'The card details link, class ddb-campaigns-character-card-header-upper-details-link, whose href starts with /characters/. Owned cards that only have footer links use the character-list entries instead.',
  selector: 'a.ddb-campaigns-character-card-header-upper-details-link[href^="/characters/"]',
  targets: 'Campaign card link that carries the character id.',
});

const campaignCharacterCardPortrait = selector({
  features: [CARD_PORTRAITS],
  fixtures: ['campaign-card', 'campaign-thumbnail-card'],
  id: 'campaign-character-card-portrait',
  lookFor: 'The avatar inside the card portrait, classes image and user-selected-avatar, under ddb-campaigns-character-card-header-upper-portrait.',
  selector: '.ddb-campaigns-character-card-header-upper-portrait .image.user-selected-avatar',
  targets: 'Campaign card portrait background.',
});

const characterListCardLink = selector({
  features: [CARD_PORTRAITS],
  fixtures: ['my-characters-card', 'owned-campaign-card'],
  id: 'character-list-card-link',
  lookFor: 'Any link whose href contains /characters/ on the My Characters page or on an owned campaign card footer.',
  selector: 'a[href*="/characters/"]',
  targets: 'Character link on a collection card or an owned campaign card.',
});

const characterListCardPortrait = selector({
  features: [CARD_PORTRAITS],
  fixtures: ['my-characters-card', 'owned-campaign-card'],
  id: 'character-list-card-portrait',
  lookFor: 'An element with classes image and user-selected-avatar, or any element whose inline style contains /avatars/. The upgrade only runs when that element has a background image.',
  selector: '.image.user-selected-avatar, [style*="/avatars/"]',
  targets: 'Avatar background on a My Characters card or an owned campaign card.',
});

// --- Character journal: sheet tab row ---
//
// On a wide desktop sheet the tab row sits at the top of the right-hand
// content box, not along the bottom of the page. See docs/ddb-reference.

export const SHEET_TAB_CONTROL_SELECTOR = [
  'a',
  'button',
  'label',
  '[role="tab"]',
  '[role="button"]',
  '[role="radio"]',
  'input[type="radio"]',
].join(',');

export const SHEET_TAB_TEXT_SELECTOR = [
  'a',
  'button',
  'div',
  'label',
  'span',
  '[role]',
].join(',');

export const SHEET_TAB_LIST_SELECTOR = [
  '[role="tablist"]',
  '[role="list"]',
  'ul',
  'ol',
  'nav',
  'menu',
].join(',');

export const SHEET_TAB_LABELS = [
  'actions',
  'spells',
  'inventory',
  'features & traits',
  'background',
  'notes',
  'extras',
] as const;

const sheetTabExtrasControl = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['sheet-tabs'],
  id: 'sheet-tab-extras-control',
  lookFor: 'The Extras control in the sheet tab row. On a wide desktop sheet that row is the top of the right-hand content box. The journal inserts its tab after this control.',
  matchText: 'extras',
  selector: SHEET_TAB_CONTROL_SELECTOR,
  targets: 'Interactive Extras tab control.',
});

const sheetTabLabels = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['current-sheet-tabs'],
  id: 'sheet-tab-labels',
  liveSheet: true,
  lookFor: 'The sheet tab labels Actions, Spells, Inventory, Features & Traits, Background, Notes, and Extras. On a wide desktop sheet they sit at the top of the right-hand content box, not along the bottom. Each label needs to be the text of its own element.',
  matchTexts: SHEET_TAB_LABELS,
  selector: SHEET_TAB_TEXT_SELECTOR,
  targets: 'Sheet tab labels the journal uses to recognize the tab row.',
});

const sheetTabList = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['sheet-tabs'],
  id: 'sheet-tab-list',
  lookFor: 'The tab-row ancestor: a tablist, list, ul, ol, nav, or menu that contains Extras. The current live row is not always one of those roles; the label fallback covers that case.',
  selector: SHEET_TAB_LIST_SELECTOR,
  targets: 'Semantic tab-list ancestor around the sheet tabs.',
});

// --- Character journal: sheet root, tab classes, and theme ---
//
// The journal queries these. Classes that are on the live-shaped fixture are
// source: code. ct-primary-box and ct-theme-dark stay live checks: no saved
// HTML showed them, and the reference says not to invent inner BEM names.
// The note panel mirrors the open Information Sidebar. Class strings from
// that shell, including hashed styles_* names verified 2026-10-21, live in
// the constants below. The portrait search skips .bfa-journal-panel so this
// copy does not take the portrait portal. See docs/ddb-reference/sidebar.md.

// Information Sidebar shell, verified 2026-10-21 on character 4741434.
// Bundle main.73ca5823.js, stylesheet main.875602ca.css. Hashes change when
// that bundle changes. docs/ddb-reference/sidebar.json is the snapshot.
export const SIDEBAR_PORTAL_CLASS = 'ct-sidebar__portal';
export const SIDEBAR_CLASS = 'ct-sidebar';
export const SIDEBAR_INNER_CLASS = 'ct-sidebar__inner';
export const SIDEBAR_HEADER_CLASS = 'ct-sidebar__header';
export const SIDEBAR_HEADER_PRIMARY_CLASS = 'ct-sidebar__header-primary';
export const SIDEBAR_HEADING_CLASS = 'ct-sidebar__heading';
export const SIDEBAR_DARK_MODE_CLASS = 'ct-sidebar--is-dark-mode';
export const SIDEBAR_NOTE_PANE_CLASS = 'ct-note-manage-pane';
export const SIDEBAR_TOOLTIP_CLASS = 'ddbc-tooltip ddbc-tooltip--dark-mode';
export const SIDEBAR_SWIPEABLE_CLASS = 'swipeable';
export const SIDEBAR_MASK_CLASS = 'styles_mask__nuvIu styles_visible__6s+G-';
export const SIDEBAR_FRAME_CLASS =
  'styles_sidebar__RrEHr styles_right__e4y1G styles_visible__6s+G-';
export const SIDEBAR_CONTROLS_CLASS = 'styles_controls__NSnn3';
export const SIDEBAR_VISIBILITY_CLASS = 'styles_visibility__MJ05x';
export const SIDEBAR_HIDE_CLASS = 'styles_arrows__182cG';
export const SIDEBAR_PANE_CLASS = 'styles_pane__AOt0h';
export const SIDEBAR_BORDER_CLASS = 'styles_border__jHreB';
export const SIDEBAR_BORDER_BOTTOM_CLASS = 'styles_bottom__De0fd';
export const SIDEBAR_BORDER_BG_CLASS = 'styles_borderBg__hTiiJ';
export const SIDEBAR_BORDER_STROKE_CLASS = 'styles_borderStroke__YCw40';
export const SIDEBAR_BORDER_FILL_CLASS = 'styles_borderFill__xRxpl';
export const SIDEBAR_GAP_CLASS = 'styles_gap__kuwYv';
export const SIDEBAR_CONTENT_CLASS = 'styles_content__3knKz';
export const SIDEBAR_WRAPPER_CLASS = 'styles_wrapper__6NpOy';
export const SIDEBAR_HEADING_HASH_CLASS = 'styles_heading__j5Lvn';
export const SIDEBAR_CALLOUT_CLASS = 'styles_callout__Sf-W2';
export const SIDEBAR_SURFACE_DARK_CLASS = 'styles_dark__6-qrS';
export const SIDEBAR_NAV_CLASS = 'styles_controls__-K4FO';
export const SIDEBAR_NAV_BUTTON_CLASS = 'styles_button__pEmHw';
export const SIDEBAR_NAV_LABEL_CLASS = 'styles_label__qP9gK';
export const SIDEBAR_TEXTAREA_CLASS = 'styles_textarea__7oQCq';

export const CHARACTER_SHEET_CLASS = 'ct-character-sheet';
export const CHARACTER_SHEET_SHELL_CLASS = 'ct-character-sheet-shell';
export const CHARACTER_SHEET_SELECTOR =
  `.${CHARACTER_SHEET_CLASS}, .${CHARACTER_SHEET_SHELL_CLASS}`;
export const SHEET_TAB_NAV_ITEM_SELECTOR = '.ddbc-tab-list__nav-item';
export const SHEET_TAB_NAV_ITEM_ACTIVE_SELECTOR =
  '.ddbc-tab-list__nav-item--is-active';
export const SHEET_TAB_CONTENT_SELECTOR = '.ddbc-tab-list__content';
// Extras / Inventory / Spells filter row, observed 2026-10-21 on the public
// sheet character 4741434 (character-app main.73ca5823.js). The row is
// search box, funnel, then the Manage button. Inactive tabs unmount it, so
// the journal also rebuilds this markup from these strings. The site header
// search is a different input and is not this row.
export const SHEET_SECTION_FILTER_SELECTOR = [
  '.ct-extras-filter__interactions',
  '.ct-inventory-filter__interactions',
  '.ct-spells-filter__interactions',
].join(', ');
export const SHEET_SECTION_FILTER_BUTTON_SELECTOR = [
  '.ct-extras-filter__advanced',
  '.ct-inventory-filter__advanced',
  '.ct-spells-filter__advanced',
].join(', ');
export const SHEET_SECTION_FILTER_ROW_CLASS = 'ct-extras-filter__interactions';
export const SHEET_SECTION_FILTER_BOX_CLASS = 'ct-extras-filter__box';
export const SHEET_SECTION_FILTER_PRIMARY_CLASS = 'ct-extras-filter__primary';
export const SHEET_SECTION_FILTER_ICON_GROUP_CLASS =
  'ct-extras-filter__primary-group ct-extras-filter__primary-group--first';
export const SHEET_SECTION_FILTER_ICON_CLASS = 'ct-extras-filter__icon';
export const SHEET_SECTION_FILTER_FIELD_CLASS = 'ct-extras-filter__field';
export const SHEET_SECTION_FILTER_INPUT_CLASS = 'ct-extras-filter__input';
export const SHEET_SECTION_FILTER_BUTTON_CLASS = 'ct-extras-filter__advanced';
export const SHEET_SECTION_FILTER_CALLOUT_CLASS = 'ct-extras-filter__callout';
export const SHEET_MANAGE_BUTTON_SELECTOR = 'button.ct-theme-button';
export const SHEET_MANAGE_BUTTON_CLASS = [
  'ct-theme-button',
  'ct-theme-button--outline',
  'ct-theme-button--interactive',
  'ct-button',
  'character-button',
  'character-button-medium',
  'character-button-outline',
  'ddbc-button',
].join(' ');
export const SHEET_MANAGE_BUTTON_CONTENT_CLASS = 'ct-button__content';
export const SHEET_FILTER_SVG_MARKUP = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 31.43435" class="ddbc-svg ddbc-filter-svg" aria-hidden="true">',
  '<path fill="currentColor" d="M10,18,.38675,3.58013A2.30282,2.30282,0,0,1,0,2.30278H0A2.30278,2.30278,0,0,1,2.30277,0H26.69723A2.30278,2.30278,0,0,1,29,2.30277h0a2.30282,2.30282,0,0,1-.38675,1.27735L19,18V30.78071a.65255.65255,0,0,1-1.01451.543L10.44556,26.297A1.00058,1.00058,0,0,1,10,25.46451Z"></path>',
  '</svg>',
].join('');
export const PRIMARY_BOX_SELECTOR = '.ct-primary-box';
export const THEME_DARK_CLASS = 'ct-theme-dark';
export const THEME_DARK_SELECTOR = `.${THEME_DARK_CLASS}`;
export const CHARACTER_SHEET_DARK_MODE_CLASS = 'ct-character-sheet--dark-mode';
export const CHARACTER_SHEET_DARK_MODE_SELECTOR =
  `.${CHARACTER_SHEET_DARK_MODE_CLASS}`;
export const NATIVE_BUTTON_CLASS_PATTERN =
  /ddbc-button|ct-button|Button_button|ButtonVariants_/;

const characterSheet = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['sheet-tabs', 'current-sheet-tabs', 'live-sheet-tabs'],
  id: 'character-sheet',
  liveSheet: true,
  lookFor: 'The sheet root, class ct-character-sheet, or the shell ct-character-sheet-shell. The journal watches this node for tab changes and samples its theme color from the frames inside it.',
  selector: CHARACTER_SHEET_SELECTOR,
  targets: 'Character sheet root the journal observes.',
});

const sheetTabNavItem = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'sheet-tab-nav-item',
  liveSheet: true,
  lookFor: 'A tab item in the row at the top of the right-hand content box (Actions through Extras) or in the secondary row under it (All, Attack, and the rest). This entry looks for ddbc-tab-list__nav-item. The journal still finds Extras by its label, so update this entry when the class changes and retarget the adapter only if the label match also fails.',
  selector: SHEET_TAB_NAV_ITEM_SELECTOR,
  targets: 'One item in a sheet tab list.',
});

const sheetTabNavItemActive = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'sheet-tab-nav-item-active',
  liveSheet: true,
  lookFor: 'The selected tab. This entry looks for ddbc-tab-list__nav-item--is-active on the tab item. On Matilda\'s screenshots the selected main tab is Actions, Notes, or Extras depending on the capture. Its underline is the character theme color.',
  selector: SHEET_TAB_NAV_ITEM_ACTIVE_SELECTOR,
  targets: 'The active sheet tab item.',
});

const sheetSectionFilter = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'sheet-section-filter',
  lookFor: 'The Extras, Inventory, or Spells toolbar row: a search box with a magnifier, then the funnel. On the classic sheet the row is ct-extras-filter__interactions (Inventory and Spells use the same pieces with their own prefix). It is mounted only while that tab is open. The site header search is not this row.',
  selector: SHEET_SECTION_FILTER_SELECTOR,
  targets: 'Section search and filter row.',
});

const sheetSectionFilterButton = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'sheet-section-filter-button',
  lookFor: 'The funnel control beside the section search. Extras uses ct-extras-filter__advanced and an svg.ddbc-filter-svg. It is not a text button.',
  selector: SHEET_SECTION_FILTER_BUTTON_SELECTOR,
  targets: 'Section filter funnel.',
});

const sheetManageButton = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'sheet-manage-button',
  lookFor: 'The outline Manage button at the end of a section toolbar, class ct-theme-button. Extras labels it Manage Extras. A read-only public sheet omits it; an owned sheet renders it.',
  selector: SHEET_MANAGE_BUTTON_SELECTOR,
  targets: 'Section Manage button.',
});

const sheetTabContent = selector({
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'sheet-tab-content',
  lookFor: 'The content region under the tab row, class ddbc-tab-list__content, on the live-shaped fixture. The journal list mounts on the tab row\'s next sibling, which is this region in that fixture. No page HTML was saved, so the live check does not require this class until it is confirmed on Matilda\'s sheet.',
  selector: SHEET_TAB_CONTENT_SELECTOR,
  targets: 'Sheet tab content region on the live-shaped fixture.',
});

const primaryBox = selector({
  features: [FULLSCREEN_VIEWER, CHARACTER_JOURNAL],
  id: 'primary-box',
  liveSheet: true,
  lookFor: 'A boxed sheet section: ability scores, saving throws, skills, or the right-hand tabbed panel. This entry looks for ct-primary-box. The class is not readable from the screenshots and was not in saved HTML. The live selector-health check is what verifies it. Do not invent inner BEM pieces.',
  selector: PRIMARY_BOX_SELECTOR,
  source: 'live',
  targets: 'A primary boxed section on the character sheet.',
});

const themeDark = selector({
  darkThemeOnly: true,
  features: [PORTRAIT_EDIT_PANEL],
  id: 'theme-dark',
  lookFor: 'A dark-theme marker while Underdark Mode is on. This entry looks for ct-theme-dark anywhere in the document. The class is not verified until the live selector-health check passes with BFA_LIVE_SHEET_THEME=dark. The portrait edit panel does not read this class; it samples the computed background color.',
  selector: THEME_DARK_SELECTOR,
  source: 'live',
  targets: 'Dark-theme marker present while Underdark Mode is on.',
});

const characterSheetDarkMode = selector({
  darkThemeOnly: true,
  features: [CHARACTER_JOURNAL],
  fixtures: ['live-sheet-tabs'],
  id: 'character-sheet-dark-mode',
  lookFor: 'The sheet root while Underdark Mode is on: ct-character-sheet--dark-mode. The journal treats a class ending in dark-mode as dark, then data-theme, then the background luminance. The live-shaped fixture includes this class. The live selector-health check still confirms it on Matilda\'s sheet.',
  selector: CHARACTER_SHEET_DARK_MODE_SELECTOR,
  targets: 'Dark-mode class on the character sheet.',
});

export const DDB_SELECTORS: readonly DdbSelectorEntry[] = [
  characterManagePane,
  characterPortraitImage,
  characterPortraitSurface,
  informationSidebar,
  sidebarPortal,
  sidebarInner,
  sidebarHeading,
  sidebarScroll,
  sidebarNote,
  portraitManager,
  portraitManagerAvatar,
  portraitManagerCustomContent,
  portraitManagerCustomSection,
  portraitManagerUploadForm,
  portraitManagerUploadHeading,
  portraitManagerUploadHeadingRules,
  portraitManagerUploadFile,
  portraitManagerUploadInput,
  portraitManagerUpload,
  changePortraitButton,
  campaignCharacterCard,
  campaignCharacterCardLink,
  campaignCharacterCardPortrait,
  characterListCardLink,
  characterListCardPortrait,
  sheetTabExtrasControl,
  sheetTabLabels,
  sheetTabList,
  characterSheet,
  sheetTabNavItem,
  sheetTabNavItemActive,
  sheetSectionFilter,
  sheetSectionFilterButton,
  sheetManageButton,
  sheetTabContent,
  primaryBox,
  themeDark,
  characterSheetDarkMode,
];

export const CHARACTER_MANAGE_PANE_SELECTOR = characterManagePane.selector;
export const CHARACTER_PORTRAIT_SELECTOR = characterPortraitImage.selector;
export const CHARACTER_PORTRAIT_SURFACE_SELECTOR = characterPortraitSurface.selector;
export const INFORMATION_SIDEBAR_SELECTOR = informationSidebar.selector;
export const SIDEBAR_PORTAL_SELECTOR = sidebarPortal.selector;
export const PORTRAIT_MANAGER_SELECTOR = portraitManager.selector;
export const PORTRAIT_MANAGER_AVATAR_IMAGE_SELECTOR = portraitManagerAvatar.selector;
export const PORTRAIT_MANAGER_CUSTOM_CONTENT_SELECTOR =
  portraitManagerCustomContent.selector;
export const PORTRAIT_MANAGER_CUSTOM_SECTION_SELECTOR =
  portraitManagerCustomSection.selector;
export const PORTRAIT_MANAGER_UPLOAD_FORM_SELECTOR =
  portraitManagerUploadForm.selector;
export const PORTRAIT_MANAGER_UPLOAD_HEADING_SELECTOR =
  portraitManagerUploadHeading.selector;
export const PORTRAIT_MANAGER_UPLOAD_HEADING_RULES_SELECTOR =
  portraitManagerUploadHeadingRules.selector;
export const PORTRAIT_MANAGER_UPLOAD_FILE_SELECTOR =
  portraitManagerUploadFile.selector;
export const PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR =
  portraitManagerUploadInput.selector;
export const PORTRAIT_MANAGER_UPLOAD_SELECTOR = portraitManagerUpload.selector;
export const CAMPAIGN_CHARACTER_CARD_SELECTOR = campaignCharacterCard.selector;
export const CAMPAIGN_CHARACTER_CARD_LINK_SELECTOR =
  campaignCharacterCardLink.selector;
export const CAMPAIGN_CHARACTER_CARD_PORTRAIT_SELECTOR =
  campaignCharacterCardPortrait.selector;
export const CHARACTER_LIST_CARD_LINK_SELECTOR = characterListCardLink.selector;
export const CHARACTER_LIST_CARD_PORTRAIT_SELECTOR =
  characterListCardPortrait.selector;

// --- Extension-owned markers ---
//
// These are not D&D Beyond selectors. Callers already import them from this
// module. The health check ignores them.

export const CHARACTER_ART_CONTROLS_ATTRIBUTE_NAME = 'data-bfa-art-controls';
export const CHARACTER_ART_STYLES_ATTRIBUTE_NAME = 'data-bfa-art-styles';
export const ENHANCED_ATTRIBUTE_NAME = 'data-bfa-enhanced';
export const PANEL_PORTRAIT_TRIGGER_CLASS_NAME = 'bfa-panel-portrait-trigger';
export const CROP_DIALOG_STYLE_ATTRIBUTE_NAME = 'data-bfa-crop-dialog-styles';
export const VIEWER_STYLE_ATTRIBUTE_NAME = 'data-bfa-viewer-styles';
export const CHARACTER_JOURNAL_STYLE_ATTRIBUTE_NAME =
  'data-bfa-character-journal-styles';
export const CARD_PORTRAIT_UPGRADE_STYLE_ATTRIBUTE_NAME =
  'data-bfa-card-portrait-upgrade-styles';
export const CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME =
  'data-bfa-character-journal-tab';
export const CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME =
  'data-bfa-character-journal-tab-item';
export const CHARACTER_SHEET_JOURNAL_TAB_ROW_ATTRIBUTE_NAME =
  'data-bfa-character-journal-tab-row';
export const CHARACTER_SHEET_JOURNAL_TAB_CLASS_NAME =
  'bfa-character-journal-tab';
