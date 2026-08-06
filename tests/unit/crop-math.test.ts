import {describe, expect, it} from 'vitest';

import {
  clampCropPresentation,
  createCropRectFromPresentation,
  createPresentationFromCropRect,
} from '../../src/features/crop-workflow/crop-math';

describe('crop math', () => {
  const layout = {
    frameSize: 320,
    naturalHeight: 800,
    naturalWidth: 600,
  };

  it('clamps crop presentation to keep the frame covered', () => {
    const clamped = clampCropPresentation(layout, {
      offsetX: 999,
      offsetY: -999,
      zoom: 0.4,
    });

    expect(clamped.zoom).toBe(1);
    expect(clamped.offsetX).toBeLessThanOrEqual(0);
    expect(clamped.offsetY).toBeGreaterThanOrEqual(-53.4);
  });

  it('round-trips crop presentation through crop rect conversion', () => {
    const cropRect = createCropRectFromPresentation(layout, {
      offsetX: 22,
      offsetY: -35,
      zoom: 1.25,
    });

    const presentation = createPresentationFromCropRect(layout, cropRect);

    expect(presentation.zoom).toBeCloseTo(1.25, 4);
    expect(presentation.offsetX).toBeCloseTo(22, 4);
    expect(presentation.offsetY).toBeCloseTo(-35, 4);
  });
});
