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
    expect(target?.image.closest('.ct-decorate-pane__current-selections')).toBeNull();
    expect(target?.panel.getAttribute('aria-label')).toBe('Information Sidebar');
  });

  it('keeps the summary portrait when Current Decorations also shows one', () => {
    document.body.innerHTML = `
      <div class="ct-sidebar__portal">
        <aside aria-label="Information Sidebar">
          <div class="ct-decorate-pane__current-selections">
            <img
              class="ddbc-character-avatar__portrait ct-decorate-pane__portrait"
              alt="Character portrait"
              src="https://www.dndbeyond.com/avatars/decorations.jpeg">
          </div>
          <div
            class="ddbc-character-avatar__portrait styles_avatar__t7tEz"
            style="width: 80px; height: 80px;">
          </div>
        </aside>
      </div>
    `;
    const decorationsPortrait = document.querySelector<HTMLImageElement>(
        '.ct-decorate-pane__portrait',
    );
    expect(decorationsPortrait).not.toBeNull();
    Object.defineProperty(decorationsPortrait!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 400,
        height: 400,
        left: 0,
        right: 400,
        top: 0,
        width: 400,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }),
    });

    const target = findPanelPortrait(document);

    expect(target?.image.classList.contains('styles_avatar__t7tEz')).toBe(true);
    expect(target?.image).not.toBe(decorationsPortrait);
  });

  it('does not treat a Current Decorations portrait as the fullscreen target', () => {
    document.body.innerHTML = `
      <div class="ct-sidebar__portal">
        <aside aria-label="Information Sidebar">
          <div class="ct-decorate-pane__current-selections">
            <img
              class="ddbc-character-avatar__portrait ct-decorate-pane__portrait"
              alt="Character portrait"
              src="https://www.dndbeyond.com/avatars/decorations.jpeg">
          </div>
        </aside>
      </div>
    `;

    expect(findPanelPortrait(document)).toBeNull();
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
