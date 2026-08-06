import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {createFullscreenViewer} from '../../src/features/fullscreen-viewer/viewer';

describe('fullscreen viewer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-viewer-styles]')?.remove();
  });

  it('opens and restores focus on close', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);
    trigger.focus();

    const viewer = createFullscreenViewer(document);
    viewer.open({
      altText: 'Character portrait',
      imageUrl: 'https://example.com/portrait.png',
    }, trigger);

    const closeButton = document.querySelector<HTMLButtonElement>('.bfa-viewer-close');
    expect(closeButton).not.toBeNull();
    expect(document.activeElement).toBe(closeButton);

    viewer.close();

    expect(document.activeElement).toBe(trigger);
    viewer.destroy();
  });

  it('closes on backdrop click but not image click', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);

    const viewer = createFullscreenViewer(document);
    viewer.open({
      altText: 'Character portrait',
      imageUrl: 'https://example.com/portrait.png',
    }, trigger);

    const overlay = document.querySelector<HTMLDivElement>('.bfa-viewer-overlay');
    const image = document.querySelector<HTMLImageElement>('.bfa-viewer-image');
    expect(overlay).not.toBeNull();
    expect(image).not.toBeNull();

    image?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(viewer.isOpen()).toBe(true);

    overlay?.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    expect(viewer.isOpen()).toBe(false);
    viewer.destroy();
  });

  it('closes on escape', () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);

    const viewer = createFullscreenViewer(document);
    viewer.open({
      altText: 'Character portrait',
      imageUrl: 'https://example.com/portrait.png',
    }, trigger);

    const overlay = document.querySelector<HTMLDivElement>('.bfa-viewer-overlay');
    overlay?.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      key: 'Escape',
    }));

    expect(viewer.isOpen()).toBe(false);
    viewer.destroy();
  });

  it('renders a secondary action to the left of close and swaps back to fallback art', async () => {
    const trigger = document.createElement('button');
    document.body.append(trigger);

    const viewer = createFullscreenViewer(document);
    viewer.open({
      altText: 'Character portrait',
      imageUrl: 'https://example.com/stored.png',
      secondaryAction: {
        busyText: 'Removing...',
        onClick: async () => ({
          nextSource: {
            altText: 'Character portrait',
            imageUrl: 'https://example.com/fallback.png',
          },
        }),
        text: 'Remove stored full art',
      },
    }, trigger);

    const controlButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>('.bfa-viewer-controls button'),
    );
    const image = document.querySelector<HTMLImageElement>('.bfa-viewer-image');
    expect(controlButtons.map((button) => button.textContent)).toEqual([
      'Remove stored full art',
      'Close',
    ]);

    controlButtons[0]?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(image?.src).toBe('https://example.com/fallback.png');
    expect(
        document.querySelector<HTMLButtonElement>('.bfa-viewer-secondary-action')?.hidden,
    ).toBe(true);

    viewer.destroy();
  });
});
