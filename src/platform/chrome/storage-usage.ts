/** Chrome's chrome.storage.local cap when the runtime omits QUOTA_BYTES. */
const LOCAL_STORAGE_QUOTA_BYTES = 10_485_760;

export interface ExtensionStorageUsage {
  indexedDbBytes: number | null;
  indexedDbQuotaBytes: number | null;
  localBytes: number | null;
  localQuotaBytes: number | null;
}

/**
 * Reads the two pools the extension actually uses.
 * chrome.storage.local holds notes and settings and has its own byte cap.
 * IndexedDB holds image blobs. navigator.storage.estimate() is Chrome's
 * usage and quota for that origin, including database overhead.
 */
export async function readExtensionStorageUsage(): Promise<ExtensionStorageUsage> {
  const [local, indexedDb] = await Promise.all([
    readLocalStorageUsage(),
    readIndexedDbUsage(),
  ]);
  return {...local, ...indexedDb};
}

async function readLocalStorageUsage(): Promise<
  Pick<ExtensionStorageUsage, 'localBytes' | 'localQuotaBytes'>
> {
  const area = getLocalStorageArea();
  const localQuotaBytes = readLocalQuota(area);
  if (area?.getBytesInUse === undefined) {
    return {localBytes: null, localQuotaBytes};
  }

  try {
    const localBytes = await area.getBytesInUse(null);
    return {
      localBytes: typeof localBytes === 'number' ? localBytes : null,
      localQuotaBytes,
    };
  } catch {
    return {localBytes: null, localQuotaBytes};
  }
}

async function readIndexedDbUsage(): Promise<
  Pick<ExtensionStorageUsage, 'indexedDbBytes' | 'indexedDbQuotaBytes'>
> {
  const estimate = globalThis.navigator?.storage?.estimate;
  if (estimate === undefined) {
    return {indexedDbBytes: null, indexedDbQuotaBytes: null};
  }

  try {
    const reading = await estimate.call(globalThis.navigator.storage);
    return {
      indexedDbBytes: finiteByteCount(reading.usage),
      indexedDbQuotaBytes: finiteByteCount(reading.quota),
    };
  } catch {
    return {indexedDbBytes: null, indexedDbQuotaBytes: null};
  }
}

function getLocalStorageArea(): ChromeStorageLocal | null {
  if (typeof chrome === 'undefined' || chrome.storage?.local === undefined) {
    return null;
  }

  return chrome.storage.local;
}

function readLocalQuota(area: ChromeStorageLocal | null): number | null {
  if (area === null) {
    return null;
  }

  const quota = area.QUOTA_BYTES;
  return typeof quota === 'number' ? quota : LOCAL_STORAGE_QUOTA_BYTES;
}

function finiteByteCount(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface ChromeStorageLocal {
  QUOTA_BYTES?: number;
  getBytesInUse: (keys: string | string[] | null) => Promise<number>;
}
