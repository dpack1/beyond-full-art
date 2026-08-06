import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  installCharacterArtControls,
} from '../../src/features/character-art/upload-control';
import {err, ok} from '../../src/shared/result';
import {PORTRAIT_MANAGER_FIXTURE} from '../fixtures/portrait-manager';

describe('upload controls', () => {
  beforeEach(() => {
    document.body.innerHTML = PORTRAIT_MANAGER_FIXTURE;
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    vi.restoreAllMocks();
  });

  it('stays visually quiet when no stored art exists', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: async () => ok(null),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
          savePortraitCrop: async () => err('Not used'),
        },
        {openForCharacter: async () => ok(null)},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.textContent).not.toContain('Remove stored full art');
    expect(uploadSection?.querySelector('.bfa-art-sync__buttons')?.hasAttribute('hidden'))
        .toBe(true);
    expect(uploadSection?.querySelector('.bfa-art-sync__status')?.hasAttribute('hidden'))
        .toBe(true);
  });

  it('uses the light theme inside light portrait modals', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();

    uploadSection!.style.backgroundColor = 'rgb(255, 255, 255)';

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: async () => ok(null),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
          savePortraitCrop: async () => err('Not used'),
        },
        {openForCharacter: async () => ok(null)},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const controls = uploadSection?.querySelector('.bfa-art-sync');
    expect(controls).not.toBeNull();
    expect(controls?.classList.contains('bfa-art-sync--light')).toBe(true);
  });

  it('keeps the crop button hidden until a portrait file is selected', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: async () => ok({
            blobKey: 'blob-1',
            byteSize: 2048,
            characterId: '169418374',
            createdAt: '2026-08-06T00:00:00.000Z',
            fileName: 'zurelda.png',
            height: 1024,
            mimeType: 'image/png',
            schemaVersion: 1,
            updatedAt: '2026-08-06T00:00:00.000Z',
            width: 1024,
          }),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
          savePortraitCrop: async () => err('Not used'),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
        },
        {openForCharacter: async () => ok(null)},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.textContent).not.toContain('Create portrait crop');
    expect(uploadSection?.querySelector('.bfa-art-sync__status')?.hasAttribute('hidden'))
        .toBe(true);
  });

  it('shows a crop button after a portrait file is selected', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: async () => ok({
            blobKey: 'blob-1',
            byteSize: 2048,
            characterId: '169418374',
            createdAt: '2026-08-06T00:00:00.000Z',
            fileName: 'zurelda.png',
            height: 1024,
            mimeType: 'image/png',
            schemaVersion: 1,
            updatedAt: '2026-08-06T00:00:00.000Z',
            width: 1024,
          }),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
          savePortraitCrop: async () => err('Not used'),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
        },
        {openForCharacter: async () => ok(null)},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const file = new File(['image-bytes'], 'zurelda.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [file],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.textContent).toContain('Create portrait crop');
  });

  it('shows an edit label and success status after a crop workflow completes', async () => {
    const openForCharacter = vi.fn(async () => ok({
      message: 'Portrait crop saved locally and submitted to D&D Beyond.',
      tone: 'success' as const,
    }));
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();
    const file = new File(['image-bytes'], 'zurelda.png', {
      type: 'image/png',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [file],
    });

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok({
            blobKey: 'blob-crop-1',
            byteSize: 1024,
            characterId: '169418374',
            createdAt: '2026-08-06T00:00:00.000Z',
            cropRect: {
              height: 450,
              width: 450,
              x: 100,
              y: 25,
            },
            fileName: 'zurelda-portrait-crop.png',
            height: 512,
            mimeType: 'image/png',
            schemaVersion: 1,
            sourceArtBlobKey: 'blob-full-1',
            updatedAt: '2026-08-06T00:00:00.000Z',
            width: 512,
          }),
          getMetadata: async () => ok({
            blobKey: 'blob-full-1',
            byteSize: 2048,
            characterId: '169418374',
            createdAt: '2026-08-06T00:00:00.000Z',
            fileName: 'zurelda.png',
            height: 1024,
            mimeType: 'image/png',
            schemaVersion: 1,
            updatedAt: '2026-08-06T00:00:00.000Z',
            width: 1024,
          }),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
          savePortraitCrop: async () => err('Not used'),
        },
        {openForCharacter},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>('.bfa-art-sync__button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openForCharacter).toHaveBeenCalledWith('169418374', uploadInput);
    expect(uploadSection?.textContent).toContain('Edit portrait crop');
    expect(uploadSection?.textContent)
        .toContain('Portrait crop saved locally and submitted to D&D Beyond.');
  });

  it('saves selected portrait uploads locally', async () => {
    const saveArt = vi.fn(async () => ok({
      blobKey: 'blob-2',
      byteSize: 1024,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      fileName: 'zurelda.webp',
      height: 1200,
      mimeType: 'image/webp' as const,
      schemaVersion: 1 as const,
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 900,
    }));
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: async () => ok(null),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt,
          savePortraitCrop: async () => err('Not used'),
        },
        {openForCharacter: async () => ok(null)},
        '169418374',
        document,
    );

    const file = new File(['image-bytes'], 'zurelda.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [file],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saveArt).toHaveBeenCalledWith('169418374', file);
    expect(uploadSection?.textContent).toContain('Portrait saved locally as full art.');
  });
});
