import {describe, expect, it} from 'vitest';

import {fitJournalImageEdge} from '../../src/features/character-journal/character-journal-image-fit';
import {validateJournalImageFile} from '../../src/features/character-journal/character-journal-types';
import {describeRejectedJournalImage} from '../../src/platform/chrome/journal-messages';

describe('journal image limits', () => {
  it('fits the long edge to 2048px and leaves a smaller image alone', () => {
    expect(fitJournalImageEdge(4000, 2000, 2048)).toEqual({height: 1024, width: 2048});
    expect(fitJournalImageEdge(800, 600, 2048)).toEqual({height: 600, width: 800});
  });

  it('accepts a file over 3 MB and names both sizes above 25 MB', () => {
    expect(validateJournalImageFile({
      name: 'scan.png',
      size: 4 * 1024 * 1024,
      type: 'image/png',
    })).toBeNull();
    expect(validateJournalImageFile({
      name: 'scan.png',
      size: 26 * 1024 * 1024,
      type: 'image/png',
    })).toBe('That image is 26 MB. The limit is 25 MB. The note was not changed.');
  });

  it('names the stored size when a message is over 3 MB', () => {
    const byteBuffer = new Uint8Array(4 * 1024 * 1024).buffer;
    expect(describeRejectedJournalImage({
      blobKey: 'bfa.journal.image.photo-1',
      byteBuffer,
      byteSize: byteBuffer.byteLength,
      mimeType: 'image/png',
      source: 'beyond-full-art',
      type: 'journal:put-image',
    })).toBe('That image is 4.0 MB. The limit is 3.0 MB. The note was not changed.');
  });
});
