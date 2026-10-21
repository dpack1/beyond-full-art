import {describe, expect, it} from 'vitest';

import {
  controlsSitOnPanel,
  journalSidebarBox,
} from '../../src/platform/dndbeyond/sidebar-parity';

describe('journal sidebar placement', () => {
  it('pins the open note to the right of the viewport', () => {
    expect(journalSidebarBox({topPx: 124.4, viewportHeight: 1100})).toEqual({
      height: '976px',
      left: 'auto',
      position: 'fixed',
      right: '0px',
      top: '124px',
      width: '340px',
      zIndex: '10001',
    });
  });

  it('keeps a short viewport from collapsing the note', () => {
    expect(journalSidebarBox({topPx: 900, viewportHeight: 1000}).height).toBe('240px');
  });

  it('accepts edge controls that sit inside the panel and above the pane', () => {
    expect(controlsSitOnPanel({
      controls: {bottom: 160, left: 1120, right: 1420, top: 132},
      paneTop: 168,
      panel: {bottom: 1100, left: 1100, right: 1440, top: 124},
    })).toEqual([]);
  });

  it('rejects controls that leave the panel', () => {
    const drift = controlsSitOnPanel({
      controls: {bottom: 500, left: 20, right: 180, top: 8},
      paneTop: 400,
      panel: {bottom: 1100, left: 1100, right: 1440, top: 124},
    });
    expect(drift.map((entry) => entry.property)).toEqual([
      'controls-top',
      'controls-x',
      'controls-above-pane',
      'controls-height',
      'pane-top',
    ]);
  });
});
