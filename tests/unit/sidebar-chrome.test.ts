import {describe, expect, it} from 'vitest';

import {
  DEFAULT_SIDEBAR_CHROME,
  effectiveSidebarChrome,
  sheetShiftPx,
  sidebarDismissesOnOutside,
  sidebarEdge,
  toggleSidebarLock,
  toggleSidebarVisibility,
  type SidebarChrome,
} from '../../src/platform/dndbeyond/sidebar-chrome';

describe('sidebar chrome', () => {
  it('starts unlocked, overlaid, visible, and on the right', () => {
    expect(DEFAULT_SIDEBAR_CHROME).toEqual({
      alignment: 'right',
      locked: false,
      placement: 'overlay',
      visible: true,
    });
    expect(sidebarDismissesOnOutside(DEFAULT_SIDEBAR_CHROME)).toBe(true);
  });

  it('hides only while unlocked, and lock blocks an outside dismiss', () => {
    const hidden = toggleSidebarVisibility(DEFAULT_SIDEBAR_CHROME);
    expect(hidden.visible).toBe(false);
    expect(sidebarDismissesOnOutside(hidden)).toBe(false);

    const locked = toggleSidebarLock(DEFAULT_SIDEBAR_CHROME);
    expect(locked.locked).toBe(true);
    expect(toggleSidebarVisibility(locked)).toBe(locked);
    expect(sidebarDismissesOnOutside(locked)).toBe(false);
  });

  it('keeps a fixed sidebar up and shifts the sheet by half of 340px', () => {
    const fixed: SidebarChrome = {...DEFAULT_SIDEBAR_CHROME, placement: 'fixed'};
    expect(sidebarDismissesOnOutside(fixed)).toBe(false);
    expect(sheetShiftPx(fixed, 1800)).toBe(-170);
    expect(sheetShiftPx({...fixed, alignment: 'left'}, 1800)).toBe(170);
    expect(sheetShiftPx(fixed, 1023)).toBe(0);
    expect(sheetShiftPx({...fixed, visible: false}, 1800)).toBe(0);
    expect(sheetShiftPx(DEFAULT_SIDEBAR_CHROME, 1800)).toBe(0);
  });

  it('forces overlay below 1600px', () => {
    const fixed: SidebarChrome = {...DEFAULT_SIDEBAR_CHROME, placement: 'fixed'};
    expect(effectiveSidebarChrome(fixed, 1599).placement).toBe('overlay');
    expect(effectiveSidebarChrome(fixed, 1600).placement).toBe('fixed');
  });

  it('pins overlay to the window edge unless the gutter can hold the panel', () => {
    expect(sidebarEdge({
      chrome: DEFAULT_SIDEBAR_CHROME,
      panelWidth: 400,
      sheetWidth: null,
      viewportWidth: 1440,
    })).toEqual({left: 'auto', right: '0px'});

    expect(sidebarEdge({
      chrome: DEFAULT_SIDEBAR_CHROME,
      panelWidth: 400,
      sheetWidth: 1200,
      viewportWidth: 1440,
    })).toEqual({left: 'auto', right: '0px'});

    expect(sidebarEdge({
      chrome: DEFAULT_SIDEBAR_CHROME,
      panelWidth: 400,
      sheetWidth: 1200,
      viewportWidth: 2000,
    })).toEqual({left: 'auto', right: '0px'});

    expect(sidebarEdge({
      chrome: DEFAULT_SIDEBAR_CHROME,
      panelWidth: 400,
      sheetWidth: 1200,
      viewportWidth: 2400,
    })).toEqual({left: 'auto', right: '185px'});

    expect(sidebarEdge({
      chrome: {...DEFAULT_SIDEBAR_CHROME, alignment: 'left', visible: false},
      panelWidth: 400,
      sheetWidth: 1200,
      viewportWidth: 2400,
    })).toEqual({left: '0px', right: 'auto'});
  });

  it('places a fixed sidebar in the gutter', () => {
    const fixed: SidebarChrome = {...DEFAULT_SIDEBAR_CHROME, placement: 'fixed'};
    expect(sidebarEdge({
      chrome: fixed,
      panelWidth: 400,
      sheetWidth: 1200,
      viewportWidth: 2000,
    })).toEqual({left: 'auto', right: '155px'});

    expect(sidebarEdge({
      chrome: {...fixed, alignment: 'left'},
      panelWidth: 400,
      sheetWidth: 1200,
      viewportWidth: 2000,
    })).toEqual({left: '155px', right: 'auto'});
  });
});
