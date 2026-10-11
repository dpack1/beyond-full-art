import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {installCampaignCardPortraitUpgrade} from '../../src/features/campaign-card-portraits/campaign-card-portrait-upgrade';
import {
  CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY,
  setCampaignCardPortraitUpgradeEnabled,
} from '../../src/platform/chrome/storage';
import {CAMPAIGN_CHARACTER_CARD_FIXTURE} from '../fixtures/campaign-character-cards';

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
    expect(portrait.style.backgroundImage).toContain('width=150');
    expect(portrait.style.backgroundImage).toContain('height=150');
    expect(portrait.style.backgroundImage).toContain('fit=bounds');

    cleanup();
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
    expect(portrait.style.backgroundImage).not.toContain('width=150');

    cleanup();
  });

  it('upgrades cards rendered after the page observer starts', async () => {
    window.history.replaceState({}, '', '/campaigns/12345');

    const cleanup = installCampaignCardPortraitUpgrade(document);
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;
    await flushAsyncWork();

    const portrait = getCampaignPortrait();
    expect(portrait.style.backgroundImage).toContain('width=150');

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

    expect(getCampaignPortrait().style.backgroundImage).toContain('width=150');

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
