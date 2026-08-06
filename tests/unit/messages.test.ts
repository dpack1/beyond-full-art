import {describe, expect, it} from 'vitest';

import {
  asCharacterArtRequest,
  CHARACTER_ART_MESSAGE_SOURCE,
  isCharacterArtOperationType,
} from '../../src/platform/chrome/messages';

describe('character art messages', () => {
  it('accepts a valid save request', () => {
    const request = asCharacterArtRequest({
      byteBase64: 'AQIDBAUGBwg=',
      byteSize: 8,
      characterId: '169418374',
      fileName: 'zurelda.png',
      height: 512,
      mimeType: 'image/png',
      source: CHARACTER_ART_MESSAGE_SOURCE,
      type: 'art:save',
      width: 512,
    });

    expect(request).not.toBeNull();
    expect(request?.type).toBe('art:save');
    if (request?.type === 'art:save') {
      expect(request.byteBuffer?.byteLength).toBe(8);
    }
  });

  it('rejects an invalid save mime type', () => {
    const request = asCharacterArtRequest({
      byteBase64: 'AQIDBAUGBwg=',
      byteSize: 8,
      characterId: '169418374',
      fileName: 'zurelda.gif',
      height: 512,
      mimeType: 'image/gif',
      source: CHARACTER_ART_MESSAGE_SOURCE,
      type: 'art:save',
      width: 512,
    });

    expect(request).toBeNull();
  });

  it('identifies known character-art operations', () => {
    expect(isCharacterArtOperationType('art:get-metadata')).toBe(true);
    expect(isCharacterArtOperationType('art:save')).toBe(true);
    expect(isCharacterArtOperationType('other:message')).toBe(false);
  });

  it('rejects matching operation types from other sources', () => {
    const request = asCharacterArtRequest({
      characterId: '169418374',
      source: 'other-extension',
      type: 'art:get-metadata',
    });

    expect(request).toBeNull();
  });
});
