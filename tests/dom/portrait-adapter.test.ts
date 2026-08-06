import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  findPanelPortrait,
  observePanelPortraits,
} from '../../src/platform/dndbeyond/portrait-adapter';
import {CHARACTER_MANAGE_PANE_FIXTURE} from '../fixtures/character-manage-pane';

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
    expect(target?.image.alt).toBe('Character portrait');
    expect(target?.clickSurface).toBe(target?.image);
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
