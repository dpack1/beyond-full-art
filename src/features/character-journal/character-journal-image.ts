import type {SupportedCharacterArtMimeType} from '../character-art/art-types';
import {MAX_JOURNAL_IMAGE_STORED_BYTES} from './character-journal-types';
import {
  JOURNAL_IMAGE_MAX_EDGE_PX,
  fitJournalImageEdge,
  journalImageTooLargeMessage,
  type PreparedJournalImage,
} from './character-journal-image-fit';

export type {PreparedJournalImage} from './character-journal-image-fit';

export async function prepareJournalImageFile(file: File): Promise<PreparedJournalImage> {
  if (file.size <= MAX_JOURNAL_IMAGE_STORED_BYTES) {
    return {
      byteBuffer: await readFileBytes(file),
      byteSize: file.size,
      height: null,
      mimeType: file.type as SupportedCharacterArtMimeType,
      width: null,
    };
  }

  const scaled = await downscaleJournalImage(file);
  if (scaled.byteSize > MAX_JOURNAL_IMAGE_STORED_BYTES) {
    throw new Error(journalImageTooLargeMessage(
        scaled.byteSize,
        MAX_JOURNAL_IMAGE_STORED_BYTES,
        true,
    ));
  }

  return scaled;
}

async function downscaleJournalImage(file: File): Promise<PreparedJournalImage> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error(journalImageTooLargeMessage(file.size, MAX_JOURNAL_IMAGE_STORED_BYTES));
  }

  const bitmap = await createImageBitmap(file);
  try {
    const fitted = fitJournalImageEdge(bitmap.width, bitmap.height, JOURNAL_IMAGE_MAX_EDGE_PX);
    const canvas = document.createElement('canvas');
    canvas.width = fitted.width;
    canvas.height = fitted.height;
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error(journalImageTooLargeMessage(file.size, MAX_JOURNAL_IMAGE_STORED_BYTES));
    }

    context.drawImage(bitmap, 0, 0, fitted.width, fitted.height);
    const blob = await encodeFittedCanvas(canvas, file.size);
    return {
      byteBuffer: await blob.arrayBuffer(),
      byteSize: blob.size,
      height: fitted.height,
      mimeType: blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg',
      width: fitted.width,
    };
  } finally {
    bitmap.close();
  }
}

async function encodeFittedCanvas(canvas: HTMLCanvasElement, sourceSize: number): Promise<Blob> {
  let smallest: Blob | null = null;
  for (const quality of [0.85, 0.7, 0.55]) {
    for (const type of ['image/webp', 'image/jpeg'] as const) {
      const blob = await canvasToBlob(canvas, type, quality);
      if (blob === null || blob.size === 0) {
        continue;
      }

      if (smallest === null || blob.size < smallest.size) {
        smallest = blob;
      }

      if (blob.size <= MAX_JOURNAL_IMAGE_STORED_BYTES) {
        return blob;
      }
    }
  }

  if (smallest === null) {
    throw new Error(journalImageTooLargeMessage(sourceSize, MAX_JOURNAL_IMAGE_STORED_BYTES));
  }

  return smallest;
}

function canvasToBlob(
    canvas: HTMLCanvasElement,
    type: string,
    quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, type, quality);
  });
}

function readFileBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('error', () => {
      reject(new Error('Photo bytes could not be read.'));
    });
    reader.addEventListener('load', () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }

      reject(new Error('Photo bytes could not be read.'));
    });
    reader.readAsArrayBuffer(file);
  });
}
