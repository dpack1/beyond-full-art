import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  findPanelPortrait,
  observePanelPortraits,
} from '../../src/platform/dndbeyond/portrait-adapter';
import {
  CHARACTER_MANAGE_PANE_FIXTURE,
  CURRENT_INFORMATION_SIDEBAR_FIXTURE,
} from '../fixtures/character-manage-pane';

describe('portrait adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds the manage-pane portrait', () => {
    document.body.innerHTML = CHARACTER_MANAGE_PANE_FIXTURE;

    const target = findPanelPortrait(document);

    expect(target).not.toBeNull();
    expect(target?.image.getAttribute('alt')).toBe('Character portrait');
    expect(target?.clickSurface).toBe(target?.image);
  });

  it('ignores the journal copy of the sidebar portal', () => {
    document.body.innerHTML = `
      <div class="bfa-journal-panel ct-sidebar__portal">
        <div role="dialog" aria-label="Information Sidebar"></div>
      </div>
      ${CURRENT_INFORMATION_SIDEBAR_FIXTURE}
    `;

    const target = findPanelPortrait(document);

    expect(target).not.toBeNull();
    expect(target?.panel.closest('.bfa-journal-panel')).toBeNull();
    expect(target?.panel.getAttribute('aria-label')).toBe('Information Sidebar');
  });

  it('finds the current information-sidebar background portrait', () => {
    document.body.innerHTML = CURRENT_INFORMATION_SIDEBAR_FIXTURE;

    const target = findPanelPortrait(document);

    expect(target).not.toBeNull();
    expect(target?.image.classList.contains('styles_avatar__t7tEz')).toBe(true);
    expect(target?.panel.getAttribute('aria-label')).toBe('Information Sidebar');
  });

  it('observes lazily rendered sidebars', async () => {
    let callbackCount = 0;
    const stopObserving = observePanelPortraits(() => {
      callbackCount += 1;
    });

    document.body.innerHTML = CHARACTER_MANAGE_PANE_FIXTURE;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callbackCount).toBe(1);

    stopObserving();
  });
});
