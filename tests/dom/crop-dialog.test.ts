import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {openCropDialog} from '../../src/features/crop-workflow/crop-dialog';

describe('crop dialog', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  const originalDialogShowModal = HTMLDialogElement.prototype.showModal;
  const originalDialogClose = HTMLDialogElement.prototype.close;
  const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      'src',
  );

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-crop-dialog-styles]')?.remove();

    URL.createObjectURL = vi.fn(() => 'blob:test-crop');
    URL.revokeObjectURL = vi.fn();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function(callback) {
      callback(new Blob(['crop'], {type: 'image/png'}));
    };
    HTMLDialogElement.prototype.showModal = function() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function() {
      this.removeAttribute('open');
    };

    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      get() {
        return this.getAttribute('src') ?? '';
      },
      set(value: string) {
        this.setAttribute('src', value);
        Object.defineProperty(this, 'naturalHeight', {
          configurable: true,
          value: 1200,
        });
        Object.defineProperty(this, 'naturalWidth', {
          configurable: true,
          value: 900,
        });
        queueMicrotask(() => {
          this.dispatchEvent(new Event('load'));
        });
      },
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-crop-dialog-styles]')?.remove();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
    HTMLDialogElement.prototype.showModal = originalDialogShowModal;
    HTMLDialogElement.prototype.close = originalDialogClose;

    if (originalImageSrcDescriptor !== undefined) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', originalImageSrcDescriptor);
    }
  });

  it('stops apply clicks from bubbling through the page', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    let bodyClickCount = 0;
    document.body.addEventListener('click', () => {
      bodyClickCount += 1;
    });

    const resultPromise = openCropDialog({
      existingCropRect: null,
      sourceBlob: new Blob(['source'], {type: 'image/png'}),
      sourceFileName: 'portrait.png',
    }, document);

    await waitForMicrotasks();

    const applyButton = document.querySelector<HTMLButtonElement>('.bfa-crop-button--primary');
    expect(applyButton).not.toBeNull();

    applyButton?.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    }));

    const result = await resultPromise;

    expect(bodyClickCount).toBe(0);
    expect(result).not.toBeNull();
    expect(result?.cropFile.name).toBe('portrait-portrait-crop.png');
  });

  it('shows the source image inside the crop frame for live preview', async () => {
    void openCropDialog({
      existingCropRect: null,
      sourceBlob: new Blob(['source'], {type: 'image/png'}),
      sourceFileName: 'portrait.png',
    }, document);

    await waitForMicrotasks();

    const sourceImage = document.querySelector<HTMLImageElement>('.bfa-crop-image');
    expect(sourceImage).not.toBeNull();
    expect(sourceImage?.src).toBe('blob:test-crop');
  });
});

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
