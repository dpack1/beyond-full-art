import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  findCampaignCardPortraitTargets,
  observeCampaignCardPortraitTargets,
} from '../../src/platform/dndbeyond/campaign-card-portrait-adapter';
import {CAMPAIGN_CHARACTER_CARD_FIXTURE} from '../fixtures/campaign-character-cards';

describe('campaign card portrait adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds campaign character card portraits', () => {
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const targets = findCampaignCardPortraitTargets(document);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.characterId).toBe('169418374');
    expect(targets[0]?.portrait.className).toContain('user-selected-avatar');
  });

  it('observes campaign cards rendered after startup', async () => {
    let callbackCount = 0;
    const stopObserving = observeCampaignCardPortraitTargets(() => {
      callbackCount += 1;
    });

    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callbackCount).toBe(1);

    stopObserving();
  });
});
