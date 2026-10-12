import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  findCampaignCardPortraitTargets,
  observeCampaignCardPortraitTargets,
} from '../../src/platform/dndbeyond/campaign-card-portrait-adapter';
import {
  CAMPAIGN_CHARACTER_CARD_FIXTURE,
  MY_CHARACTERS_CARD_FIXTURE,
  OWNED_CAMPAIGN_CHARACTER_CARD_FIXTURE,
} from '../fixtures/campaign-character-cards';

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

  it('finds My Characters card portraits from character links', () => {
    document.body.innerHTML = MY_CHARACTERS_CARD_FIXTURE;

    const targets = findCampaignCardPortraitTargets(document);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.characterId).toBe('169418374');
    expect(targets[0]?.detailsLink.getAttribute('href')).toBe(
        '/characters/169418374',
    );
    expect(targets[0]?.portrait.className).toContain('user-selected-avatar');
  });

  it('finds owned campaign cards with footer character actions', () => {
    document.body.innerHTML = OWNED_CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const targets = findCampaignCardPortraitTargets(document);

    expect(targets).toHaveLength(1);
    expect(targets[0]?.characterId).toBe('900000001');
    expect(targets[0]?.detailsLink.getAttribute('href')).toBe(
        '/profile/greywolf/characters/900000001',
    );
    expect(targets[0]?.portrait.className).toContain('user-selected-avatar');
  });

  it('does not duplicate campaign portraits through the generic character-list path', () => {
    document.body.innerHTML = CAMPAIGN_CHARACTER_CARD_FIXTURE;

    const targets = findCampaignCardPortraitTargets(document);

    expect(targets).toHaveLength(1);
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
