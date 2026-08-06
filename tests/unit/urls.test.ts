import {describe, expect, it} from 'vitest';

import {
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
});
