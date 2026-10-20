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
// The action and notes slide-in has no captured class. Do not reuse
// ct-sidebar for it. That portal is the portrait sidebar.

export const CHARACTER_SHEET_CLASS = 'ct-character-sheet';
export const CHARACTER_SHEET_SHELL_CLASS = 'ct-character-sheet-shell';
export const CHARACTER_SHEET_SELECTOR =
  `.${CHARACTER_SHEET_CLASS}, .${CHARACTER_SHEET_SHELL_CLASS}`;
export const SHEET_TAB_NAV_ITEM_SELECTOR = '.ddbc-tab-list__nav-item';
export const SHEET_TAB_NAV_ITEM_ACTIVE_SELECTOR =
  '.ddbc-tab-list__nav-item--is-active';
export const SHEET_TAB_CONTENT_SELECTOR = '.ddbc-tab-list__content';
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
export const CHARACTER_SHEET_JOURNAL_TAB_CLASS_NAME =
  'bfa-character-journal-tab';
