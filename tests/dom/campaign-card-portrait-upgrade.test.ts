import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {installCampaignCardPortraitUpgrade} from '../../src/features/campaign-card-portraits/campaign-card-portrait-upgrade';
import {
  CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY,
  setCampaignCardPortraitUpgradeEnabled,
} from '../../src/platform/chrome/storage';
import {
  CAMPAIGN_CHARACTER_CARD_FIXTURE,
  CAMPAIGN_THUMBNAIL_CHARACTER_CARD_FIXTURE,
  MY_CHARACTERS_CARD_FIXTURE,
  OWNED_CAMPAIGN_CHARACTER_CARD_FIXTURE,
} from '../fixtures/campaign-character-cards';

describe('campaign card portrait upgrade', () => {
  let restoreImageConstructor: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
    restoreImageConstructor = installImageStub();
    (globalThis as {chrome?: unknown}).chrome = createChromeStub();
    window.requestIdleCallback = ((callback: IdleRequestCallback) => {
      return window.setTimeout(() => {
        callback({
          didTimeout: false,
          timeRemaining: () => 10,
        } as IdleDeadline);
      }, 0);
    }) as typeof window.requestIdleCallback;
    window.cancelIdleCallback = ((handle: number) => {
      window.clearTimeout(handle);
    }) as typeof window.cancelIdleCallback;
  });

  afterEach(() => {
    restoreImageConstructor?.();
    restoreImageConstructor = null;
    document.body.innerHTML = '';
    window.history.replaceState({}, '', '/');
  });

  it('upgrades campaign card portraits when enabled', async () => {
    window.history.replaceState({}, '', '/campaigns/12345');
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=600');
    expect(portrait.style.backgroundImage).toContain('height=600');
    expect(portrait.style.backgroundImage).toContain('fit=bounds');
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('upgraded');
    expect(portrait.hasAttribute('data-bfa-card-portrait-reason')).toBe(false);
    expect(portrait.getAttribute('data-bfa-card-portrait-natural-width')).toBe('600');
    expect(portrait.getAttribute('data-bfa-card-portrait-natural-height')).toBe('600');
    expect(portrait.classList.contains('bfa-card-portrait-upgrade')).toBe(true);
    expect(document.querySelector('[data-bfa-card-portrait-upgrade-styles]'))
        .not.toBeNull();

    cleanup();
    expect(portrait.hasAttribute('data-bfa-card-portrait-state')).toBe(false);
    expect(portrait.hasAttribute('data-bfa-card-portrait-reason')).toBe(false);
    expect(portrait.hasAttribute('data-bfa-card-portrait-natural-width')).toBe(false);
    expect(portrait.hasAttribute('data-bfa-card-portrait-natural-height')).toBe(false);
    expect(portrait.classList.contains('bfa-card-portrait-upgrade')).toBe(false);
    expect(document.querySelector('[data-bfa-card-portrait-upgrade-styles]'))
        .toBeNull();
  });

  it('leaves portraits unchanged when the setting is disabled', async () => {
    const chromeStub = createChromeStub({
      [CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY]: false,
    });
    (globalThis as {chrome?: unknown}).chrome = chromeStub;
    window.history.replaceState({}, '', '/campaigns/12345');
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=60');
    expect(portrait.style.backgroundImage).not.toContain('width=600');

    cleanup();
  });

  it('upgrades cards rendered after the page observer starts', async () => {
    window.history.replaceState({}, '', '/campaigns/12345');

    const cleanup = installCampaignCardPortraitUpgrade(document);
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=600');

    cleanup();
  });

  it('rewrites D&D Beyond thumbnail avatar paths before upgrading', async () => {
    window.history.replaceState({}, '', '/campaigns/12345');
    document.body.innerHTML = CAMPAIGN_THUMBNAIL_CHARACTER_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('/avatars/25837/58/');
    expect(portrait.style.backgroundImage).not.toContain('/thumbnails/');
    expect(portrait.style.backgroundImage).toContain('width=600');
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('upgraded');

    cleanup();
  });

  it('upgrades owned campaign character cards with footer character actions', async () => {
    window.history.replaceState({}, '', '/campaigns/12345');
    document.body.innerHTML = OWNED_CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=600');
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('upgraded');

    cleanup();
  });

  it('marks each portrait pending while its sharper image preloads', async () => {
    restoreImageConstructor?.();
    restoreImageConstructor = installNeverResolvingImageStub();
    window.history.replaceState({}, '', '/characters');
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('pending');
    expect(portrait.classList.contains('bfa-card-portrait-upgrade')).toBe(true);

    cleanup();
  });

  it('marks already-sharp portraits as skipped with a reason', async () => {
    window.history.replaceState({}, '', '/characters');
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE.replace(
        'width=60&amp;height=60',
        'width=600&amp;height=600',
    );

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('skipped');
    expect(portrait.getAttribute('data-bfa-card-portrait-reason')).toBe(
        'already-target-size',
    );
    expect(portrait.classList.contains('bfa-card-portrait-upgrade')).toBe(true);

    cleanup();
  });

  it('marks unsupported portrait URLs as skipped with a reason', async () => {
    window.history.replaceState({}, '', '/characters');
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE.replace(
        'https://www.dndbeyond.com/avatars/58201/262/1581111423-169418374.jpeg',
        'https://www.dndbeyond.com/Content/Skins/Waterdeep/images/characters/default-avatar-builder.png',
    );

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('skipped');
    expect(portrait.getAttribute('data-bfa-card-portrait-reason')).toBe(
        'unsupported-url',
    );

    cleanup();
  });

  it('marks failed sharper-image loads with a reason', async () => {
    restoreImageConstructor?.();
    restoreImageConstructor = installFailingImageStub();
    window.history.replaceState({}, '', '/characters');
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.getAttribute('data-bfa-card-portrait-state')).toBe('failed');
    expect(portrait.getAttribute('data-bfa-card-portrait-reason')).toBe(
        'load-failed',
    );

    cleanup();
  });

  it('upgrades My Characters card portraits on the character collection page', async () => {
    window.history.replaceState({}, '', '/characters');
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=600');
    expect(portrait.style.backgroundImage).toContain('height=600');

    cleanup();
  });

  it('does not run on character sheet pages', async () => {
    window.history.replaceState({}, '', '/characters/169418374');
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=60');
    expect(portrait.style.backgroundImage).not.toContain('width=600');

    cleanup();
  });

  it('reacts when the setting is turned on after startup', async () => {
    const chromeStub = createChromeStub({
      [CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY]: false,
    });
    (globalThis as {chrome?: unknown}).chrome = chromeStub;
    window.history.replaceState({}, '', '/campaigns/12345');
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const cleanup = installCampaignCardPortraitUpgrade(document);
    await flushAsyncWork();
    expect(getCampaignPortrait().style.backgroundImage).toContain('width=60');

    await setCampaignCardPortraitUpgradeEnabled(true);
    await flushAsyncWork();

    expect(getCampaignPortrait().style.backgroundImage).toContain('width=600');

    cleanup();
  });
});

function createChromeStub(initialValues: Record<string, unknown> = {}) {
  const storageValues = {...initialValues};
  const listeners = new Set<
    (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void
  >();

  return {
    runtime: {
      lastError: undefined,
    },
    storage: {
      local: {
        get(key: string, callback: (value: Record<string, unknown>) => void) {
          callback({[key]: storageValues[key]});
        },
        remove(key: string, callback: () => void) {
          const oldValue = storageValues[key];
          delete storageValues[key];
          callback();
          emitChange(key, oldValue, undefined);
        },
        set(nextValues: Record<string, unknown>, callback: () => void) {
          const changes: Record<string, chrome.storage.StorageChange> = {};
          for (const [key, value] of Object.entries(nextValues)) {
            changes[key] = {
              newValue: value,
              oldValue: storageValues[key],
            };
            storageValues[key] = value;
          }

          callback();
          for (const listener of listeners) {
            listener(changes, 'local');
          }
        },
      },
      onChanged: {
        addListener(
            listener: (
              changes: Record<string, chrome.storage.StorageChange>,
              areaName: string,
            ) => void,
        ) {
          listeners.add(listener);
        },
        removeListener(
            listener: (
              changes: Record<string, chrome.storage.StorageChange>,
              areaName: string,
            ) => void,
        ) {
          listeners.delete(listener);
        },
      },
    },
  };

  function emitChange(
      key: string,
      oldValue: unknown,
      newValue: unknown,
  ): void {
    const change = {[key]: {newValue, oldValue}};
    for (const listener of listeners) {
      listener(change, 'local');
    }
  }
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function getCampaignPortrait(): HTMLElement {
  const portrait = document.querySelector<HTMLElement>('.image.user-selected-avatar');
  if (portrait === null) {
    throw new Error('Campaign portrait was not rendered.');
  }

  return portrait;
}

function installImageStub(): () => void {
  const originalImage = window.Image;

  class FakeImage extends EventTarget {
    naturalHeight = 600;
    naturalWidth = 600;

    set src(_value: string) {
      window.setTimeout(() => {
        this.dispatchEvent(new Event('load'));
      }, 0);
    }
  }

  window.Image = FakeImage as typeof window.Image;
  return () => {
    window.Image = originalImage;
  };
}

function installNeverResolvingImageStub(): () => void {
  const originalImage = window.Image;

  class FakeImage extends EventTarget {
    set src(_value: string) {}
  }

  window.Image = FakeImage as typeof window.Image;
  return () => {
    window.Image = originalImage;
  };
}

function installFailingImageStub(): () => void {
  const originalImage = window.Image;

  class FakeImage extends EventTarget {
    set src(_value: string) {
      window.setTimeout(() => {
        this.dispatchEvent(new Event('error'));
      }, 0);
    }
  }

  window.Image = FakeImage as typeof window.Image;
  return () => {
    window.Image = originalImage;
  };
}
