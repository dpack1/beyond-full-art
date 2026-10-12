import {describe, expect, it} from 'vitest';

import {
  buildCharacterPageUrl,
  isCampaignPageUrl,
  isCharacterCollectionPageUrl,
  isCharacterPageUrl,
  parseCharacterIdFromCharacterPageUrl,
} from '../../src/platform/dndbeyond/urls';

describe('character page urls', () => {
  it('matches character sheet paths', () => {
    const url = new URL('https://www.dndbeyond.com/characters/169418374');

    expect(isCharacterPageUrl(url)).toBe(true);
    expect(parseCharacterIdFromCharacterPageUrl(url)).toBe('169418374');
  });

  it('matches character builder paths', () => {
    const url = new URL('https://www.dndbeyond.com/characters/169418374/builder');

    expect(isCharacterPageUrl(url)).toBe(true);
    expect(parseCharacterIdFromCharacterPageUrl(url)).toBe('169418374');
  });

  it('rejects non-character paths', () => {
    const collectionUrl = new URL('https://www.dndbeyond.com/characters');
    const collectionSubviewUrl = new URL('https://www.dndbeyond.com/classes/barbarian');

    expect(isCharacterPageUrl(collectionUrl)).toBe(false);
    expect(isCharacterPageUrl(collectionSubviewUrl)).toBe(false);
    expect(parseCharacterIdFromCharacterPageUrl(collectionUrl)).toBeNull();
  });

  it('builds D&D Beyond character page URLs', () => {
    expect(buildCharacterPageUrl('169418374'))
        .toBe('https://www.dndbeyond.com/characters/169418374');
  });
});

describe('campaign page urls', () => {
  it('matches campaign paths', () => {
    expect(
        isCampaignPageUrl(new URL('https://www.dndbeyond.com/campaigns/12345')),
    ).toBe(true);
    expect(
        isCampaignPageUrl(new URL('https://www.dndbeyond.com/campaigns/12345/characters')),
    ).toBe(true);
  });

  it('rejects non-campaign paths', () => {
    expect(
        isCampaignPageUrl(new URL('https://www.dndbeyond.com/characters/169418374')),
    ).toBe(false);
  });
});

describe('character collection urls', () => {
  it('matches the My Characters collection path', () => {
    expect(
        isCharacterCollectionPageUrl(new URL('https://www.dndbeyond.com/characters')),
    ).toBe(true);
    expect(
        isCharacterCollectionPageUrl(new URL('https://www.dndbeyond.com/characters/')),
    ).toBe(true);
  });

  it('rejects character sheet paths', () => {
    expect(
        isCharacterCollectionPageUrl(
            new URL('https://www.dndbeyond.com/characters/169418374'),
        ),
    ).toBe(false);
  });
});
