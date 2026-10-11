import {describe, expect, it} from 'vitest';

import {
  buildCampaignCardPortraitUpgradeUrl,
  extractBackgroundImageUrl,
  formatBackgroundImageUrl,
} from '../../src/features/campaign-card-portraits/avatar-url';

describe('campaign card avatar urls', () => {
  it('extracts a background-image url value', () => {
    const backgroundImageValue =
      'url("https://www.dndbeyond.com/avatars/1/2/example.jpeg?width=60&height=60")';

    expect(extractBackgroundImageUrl(backgroundImageValue)).toBe(
        'https://www.dndbeyond.com/avatars/1/2/example.jpeg?width=60&height=60',
    );
  });

  it('upgrades dnd beyond avatar urls to a larger request', () => {
    const imageUrl =
      'https://www.dndbeyond.com/avatars/1/2/example.jpeg?width=60&height=60&fit=bounds&quality=95&auto=webp';

    expect(buildCampaignCardPortraitUpgradeUrl(imageUrl)).toBe(
        'https://www.dndbeyond.com/avatars/1/2/example.jpeg?width=150&height=150&fit=bounds&quality=95&auto=webp',
    );
  });

  it('rejects non-avatar urls', () => {
    expect(buildCampaignCardPortraitUpgradeUrl('https://example.com/image.png')).toBeNull();
  });

  it('formats a background-image declaration', () => {
    expect(formatBackgroundImageUrl('https://www.dndbeyond.com/image.png')).toBe(
        'url("https://www.dndbeyond.com/image.png")',
    );
  });
});
