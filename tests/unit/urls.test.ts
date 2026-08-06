import {describe, expect, it} from 'vitest';

import {
  isCharacterSheetUrl,
  parseCharacterIdFromCharacterSheetUrl,
} from '../../src/platform/dndbeyond/urls';

describe('character sheet urls', () => {
  it('matches character sheet paths', () => {
    const url = new URL('https://www.dndbeyond.com/characters/169418374');

    expect(isCharacterSheetUrl(url)).toBe(true);
    expect(parseCharacterIdFromCharacterSheetUrl(url)).toBe('169418374');
  });

  it('rejects non-character sheet paths', () => {
    const collectionUrl = new URL('https://www.dndbeyond.com/characters');
    const nestedUrl = new URL('https://www.dndbeyond.com/characters/169418374/edit');

    expect(isCharacterSheetUrl(collectionUrl)).toBe(false);
    expect(isCharacterSheetUrl(nestedUrl)).toBe(false);
    expect(parseCharacterIdFromCharacterSheetUrl(collectionUrl)).toBeNull();
  });
});
