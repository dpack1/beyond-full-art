// Sidebar chrome from character-app main.b9f1c122.js, read 2026-11-05.
// Hide collapses the pane. Lock keeps it up. Overlay dismisses on an outside
// click or Escape. Fixed stays up and shifts the sheet. Left and Right dock it.
// Below 1600px the sheet forces overlay. The shift starts at 1024px.
// The sheet measures the centered column, not the full-width page. The note
// uses its own open width in that same gutter math so a 400px panel still
// sits beside the column.

export type SidebarAlignment = 'left' | 'right';
export type SidebarPlacement = 'fixed' | 'overlay';

export interface SidebarChrome {
  alignment: SidebarAlignment;
  locked: boolean;
  placement: SidebarPlacement;
  visible: boolean;
}

export const DEFAULT_SIDEBAR_CHROME: SidebarChrome = {
  alignment: 'right',
  locked: false,
  placement: 'overlay',
  visible: true,
};

export const NATIVE_SIDEBAR_WIDTH_PX = 340;
export const JOURNAL_SIDEBAR_MAX_PX = 400;
const JOURNAL_SIDEBAR_VIEWPORT_GUTTER_PX = 36;
const FIXED_SHIFT_MIN_WIDTH_PX = 1024;
const OVERLAY_MIN_WIDTH_PX = 1600;

export function journalOpenWidthPx(viewportWidth: number): number {
  return Math.min(
      JOURNAL_SIDEBAR_MAX_PX,
      Math.max(0, viewportWidth - JOURNAL_SIDEBAR_VIEWPORT_GUTTER_PX),
  );
}

export function effectiveSidebarChrome(
    chrome: SidebarChrome,
    viewportWidth: number,
): SidebarChrome {
  if (viewportWidth < OVERLAY_MIN_WIDTH_PX && chrome.placement === 'fixed') {
    return {...chrome, placement: 'overlay'};
  }
  return chrome;
}

export function toggleSidebarVisibility(chrome: SidebarChrome): SidebarChrome {
  if (chrome.locked) {
    return chrome;
  }
  return {...chrome, visible: !chrome.visible};
}

export function toggleSidebarLock(chrome: SidebarChrome): SidebarChrome {
  return {...chrome, locked: !chrome.locked};
}

export function sidebarDismissesOnOutside(chrome: SidebarChrome): boolean {
  return chrome.visible && !chrome.locked && chrome.placement !== 'fixed';
}

export function sheetShiftPx(chrome: SidebarChrome, viewportWidth: number): number {
  if (viewportWidth < FIXED_SHIFT_MIN_WIDTH_PX || !chrome.visible || chrome.placement !== 'fixed') {
    return 0;
  }
  const offset = NATIVE_SIDEBAR_WIDTH_PX / 2;
  return chrome.alignment === 'left' ? offset : -offset;
}

export function sidebarEdge(input: {
  chrome: SidebarChrome;
  panelWidth: number;
  sheetWidth: number | null;
  viewportWidth: number;
}): {left: string; right: string} {
  const {chrome} = input;
  if (!chrome.visible) {
    return chrome.alignment === 'left'
      ? {left: '0px', right: 'auto'}
      : {left: 'auto', right: '0px'};
  }

  if (input.sheetWidth === null) {
    return pinned(chrome.alignment);
  }

  const gutter = (input.viewportWidth - input.sheetWidth) / 2;
  const width = input.panelWidth;
  let edge = 0;
  if (chrome.placement === 'fixed') {
    edge = gutter + NATIVE_SIDEBAR_WIDTH_PX / 2 - 15 - width;
  } else {
    const room = gutter - 15;
    edge = room - width + (width > room ? width - room : 0);
  }
  const px = `${Math.max(0, Math.round(edge))}px`;
  return chrome.alignment === 'left'
    ? {left: px, right: 'auto'}
    : {left: 'auto', right: px};
}

function pinned(alignment: SidebarAlignment): {left: string; right: string} {
  return alignment === 'left'
    ? {left: '0px', right: 'auto'}
    : {left: 'auto', right: '0px'};
}
