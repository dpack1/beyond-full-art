import type {CharacterPortraitCropRect} from '../character-art/art-types';
import type {CropLayout, CropPresentation} from './crop-types';

export function clampCropPresentation(
    layout: CropLayout,
    presentation: CropPresentation,
): CropPresentation {
  const zoom = Math.max(1, presentation.zoom);
  const displayedHeight = layout.naturalHeight * getBaseScale(layout) * zoom;
  const displayedWidth = layout.naturalWidth * getBaseScale(layout) * zoom;
  const maxOffsetX = Math.max(0, (displayedWidth - layout.frameSize) / 2);
  const maxOffsetY = Math.max(0, (displayedHeight - layout.frameSize) / 2);

  return {
    offsetX: clampNumber(presentation.offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clampNumber(presentation.offsetY, -maxOffsetY, maxOffsetY),
    zoom,
  };
}

export function createCropRectFromPresentation(
    layout: CropLayout,
    presentation: CropPresentation,
): CharacterPortraitCropRect {
  const clampedPresentation = clampCropPresentation(layout, presentation);
  const renderScale = getBaseScale(layout) * clampedPresentation.zoom;
  const displayedHeight = layout.naturalHeight * renderScale;
  const displayedWidth = layout.naturalWidth * renderScale;
  const imageLeft = ((layout.frameSize - displayedWidth) / 2)
    + clampedPresentation.offsetX;
  const imageTop = ((layout.frameSize - displayedHeight) / 2)
    + clampedPresentation.offsetY;

  return {
    height: layout.frameSize / renderScale,
    width: layout.frameSize / renderScale,
    x: (0 - imageLeft) / renderScale,
    y: (0 - imageTop) / renderScale,
  };
}

export function createDefaultCropPresentation(
    _layout: CropLayout,
): CropPresentation {
  return {
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  };
}

export function createPresentationFromCropRect(
    layout: CropLayout,
    cropRect: CharacterPortraitCropRect,
): CropPresentation {
  const baseScale = getBaseScale(layout);
  const zoom = layout.frameSize / (baseScale * cropRect.width);
  const renderScale = baseScale * zoom;
  const displayedHeight = layout.naturalHeight * renderScale;
  const displayedWidth = layout.naturalWidth * renderScale;
  const centeredLeft = (layout.frameSize - displayedWidth) / 2;
  const centeredTop = (layout.frameSize - displayedHeight) / 2;

  return clampCropPresentation(layout, {
    offsetX: (-cropRect.x * renderScale) - centeredLeft,
    offsetY: (-cropRect.y * renderScale) - centeredTop,
    zoom,
  });
}

export function getBaseScale(layout: CropLayout): number {
  return Math.max(
      layout.frameSize / layout.naturalWidth,
      layout.frameSize / layout.naturalHeight,
  );
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
