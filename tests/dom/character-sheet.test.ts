import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const chromeMessageMocks = vi.hoisted(() => ({
  deleteStoredCharacterArt: vi.fn(),
  getStoredCharacterArtImageData: vi.fn(),
  getStoredCharacterArtMetadata: vi.fn(),
  getStoredCharacterPortraitCropImageData: vi.fn(),
  getStoredCharacterPortraitCropMetadata: vi.fn(),
  saveStoredCharacterArt: vi.fn(),
  saveStoredCharacterPortraitCrop: vi.fn(),
}));

vi.mock('../../src/platform/chrome/messages', () => chromeMessageMocks);

import {installCharacterSheetEnhancement} from '../../src/content/character-sheet';
import {
  CHARACTER_MANAGE_PANE_FIXTURE,
  CURRENT_INFORMATION_SIDEBAR_FIXTURE,
} from '../fixtures/character-manage-pane';
import {PORTRAIT_MANAGER_FIXTURE} from '../fixtures/portrait-manager';

describe('character sheet enhancement', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    chromeMessageMocks.deleteStoredCharacterArt.mockResolvedValue(undefined);
    chromeMessageMocks.getStoredCharacterArtImageData.mockResolvedValue(null);
    chromeMessageMocks.getStoredCharacterArtMetadata.mockResolvedValue(null);
    chromeMessageMocks.getStoredCharacterPortraitCropImageData.mockResolvedValue(null);
    chromeMessageMocks.getStoredCharacterPortraitCropMetadata.mockResolvedValue(null);
    chromeMessageMocks.saveStoredCharacterArt.mockRejectedValue(new Error('Not used'));
    chromeMessageMocks.saveStoredCharacterPortraitCrop.mockRejectedValue(new Error('Not used'));
    URL.createObjectURL = vi.fn(() => 'blob:stored-full-art');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    window.history.replaceState({}, '', '/');
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    vi.restoreAllMocks();
  });

  it('enhances the sidebar portrait and opens the viewer', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CHARACTER_MANAGE_PANE_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    const portrait = document.querySelector<HTMLImageElement>('.ddbc-character-avatar__portrait');
    expect(portrait?.getAttribute('role')).toBe('button');
    expect(portrait?.tabIndex).toBe(0);

    portrait?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const overlay = document.querySelector<HTMLDivElement>('.bfa-viewer-overlay');
    const image = document.querySelector<HTMLImageElement>('.bfa-viewer-image');
    expect(overlay?.hidden).toBe(false);
    expect(image?.src).toContain('169418374.jpeg');

    cleanup();
  });

  it('enhances the current background-image sidebar portrait', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CURRENT_INFORMATION_SIDEBAR_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    const portrait = document.querySelector<HTMLElement>('.styles_avatar__t7tEz');
    expect(portrait?.getAttribute('role')).toBe('button');
    expect(portrait?.tabIndex).toBe(0);

    portrait?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const image = document.querySelector<HTMLImageElement>('.bfa-viewer-image');
    expect(image?.src).toContain('169418374.jpeg');

    cleanup();
  });

  it('shows a download action for stored full art', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CHARACTER_MANAGE_PANE_FIXTURE;
    chromeMessageMocks.getStoredCharacterArtImageData.mockResolvedValue({
      byteBuffer: new Uint8Array([1, 2, 3]).buffer,
      fileName: 'Zurelda: full?.png',
      mimeType: 'image/png',
    });
    let clickedDownload = '';
    let clickedHref = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function click(this: HTMLAnchorElement) {
          clickedDownload = this.download;
          clickedHref = this.href;
        },
    );

    const cleanup = installCharacterSheetEnhancement(document);
    const portrait = document.querySelector<HTMLImageElement>('.ddbc-character-avatar__portrait');

    portrait?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const actionButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.bfa-viewer-secondary-action'),
    );
    expect(actionButtons.map((button) => button.textContent)).toEqual([
      'Download full art',
      'Remove stored full art',
    ]);

    actionButtons[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(clickedDownload).toBe('Zurelda- full-.png');
    expect(clickedHref).toBe('blob:stored-full-art');
    expect(document.querySelector('.bfa-viewer-status')?.textContent)
        .toBe('Stored full art download started.');

    cleanup();
  });

  it('enhances builder portrait management when the modal renders later', async () => {
    window.history.replaceState({}, '', '/characters/169418374/builder');

    installCharacterSheetEnhancement(document);
    document.body.innerHTML = `
      <div class="builder-page">
        <img
          class="ddbc-character-avatar__portrait"
          alt="Character portrait"
          data-testid="character-portrait"
          src="https://www.dndbeyond.com/avatars/58196/625/1581111423-169418374.jpeg?width=150&height=150&fit=crop&quality=95&auto=webp">
      </div>
      ${PORTRAIT_MANAGER_FIXTURE}
    `;

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('.bfa-art-sync')).not.toBeNull();
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
