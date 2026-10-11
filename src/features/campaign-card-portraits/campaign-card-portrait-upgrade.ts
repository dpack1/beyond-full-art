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
import {isCampaignPageUrl} from '../../platform/dndbeyond/urls';
import type {Cleanup} from '../../shared/types';

const LAST_SEEN_BACKGROUND_URL_ATTRIBUTE_NAME =
  'data-bfa-campaign-card-portrait-last-seen-url';
const MAX_CONCURRENT_PRELOADS = 3;
const IDLE_TIMEOUT_MS = 250;

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

export function installCampaignCardPortraitUpgrade(
    doc: Document = document,
): Cleanup {
  const currentUrl = new URL(doc.location.href);
  if (!isCampaignPageUrl(currentUrl)) {
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
  const queue = createPortraitUpgradeQueue(doc);
  const stopObserving = observeCampaignCardPortraitTargets((target) => {
    queue.enqueue(target);
  }, doc);

  return () => {
    stopObserving();
    queue.cleanup();
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
      return;
    }

    const upgradedUrl = buildCampaignCardPortraitUpgradeUrl(currentUrl);
    target.portrait.setAttribute(LAST_SEEN_BACKGROUND_URL_ATTRIBUTE_NAME, currentUrl);
    if (upgradedUrl === null || upgradedUrl === currentUrl) {
      return;
    }

    pendingTasks.set(target.portrait, {
      portrait: target.portrait,
      sourceUrl: currentUrl,
      upgradedUrl,
    });
    scheduleQueueDrain();
  };

  const cleanup = () => {
    disposed = true;
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
      return;
    }

    const loadSucceeded = await preloadImage(task.upgradedUrl, doc);
    if (disposed || !loadSucceeded || !isReadyToUpgrade(task.portrait, task.sourceUrl)) {
      return;
    }

    task.portrait.style.backgroundImage = formatBackgroundImageUrl(task.upgradedUrl);
    task.portrait.setAttribute(
        LAST_SEEN_BACKGROUND_URL_ATTRIBUTE_NAME,
        task.upgradedUrl,
    );
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

function isReadyToUpgrade(portrait: HTMLElement, sourceUrl: string): boolean {
  if (!portrait.isConnected) {
    return false;
  }

  const liveBackgroundImageUrl = extractBackgroundImageUrl(
      portrait.style.backgroundImage,
  );
  return liveBackgroundImageUrl === sourceUrl;
}

function preloadImage(imageUrl: string, doc: Document): Promise<boolean> {
  const view = doc.defaultView;
  const ImageConstructor = view?.Image ?? Image;
  return new Promise((resolve) => {
    const image = new ImageConstructor();
    image.addEventListener('error', () => {
      resolve(false);
    }, {once: true});
    image.addEventListener('load', () => {
      resolve(true);
    }, {once: true});
    image.src = imageUrl;
  });
}
