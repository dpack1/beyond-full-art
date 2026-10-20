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
import {
  CHARACTER_SHEET_TABS_FIXTURE,
  CURRENT_CHARACTER_SHEET_TABS_FIXTURE,
  LIVE_CHARACTER_SHEET_TABS_FIXTURE,
} from '../fixtures/character-sheet-tabs';
import {PORTRAIT_MANAGER_FIXTURE} from '../fixtures/portrait-manager';

describe('character sheet enhancement', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    document.head.querySelector('[data-bfa-character-journal-styles]')?.remove();
    chromeMessageMocks.deleteStoredCharacterArt.mockResolvedValue(undefined);
    chromeMessageMocks.getStoredCharacterArtImageData.mockResolvedValue(null);
    chromeMessageMocks.getStoredCharacterArtMetadata.mockResolvedValue(null);
    chromeMessageMocks.getStoredCharacterPortraitCropImageData.mockResolvedValue(null);
    chromeMessageMocks.getStoredCharacterPortraitCropMetadata.mockResolvedValue(null);
    chromeMessageMocks.saveStoredCharacterArt.mockRejectedValue(new Error('Not used'));
    chromeMessageMocks.saveStoredCharacterPortraitCrop.mockRejectedValue(new Error('Not used'));
    (globalThis as {chrome?: unknown}).chrome = {
      runtime: {
        lastError: undefined,
      },
      storage: createFakeChromeStorage(),
    };
    URL.createObjectURL = vi.fn(() => 'blob:stored-full-art');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    document.head.querySelector('[data-bfa-character-journal-styles]')?.remove();
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

    const cleanup = installCharacterSheetEnhancement(document);
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

    cleanup();
  });

  it('inserts a character journal tab after Extras', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const labels = Array.from(
        document.querySelectorAll('.ct-character-sheet-tab-item button'),
        (button) => button.textContent?.trim(),
    );

    expect(labels).toEqual([
      'Actions',
      'Inventory',
      'Extras',
      'Journal',
      'Notes',
    ]);
    expect(document.querySelector('[data-bfa-character-journal-styles]'))
        .not.toBeNull();

    cleanup();
  });

  it('does not insert the character journal tab when the setting is disabled', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    (globalThis as {chrome: {storage: unknown}}).chrome.storage =
      createFakeChromeStorage({
        'bfa.preferences.characterJournalEnabled': false,
      });
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-bfa-character-journal-tab]')).toBeNull();

    cleanup();
  });

  it('removes the character journal tab when the popup setting changes', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    const storage = createFakeChromeStorage();
    (globalThis as {chrome: {storage: unknown}}).chrome.storage = storage;
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('[data-bfa-character-journal-tab]')).not.toBeNull();

    storage.local.set({
      'bfa.preferences.characterJournalEnabled': false,
    }, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-bfa-character-journal-tab]')).toBeNull();

    storage.local.set({
      'bfa.preferences.characterJournalEnabled': true,
    }, () => {});
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelector('[data-bfa-character-journal-tab]')).not.toBeNull();

    cleanup();
  });

  it('shows the character journal section inside the sheet content area', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector<HTMLButtonElement>(
        '[data-bfa-character-journal-tab="true"]',
    )?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(
        document.querySelector('.ct-character-sheet-content .bfa-character-journal-section'),
    ).not.toBeNull();
    expect(
        document.querySelector<HTMLElement>('[data-testid="native-character-panel"]')
            ?.hidden,
    ).toBe(true);

    document.querySelectorAll<HTMLButtonElement>('.ct-character-sheet-tab')[0]
        ?.click();

    expect(
        document.querySelector<HTMLElement>('[data-testid="native-character-panel"]')
            ?.hidden,
    ).toBe(false);

    cleanup();
  });

  it('restores live-shaped native sheet content when a native tab is selected', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CURRENT_CHARACTER_SHEET_TABS_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector<HTMLButtonElement>(
        '[data-bfa-character-journal-tab="true"]',
    )?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const nativePanel = document.querySelector<HTMLElement>(
        '[data-testid="native-character-panel"]',
    );

    expect(
        document.querySelector('.ct-character-sheet-content .bfa-character-journal-section'),
    ).not.toBeNull();
    expect(nativePanel?.hidden).toBe(true);

    Array.from(document.querySelectorAll<HTMLElement>('.ct-character-sheet-tab'))
        .find((tab) => tab.textContent?.includes('FEATURES & TRAITS'))
        ?.click();

    expect(nativePanel?.hidden).toBe(false);
    expect(
        document.querySelector<HTMLElement>('.bfa-character-journal-section')
            ?.hidden,
    ).toBe(true);

    cleanup();
  });

  it('opens Journal from the tab padding before the sheet handles pointerdown', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = LIVE_CHARACTER_SHEET_TABS_FIXTURE;
    let sheetSawPointer = 0;
    document.querySelector('.ddbc-tab-list__nav')?.addEventListener(
        'pointerdown',
        () => {
          sheetSawPointer += 1;
        },
    );

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector<HTMLElement>(
        '[data-bfa-character-journal-tab-item]',
    )?.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(sheetSawPointer).toBe(0);
    expect(document.querySelector('.bfa-character-journal-section')?.hasAttribute('hidden'))
        .toBe(false);
    expect(document.querySelector('.ddbc-tab-list__nav-item--is-active'))
        .toBe(document.querySelector('[data-bfa-character-journal-tab-item]'));
    expect(document.querySelector(
        '[data-testid="sheet-scroller"] .bfa-character-journal-section',
    )).not.toBeNull();

    cleanup();
  });

  it('drops a journal left behind by an extension reload', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = `
      <button data-bfa-character-journal-tab="true" type="button">Journal</button>
      <section class="bfa-character-journal-section"></section>
      ${CHARACTER_SHEET_TABS_FIXTURE}
    `;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.querySelectorAll('[data-bfa-character-journal-tab="true"]'))
        .toHaveLength(1);
    expect(document.querySelectorAll('.bfa-character-journal-section')).toHaveLength(0);

    cleanup();
  });

  it('hides the journal when the character URL changes', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    const cleanup = installCharacterSheetEnhancement(document);
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector<HTMLButtonElement>(
        '[data-bfa-character-journal-tab="true"]',
    )?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector('.bfa-character-journal-section')?.hasAttribute('hidden'))
        .toBe(false);

    window.history.replaceState({}, '', '/characters/222');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(document.querySelector('.bfa-character-journal-section')?.hasAttribute('hidden'))
        .toBe(true);

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

type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  areaName: string,
) => void;

function createFakeChromeStorage(initialValues: Record<string, unknown> = {}) {
  const listeners = new Set<StorageChangeListener>();
  return {
    local: createFakeStorageArea(initialValues, (changes) => {
      for (const listener of listeners) {
        listener(changes, 'local');
      }
    }),
    onChanged: {
      addListener(listener: StorageChangeListener) {
        listeners.add(listener);
      },
      removeListener(listener: StorageChangeListener) {
        listeners.delete(listener);
      },
    },
  };
}

function createFakeStorageArea(
    initialValues: Record<string, unknown> = {},
    onSet: (changes: Record<string, chrome.storage.StorageChange>) => void =
      () => {},
) {
  const values: Record<string, unknown> = {...initialValues};

  return {
    get(
        key: string | null,
        callback: (value: Record<string, unknown>) => void,
    ) {
      if (key === null) {
        callback({...values});
        return;
      }

      callback({
        [key]: values[key],
      });
    },
    remove(key: string, callback: () => void) {
      delete values[key];
      callback();
    },
    set(nextValues: Record<string, unknown>, callback: () => void) {
      const changes: Record<string, chrome.storage.StorageChange> = {};
      for (const [key, newValue] of Object.entries(nextValues)) {
        changes[key] = {
          newValue,
          oldValue: values[key],
        };
      }
      Object.assign(values, nextValues);
      onSet(changes);
      callback();
    },
  };
}
