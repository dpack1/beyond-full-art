import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {installCharacterSheetEnhancement} from '../../src/content/character-sheet';
import {CHARACTER_MANAGE_PANE_FIXTURE} from '../fixtures/character-manage-pane';

describe('character sheet enhancement', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
    window.history.replaceState({}, '', '/');
  });

  it('enhances the sidebar portrait and opens the viewer', () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CHARACTER_MANAGE_PANE_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    const portrait = document.querySelector<HTMLImageElement>('.ddbc-character-avatar__portrait');
    expect(portrait?.getAttribute('role')).toBe('button');
    expect(portrait?.tabIndex).toBe(0);

    portrait?.dispatchEvent(new MouseEvent('click', {bubbles: true}));

    const overlay = document.querySelector<HTMLDivElement>('.bfa-viewer-overlay');
    const image = document.querySelector<HTMLImageElement>('.bfa-viewer-image');
    expect(overlay?.hidden).toBe(false);
    expect(image?.src).toContain('169418374.jpeg');

    cleanup();
  });

  it('does nothing on non-character-sheet pages', () => {
    window.history.replaceState({}, '', '/classes/barbarian');
    document.body.innerHTML = CHARACTER_MANAGE_PANE_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    const portrait = document.querySelector<HTMLImageElement>('.ddbc-character-avatar__portrait');

    expect(portrait?.getAttribute('role')).toBeNull();

    cleanup();
  });
});
