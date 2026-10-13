import {describe, expect, it} from 'vitest';

import {
  asJournalImageRequest,
  isMalformedJournalImageMessage,
} from '../../src/platform/chrome/journal-messages';

describe('journal image messages', () => {
  it('accepts a journal photo save with matching bytes', () => {
    const byteBuffer = new Uint8Array([1, 2, 3, 4]).buffer;

    expect(asJournalImageRequest({
      blobKey: 'bfa.journal.image.photo-1',
      byteBase64: 'AQIDBA==',
      byteBuffer,
      byteSize: byteBuffer.byteLength,
      mimeType: 'image/png',
      source: 'beyond-full-art',
      type: 'journal:put-image',
    })?.type).toBe('journal:put-image');
  });

  it('rejects character-art blob keys and mismatched sizes', () => {
    const byteBuffer = new Uint8Array([1, 2]).buffer;

    expect(asJournalImageRequest({
      blobKey: 'character-art-blob',
      byteBuffer,
      byteSize: byteBuffer.byteLength,
      mimeType: 'image/png',
      source: 'beyond-full-art',
      type: 'journal:delete-image',
    })).toBeNull();
    expect(isMalformedJournalImageMessage({
      blobKey: 'bfa.journal.image.photo-1',
      byteBuffer,
      byteSize: 99,
      mimeType: 'image/png',
      source: 'beyond-full-art',
      type: 'journal:put-image',
    })).toBe(true);
    expect(isMalformedJournalImageMessage({
      source: 'beyond-full-art',
      type: 'art:save',
    })).toBe(false);
  });
});
