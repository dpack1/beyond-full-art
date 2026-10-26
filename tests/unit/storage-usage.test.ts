import {afterEach, describe, expect, it, vi} from 'vitest';

import {readExtensionStorageUsage} from '../../src/platform/chrome/storage-usage';
import {describeStorageUsage} from '../../src/popup/storage-usage';

describe('storage usage readout', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('describes notes against the extension cap and images against the IndexedDB estimate', () => {
    const description = describeStorageUsage({
      indexedDbBytes: 4096,
      indexedDbQuotaBytes: 5_000_000_000,
      localBytes: 2048,
      localQuotaBytes: 10_485_760,
    });

    expect(description.notes).toEqual({
      detail: '2.0 KB of 10.0 MB',
      meterMax: 10_485_760,
      meterValue: 2048,
      warning: false,
    });
    expect(description.images.detail).toBe('about 4.0 KB of 4.7 GB');
    expect(description.summary).toBe('');
  });

  it('warns when notes and settings reach 80% of the extension cap', () => {
    const description = describeStorageUsage({
      indexedDbBytes: 0,
      indexedDbQuotaBytes: null,
      localBytes: 9_000_000,
      localQuotaBytes: 10_485_760,
    });

    expect(description.notes.warning).toBe(true);
    expect(description.notes.detail).toBe('8.6 MB of 10.0 MB');
    expect(description.images).toEqual({
      detail: 'about 0 B',
      meterMax: null,
      meterValue: null,
      warning: false,
    });
  });

  it('keeps a measured pool when the other pool cannot be read', () => {
    const description = describeStorageUsage({
      indexedDbBytes: null,
      indexedDbQuotaBytes: null,
      localBytes: null,
      localQuotaBytes: null,
    });

    expect(description.summary).toBe(
        'Notes and settings could not be measured. Image storage could not be measured.',
    );
  });

  it('reads chrome.storage.local bytes and the IndexedDB estimate', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          QUOTA_BYTES: 10_485_760,
          getBytesInUse: vi.fn().mockResolvedValue(2048),
        },
      },
    });
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockResolvedValue({
          quota: 5_000_000_000,
          usage: 4096,
        }),
      },
    });

    await expect(readExtensionStorageUsage()).resolves.toEqual({
      indexedDbBytes: 4096,
      indexedDbQuotaBytes: 5_000_000_000,
      localBytes: 2048,
      localQuotaBytes: 10_485_760,
    });
    expect(chrome.storage.local.getBytesInUse).toHaveBeenCalledWith(null);
  });

  it('reports an unread pool without failing the other one', async () => {
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          QUOTA_BYTES: 10_485_760,
          getBytesInUse: vi.fn().mockRejectedValue(new Error('storage failed')),
        },
      },
    });
    vi.stubGlobal('navigator', {
      storage: {
        estimate: vi.fn().mockRejectedValue(new Error('estimate failed')),
      },
    });

    await expect(readExtensionStorageUsage()).resolves.toEqual({
      indexedDbBytes: null,
      indexedDbQuotaBytes: null,
      localBytes: null,
      localQuotaBytes: 10_485_760,
    });
  });
});
