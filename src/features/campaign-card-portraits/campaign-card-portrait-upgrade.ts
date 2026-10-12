import upgradeStyles from './campaign-card-portrait-upgrade.css?raw';
import {
  buildCampaignCardPortraitUpgradeUrl,
  extractBackgroundImageUrl,
  formatBackgroundImageUrl,
} from './avatar-url';
import {
  CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY,
  getCampaignCardPortraitUpgradeEnabled,
} from '../../platform/chrome/storage';
import {
  observeCampaignCardPortraitTargets,
  type CampaignCardPortraitTarget,
} from '../../platform/dndbeyond/campaign-card-portrait-adapter';
import {
  CARD_PORTRAIT_UPGRADE_STYLE_ATTRIBUTE_NAME,
} from '../../platform/dndbeyond/selectors';
import {
  isCampaignPageUrl,
  isCharacterCollectionPageUrl,
} from '../../platform/dndbeyond/urls';
import type {Cleanup} from '../../shared/types';

const LAST_SEEN_BACKGROUND_URL_ATTRIBUTE_NAME =
  'data-bfa-campaign-card-portrait-last-seen-url';
const STATE_ATTRIBUTE_NAME = 'data-bfa-card-portrait-state';
const REASON_ATTRIBUTE_NAME = 'data-bfa-card-portrait-reason';
const NATURAL_HEIGHT_ATTRIBUTE_NAME = 'data-bfa-card-portrait-natural-height';
const NATURAL_WIDTH_ATTRIBUTE_NAME = 'data-bfa-card-portrait-natural-width';
const UPGRADE_CLASS_NAME = 'bfa-card-portrait-upgrade';
const MAX_CONCURRENT_PRELOADS = 3;
const IDLE_TIMEOUT_MS = 250;

type CardPortraitUpgradeState = 'failed' | 'pending' | 'skipped' | 'upgraded';
type CardPortraitUpgradeReason =
  | 'already-target-size'
  | 'load-failed'
  | 'no-background-url'
  | 'source-changed'
  | 'unsupported-url';

type IdleSchedulerWindow = Window & Partial<{
  cancelIdleCallback: (handle: number) => void;
  requestIdleCallback: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions,
  ) => number;
}>;

interface PendingUpgradeTask {
  portrait: HTMLElement;
  sourceUrl: string;
  upgradedUrl: string;
}

interface PreloadResult {
  naturalHeight: number;
  naturalWidth: number;
  ok: boolean;
}

export function installCampaignCardPortraitUpgrade(
    doc: Document = document,
): Cleanup {
  const currentUrl = new URL(doc.location.href);
  if (
    !isCampaignPageUrl(currentUrl) &&
    !isCharacterCollectionPageUrl(currentUrl)
  ) {
    return () => {};
  }

  let activeCleanup: Cleanup | null = null;
  let disposed = false;
  let syncGeneration = 0;

  const syncEnabledState = async () => {
    const generation = ++syncGeneration;
    const isEnabled = await getCampaignCardPortraitUpgradeEnabled();
    if (disposed || generation !== syncGeneration) {
      return;
    }

    if (isEnabled) {
      if (activeCleanup === null) {
        activeCleanup = startCampaignCardPortraitUpgrade(doc);
      }
      return;
    }

    activeCleanup?.();
    activeCleanup = null;
  };

  const removeStorageListener = installStorageListener(syncEnabledState);
  void syncEnabledState();

  return () => {
    disposed = true;
    syncGeneration += 1;
    removeStorageListener();
    activeCleanup?.();
    activeCleanup = null;
  };
}

function startCampaignCardPortraitUpgrade(doc: Document): Cleanup {
  ensureUpgradeStyles(doc);
  const queue = createPortraitUpgradeQueue(doc);
  const stopObserving = observeCampaignCardPortraitTargets((target) => {
    queue.enqueue(target);
  }, doc);

  return () => {
    stopObserving();
    queue.cleanup();
    removeUpgradeStates(doc);
    removeUpgradeStyles(doc);
  };
}

function installStorageListener(onChange: () => void): Cleanup {
  if (typeof chrome === 'undefined' || chrome.storage?.onChanged === undefined) {
    return () => {};
  }

  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] =
    (changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      if (!Object.hasOwn(changes, CAMPAIGN_CARD_PORTRAIT_UPGRADE_ENABLED_KEY)) {
        return;
      }

      void onChange();
    };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
  };
}

function createPortraitUpgradeQueue(doc: Document): {
  cleanup: Cleanup;
  enqueue: (target: CampaignCardPortraitTarget) => void;
} {
  const pendingTasks = new Map<HTMLElement, PendingUpgradeTask>();
  const view = doc.defaultView as IdleSchedulerWindow | null;
  let activePreloads = 0;
  let disposed = false;
  let idleCallbackHandle: number | null = null;
  let timeoutHandle: number | null = null;

  const enqueue = (target: CampaignCardPortraitTarget) => {
    if (disposed) {
      return;
    }

    const currentUrl = extractBackgroundImageUrl(target.portrait.style.backgroundImage);
    if (currentUrl === null) {
      setPortraitUpgradeState(target.portrait, 'skipped', 'no-background-url');
      return;
    }

    const upgradedUrl = buildCampaignCardPortraitUpgradeUrl(currentUrl);
    target.portrait.setAttribute(LAST_SEEN_BACKGROUND_URL_ATTRIBUTE_NAME, currentUrl);
    if (upgradedUrl === null) {
      setPortraitUpgradeState(target.portrait, 'skipped', 'unsupported-url');
      return;
    }

    if (upgradedUrl === currentUrl) {
      if (target.portrait.getAttribute(STATE_ATTRIBUTE_NAME) !== 'upgraded') {
        setPortraitUpgradeState(
            target.portrait,
            'skipped',
            'already-target-size',
        );
      }
      return;
    }

    setPortraitUpgradeState(target.portrait, 'pending');
    pendingTasks.set(target.portrait, {
      portrait: target.portrait,
      sourceUrl: currentUrl,
      upgradedUrl,
    });
    scheduleQueueDrain();
  };

  const cleanup = () => {
    disposed = true;
    for (const task of pendingTasks.values()) {
      clearPortraitUpgradeState(task.portrait);
    }
    pendingTasks.clear();
    clearScheduledDrain();
  };

  return {
    cleanup,
    enqueue,
  };

  function clearScheduledDrain(): void {
    if (idleCallbackHandle !== null && view?.cancelIdleCallback !== undefined) {
      view.cancelIdleCallback(idleCallbackHandle);
      idleCallbackHandle = null;
    }

    if (timeoutHandle !== null && view !== null) {
      view.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  }

  function drainQueue(): void {
    clearScheduledDrain();
    if (disposed) {
      return;
    }

    while (activePreloads < MAX_CONCURRENT_PRELOADS && pendingTasks.size > 0) {
      const nextEntry = pendingTasks.entries().next().value;
      if (nextEntry === undefined) {
        return;
      }

      const [portrait, task] = nextEntry;
      pendingTasks.delete(portrait);
      activePreloads += 1;
      void runTask(task).finally(() => {
        activePreloads -= 1;
        if (!disposed && pendingTasks.size > 0) {
          scheduleQueueDrain();
        }
      });
    }
  }

  async function runTask(task: PendingUpgradeTask): Promise<void> {
    if (!isReadyToUpgrade(task.portrait, task.sourceUrl)) {
      setPortraitUpgradeState(task.portrait, 'skipped', 'source-changed');
      return;
    }

    const preloadResult = await preloadImage(task.upgradedUrl, doc);
    if (
      disposed ||
      !preloadResult.ok ||
      !isReadyToUpgrade(task.portrait, task.sourceUrl)
    ) {
      if (!disposed) {
        setPortraitUpgradeState(task.portrait, 'failed', 'load-failed');
      }
      return;
    }

    task.portrait.style.backgroundImage = formatBackgroundImageUrl(task.upgradedUrl);
    task.portrait.setAttribute(
        LAST_SEEN_BACKGROUND_URL_ATTRIBUTE_NAME,
        task.upgradedUrl,
    );
    setPortraitNaturalSize(task.portrait, preloadResult);
    setPortraitUpgradeState(task.portrait, 'upgraded');
  }

  function scheduleQueueDrain(): void {
    if (disposed || idleCallbackHandle !== null || timeoutHandle !== null) {
      return;
    }

    if (view?.requestIdleCallback !== undefined) {
      idleCallbackHandle = view.requestIdleCallback(() => {
        drainQueue();
      }, {
        timeout: IDLE_TIMEOUT_MS,
      });
      return;
    }

    if (view === null) {
      drainQueue();
      return;
    }

    timeoutHandle = view.setTimeout(() => {
      drainQueue();
    }, 0);
  }
}

function ensureUpgradeStyles(doc: Document): void {
  if (
    doc.head.querySelector(`[${CARD_PORTRAIT_UPGRADE_STYLE_ATTRIBUTE_NAME}]`) !==
      null
  ) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CARD_PORTRAIT_UPGRADE_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = upgradeStyles;
  doc.head.append(styleElement);
}

function removeUpgradeStyles(doc: Document): void {
  doc.head.querySelector(`[${CARD_PORTRAIT_UPGRADE_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}

function setPortraitUpgradeState(
    portrait: HTMLElement,
    state: CardPortraitUpgradeState,
    reason: CardPortraitUpgradeReason | null = null,
): void {
  portrait.classList.add(UPGRADE_CLASS_NAME);
  portrait.setAttribute(STATE_ATTRIBUTE_NAME, state);
  if (reason === null) {
    portrait.removeAttribute(REASON_ATTRIBUTE_NAME);
  } else {
    portrait.setAttribute(REASON_ATTRIBUTE_NAME, reason);
  }
}

function clearPortraitUpgradeState(portrait: HTMLElement): void {
  portrait.classList.remove(UPGRADE_CLASS_NAME);
  portrait.removeAttribute(STATE_ATTRIBUTE_NAME);
  portrait.removeAttribute(REASON_ATTRIBUTE_NAME);
  portrait.removeAttribute(NATURAL_HEIGHT_ATTRIBUTE_NAME);
  portrait.removeAttribute(NATURAL_WIDTH_ATTRIBUTE_NAME);
}

function removeUpgradeStates(doc: Document): void {
  const portraits = doc.querySelectorAll<HTMLElement>(`[${STATE_ATTRIBUTE_NAME}]`);
  for (const portrait of portraits) {
    clearPortraitUpgradeState(portrait);
  }
}

function isReadyToUpgrade(portrait: HTMLElement, sourceUrl: string): boolean {
  if (!portrait.isConnected) {
    return false;
  }

  const liveBackgroundImageUrl = extractBackgroundImageUrl(
      portrait.style.backgroundImage,
  );
  return liveBackgroundImageUrl === sourceUrl;
}

function setPortraitNaturalSize(
    portrait: HTMLElement,
    preloadResult: PreloadResult,
): void {
  portrait.setAttribute(
      NATURAL_HEIGHT_ATTRIBUTE_NAME,
      String(preloadResult.naturalHeight),
  );
  portrait.setAttribute(
      NATURAL_WIDTH_ATTRIBUTE_NAME,
      String(preloadResult.naturalWidth),
  );
}

function preloadImage(imageUrl: string, doc: Document): Promise<PreloadResult> {
  const view = doc.defaultView;
  const ImageConstructor = view?.Image ?? Image;
  return new Promise((resolve) => {
    const image = new ImageConstructor();
    image.addEventListener('error', () => {
      resolve({
        naturalHeight: 0,
        naturalWidth: 0,
        ok: false,
      });
    }, {once: true});
    image.addEventListener('load', () => {
      resolve({
        naturalHeight: image.naturalHeight,
        naturalWidth: image.naturalWidth,
        ok: true,
      });
    }, {once: true});
    image.src = imageUrl;
  });
}
