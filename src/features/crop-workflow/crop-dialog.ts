import cropDialogStyles from './crop-dialog.css?raw';
import {createPortraitCropFileName} from '../character-art/art-service';
import {
  PORTRAIT_CROP_OUTPUT_SIZE,
  type CharacterPortraitCropRect,
} from '../character-art/art-types';
import {
  clampCropPresentation,
  createCropRectFromPresentation,
  createDefaultCropPresentation,
  createPresentationFromCropRect,
  getBaseScale,
} from './crop-math';
import type {CropDialogResult, CropLayout, CropPresentation} from './crop-types';
import {restoreFocus, trapTabKey} from '../fullscreen-viewer/focus';
import {CROP_DIALOG_STYLE_ATTRIBUTE_NAME} from '../../platform/dndbeyond/selectors';

interface OpenCropDialogOptions {
  existingCropRect: CharacterPortraitCropRect | null;
  sourceBlob: Blob;
  sourceFileName: string;
}

export async function openCropDialog(
    options: OpenCropDialogOptions,
    doc: Document = document,
): Promise<CropDialogResult | null> {
  ensureCropDialogStyles(doc);
  const sourceUrl = createObjectUrl(options.sourceBlob);
  const previousActiveElement = doc.activeElement;
  const previousBodyOverflow = doc.body.style.overflow;
  const elements = createElements(doc);
  const image = await loadImage(sourceUrl, doc);
  const layout: CropLayout = {
    frameSize: 320,
    naturalHeight: image.naturalHeight,
    naturalWidth: image.naturalWidth,
  };
  const state = {
    dragging: null as {pointerX: number; pointerY: number; start: CropPresentation} | null,
    presentation: options.existingCropRect === null
      ? createDefaultCropPresentation(layout)
      : createPresentationFromCropRect(layout, options.existingCropRect),
  };
  elements.sourceImage.src = sourceUrl;

  return new Promise<CropDialogResult | null>((resolve, reject) => {
    const render = () => {
      const clamped = clampCropPresentation(layout, state.presentation);
      const scale = getBaseScale(layout) * clamped.zoom;
      const displayedHeight = layout.naturalHeight * scale;
      const displayedWidth = layout.naturalWidth * scale;
      elements.sourceImage.style.height = `${displayedHeight}px`;
      elements.sourceImage.style.left =
        `${((layout.frameSize - displayedWidth) / 2) + clamped.offsetX}px`;
      elements.sourceImage.style.top =
        `${((layout.frameSize - displayedHeight) / 2) + clamped.offsetY}px`;
      elements.sourceImage.style.width = `${displayedWidth}px`;
      elements.zoomInput.value = clamped.zoom.toFixed(2);
    };

    doc.body.style.overflow = 'hidden';
    openOverlay(elements.overlay);
    render();
    elements.closeButton.focus();

    const close = (result: CropDialogResult | null) => {
      cleanup();
      resolve(result);
    };

    const fail = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      doc.body.style.overflow = previousBodyOverflow;
      restoreFocus(previousActiveElement);
      closeOverlay(elements.overlay);
      elements.overlay.remove();
      revokeObjectUrl(sourceUrl);
      if (doc.querySelector(`[${CROP_DIALOG_STYLE_ATTRIBUTE_NAME}]`) === null) {
        removeCropDialogStyles(doc);
      }
    };

    const updatePresentation = (next: CropPresentation) => {
      state.presentation = clampCropPresentation(layout, next);
      render();
    };

    const onPointerDown = (event: PointerEvent) => {
      elements.frame.setPointerCapture(event.pointerId);
      state.dragging = {
        pointerX: event.clientX,
        pointerY: event.clientY,
        start: state.presentation,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      if (state.dragging === null) {
        return;
      }

      updatePresentation({
        offsetX: state.dragging.start.offsetX + (event.clientX - state.dragging.pointerX),
        offsetY: state.dragging.start.offsetY + (event.clientY - state.dragging.pointerY),
        zoom: state.dragging.start.zoom,
      });
    };

    const onPointerUp = () => {
      state.dragging = null;
    };

    elements.closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      close(null);
    });
    elements.applyButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        close(await buildCropResult(
            image,
            options.sourceFileName,
            layout,
            state.presentation,
            doc,
        ));
      } catch (error) {
        fail(asError(error, 'Portrait crop could not be generated.'));
      }
    });
    elements.overlay.addEventListener('click', (event) => {
      event.stopPropagation();
      if (event.target === elements.overlay) {
        close(null);
      }
    });
    elements.overlay.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    elements.overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close(null);
        return;
      }

      event.stopPropagation();
      trapTabKey(event, elements.dialog);
    });
    elements.dialog.addEventListener('click', (event) => {
      event.stopPropagation();
    });
    elements.dialog.addEventListener('mousedown', (event) => {
      event.stopPropagation();
    });
    elements.zoomInput.addEventListener('input', () => {
      const zoom = Number.parseFloat(elements.zoomInput.value);
      updatePresentation({
        ...state.presentation,
        zoom,
      });
    });
    elements.frame.addEventListener('pointerdown', onPointerDown);
    elements.frame.addEventListener('pointermove', onPointerMove);
    elements.frame.addEventListener('pointerup', onPointerUp);
    elements.frame.addEventListener('pointercancel', onPointerUp);
  });
}

async function buildCropResult(
    image: HTMLImageElement,
    sourceFileName: string,
    layout: CropLayout,
    presentation: CropPresentation,
    doc: Document,
): Promise<CropDialogResult> {
  const cropRect = createCropRectFromPresentation(layout, presentation);
  const canvas = doc.createElement('canvas');
  canvas.height = PORTRAIT_CROP_OUTPUT_SIZE;
  canvas.width = PORTRAIT_CROP_OUTPUT_SIZE;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Canvas rendering is unavailable.');
  }

  context.drawImage(
      image,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      PORTRAIT_CROP_OUTPUT_SIZE,
      PORTRAIT_CROP_OUTPUT_SIZE,
  );

  const blob = await canvasToBlob(canvas);
  return {
    cropFile: new File([blob], createPortraitCropFileName(sourceFileName), {
      type: 'image/png',
    }),
    cropRect,
    height: PORTRAIT_CROP_OUTPUT_SIZE,
    width: PORTRAIT_CROP_OUTPUT_SIZE,
  };
}

function createElements(doc: Document) {
  const overlay = doc.createElement('dialog');
  overlay.className = 'bfa-crop-overlay';
  overlay.setAttribute('aria-label', 'Crop portrait');
  overlay.setAttribute('aria-modal', 'true');

  const dialog = doc.createElement('div');
  dialog.className = 'bfa-crop-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.tabIndex = -1;

  const closeButton = createButton(doc, 'Close', 'bfa-crop-button bfa-crop-button--subtle');
  const applyButton = createButton(doc, 'Apply Portrait Crop', 'bfa-crop-button bfa-crop-button--primary');
  const sourceImage = doc.createElement('img');
  sourceImage.className = 'bfa-crop-image';
  sourceImage.alt = '';
  sourceImage.draggable = false;
  const zoomInput = doc.createElement('input');
  zoomInput.className = 'bfa-crop-slider';
  zoomInput.max = '3';
  zoomInput.min = '1';
  zoomInput.step = '0.01';
  zoomInput.type = 'range';

  const frame = doc.createElement('div');
  frame.className = 'bfa-crop-frame';
  frame.append(sourceImage);

  dialog.innerHTML = `
    <div class="bfa-crop-header">
      <div>
        <h2 class="bfa-crop-title">Portrait Crop</h2>
        <p class="bfa-crop-copy">Drag the artwork behind the square frame, then zoom until the portrait looks right.</p>
      </div>
    </div>
  `;

  const body = doc.createElement('div');
  body.className = 'bfa-crop-body';
  const stage = doc.createElement('div');
  stage.className = 'bfa-crop-stage';
  stage.append(frame);
  const controls = doc.createElement('div');
  controls.className = 'bfa-crop-toolbar';
  const zoomLabel = doc.createElement('p');
  zoomLabel.className = 'bfa-crop-label';
  zoomLabel.textContent = 'Zoom';
  controls.append(zoomLabel, zoomInput);
  body.append(stage, controls);

  const footer = doc.createElement('div');
  footer.className = 'bfa-crop-footer';
  footer.append(closeButton, applyButton);

  dialog.append(body, footer);
  overlay.append(dialog);
  doc.body.append(overlay);

  return {
    applyButton,
    closeButton,
    dialog,
    frame,
    overlay,
    sourceImage,
    zoomInput,
  };
}

function openOverlay(overlay: HTMLDialogElement): void {
  if (typeof overlay.showModal === 'function') {
    if (!overlay.open) {
      overlay.showModal();
    }
    return;
  }

  overlay.setAttribute('open', '');
}

function closeOverlay(overlay: HTMLDialogElement): void {
  if (typeof overlay.close === 'function') {
    if (overlay.open) {
      overlay.close();
    }
    return;
  }

  overlay.removeAttribute('open');
}

function createButton(
    doc: Document,
    label: string,
    className: string,
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.className = className;
  button.textContent = label;
  button.type = 'button';
  return button;
}

function ensureCropDialogStyles(doc: Document): void {
  if (doc.head.querySelector(`[${CROP_DIALOG_STYLE_ATTRIBUTE_NAME}]`) !== null) {
    return;
  }

  const styleElement = doc.createElement('style');
  styleElement.setAttribute(CROP_DIALOG_STYLE_ATTRIBUTE_NAME, 'true');
  styleElement.textContent = cropDialogStyles;
  doc.head.append(styleElement);
}

function removeCropDialogStyles(doc: Document): void {
  doc.head.querySelector(`[${CROP_DIALOG_STYLE_ATTRIBUTE_NAME}]`)?.remove();
}

function createObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

function revokeObjectUrl(objectUrl: string): void {
  URL.revokeObjectURL(objectUrl);
}

function loadImage(sourceUrl: string, doc: Document): Promise<HTMLImageElement> {
  const image = doc.createElement('img');
  return new Promise((resolve, reject) => {
    image.onerror = () => {
      reject(new Error('Stored full art could not be loaded for cropping.'));
    };
    image.onload = () => {
      resolve(image);
    };
    image.src = sourceUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error('Canvas output could not be created.'));
        return;
      }

      resolve(blob);
    }, 'image/png');
  });
}

function asError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(fallbackMessage);
}
