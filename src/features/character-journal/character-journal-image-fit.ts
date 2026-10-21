export const JOURNAL_IMAGE_MAX_EDGE_PX = 2048;

export interface PreparedJournalImage {
  byteBuffer: ArrayBuffer;
  byteSize: number;
  height: number | null;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number | null;
}

export function fitJournalImageEdge(
    width: number,
    height: number,
    maxEdge: number,
): {height: number; width: number} {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) {
    return {height, width};
  }

  const scale = maxEdge / longest;
  return {
    height: Math.max(1, Math.round(height * scale)),
    width: Math.max(1, Math.round(width * scale)),
  };
}

export function journalImageStorageFullMessage(size: number): string {
  const megabytes = size / (1024 * 1024);
  const shown = megabytes >= 10 ? megabytes.toFixed(0) : megabytes.toFixed(1);
  return `That image is ${shown} MB. Extension storage is full (about 10 MB). The note was not changed.`;
}

export function journalImageTooLargeMessage(
    size: number,
    limit: number,
    afterResize = false,
): string {
  const resized = afterResize ? ' after resizing' : '';
  const megabytes = (bytes: number) => {
    const value = bytes / (1024 * 1024);
    return value >= 10 ? value.toFixed(0) : value.toFixed(1);
  };
  return `That image is ${megabytes(size)} MB${resized}. The limit is ${megabytes(limit)} MB. The note was not changed.`;
}
