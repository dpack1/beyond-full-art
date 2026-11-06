import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {
  installCharacterArtControls,
} from '../../src/features/character-art/upload-control';
import {
  submitFileToPortraitUploadInput,
} from '../../src/platform/dndbeyond/portrait-upload-handoff';
import {FOLDER_LIBRARY_BLOCKED_MESSAGE} from '../../src/platform/chrome/library-mode';
import {err, ok} from '../../src/shared/result';
import {PORTRAIT_MANAGER_FIXTURE} from '../fixtures/portrait-manager';

describe('upload controls', () => {
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(() => {
    document.body.innerHTML = PORTRAIT_MANAGER_FIXTURE;
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    URL.createObjectURL = vi.fn(() => 'blob:proposed-full-art');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.querySelector('[data-bfa-art-styles]')?.remove();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
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

  it('uses a compact button stack in a narrow sidebar', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();

    Object.defineProperty(manager!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: 420,
        height: 420,
        left: 0,
        right: 420,
        top: 0,
        width: 420,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      }),
    });

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
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
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

    const controls = uploadSection?.querySelector<HTMLElement>('.bfa-art-sync');
    const helperCopy = manager?.querySelector<HTMLElement>(
        '.ct-decoration-manager__upload-heading-rules',
    );
    const fullArtPreview = manager?.querySelector('.bfa-art-sync__preview');
    const selectedRow = uploadSection?.querySelector<HTMLElement>(
        '.ct-decoration-manager__selected',
    );

    const cropButton = uploadSection?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');

    expect(controls?.classList.contains('bfa-art-sync--compact')).toBe(true);
    expect(helperCopy?.textContent).toBe('150 x 150 recommended, 3 MB max');
    expect(fullArtPreview).toBeNull();
    expect(selectedRow?.style.getPropertyValue('width')).toBe('100%');
    expect(cropButton?.style.getPropertyValue('white-space')).toBe('normal');
    expect(cropButton?.style.getPropertyValue('min-width')).toBe('0');
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
            altText: 'stored full art',
            imageUrl: 'blob:current-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
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

    expect(uploadSection?.textContent).not.toContain('Crop portrait');
    expect(uploadSection?.querySelector('.bfa-art-sync__status')?.hasAttribute('hidden'))
        .toBe(true);
    expect(manager?.textContent).not.toContain('Current Full Art');
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
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
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

    const changePortraitActions = uploadSection?.querySelector<HTMLElement>(
        '.ct-decoration-manager__selected-actions',
    );
    const changePortraitButton = changePortraitActions?.querySelector<HTMLButtonElement>(
        ':scope > button',
    );
    const cropButton = uploadSection?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');
    const selectedRow = uploadSection?.querySelector<HTMLElement>(
        '.ct-decoration-manager__selected',
    );

    const nativePreview = selectedRow?.querySelector<HTMLElement>(
        '.bfa-art-sync__selected-preview-container',
    );
    const nativePreviewImage = nativePreview?.querySelector('img');

    expect(changePortraitActions?.contains(cropButton ?? null)).toBe(true);
    expect(cropButton?.textContent).toContain('Crop portrait');
    expect(cropButton?.className).toContain('Button_button__KOWRe');
    expect(cropButton?.style.getPropertyValue('width')).toBe('100%');
    expect(cropButton?.style.getPropertyValue('white-space')).toBe('nowrap');
    expect(cropButton?.style.getPropertyValue('min-width')).toBe('max-content');
    expect(changePortraitButton?.style.getPropertyValue('width')).toBe('100%');
    expect(changePortraitButton?.style.getPropertyValue('white-space')).toBe('nowrap');
    expect(selectedRow?.style.getPropertyValue('width')).toBe('max-content');
    expect(selectedRow?.style.getPropertyValue('grid-template-columns')).toBe('max-content');
    expect(nativePreview?.style.getPropertyValue('width')).toBe('max-content');
    expect(nativePreviewImage?.style.getPropertyValue('width')).toBe('150px');
    expect(nativePreviewImage?.style.getPropertyValue('height')).toBe('150px');
    expect(nativePreviewImage?.style.getPropertyValue('object-fit')).toBe('cover');
    expect(nativePreviewImage?.style.getPropertyValue('object-position')).toBe('center');
    expect(manager?.querySelector('.bfa-art-sync__preview')).toBeNull();
  });

  it('shows the crop button when a file is selected and the folder cannot be read', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    const uploadInput = document.querySelector<HTMLInputElement>(
        '.ct-decoration-manager__upload-file-input',
    );
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();
    expect(uploadInput).not.toBeNull();
    const openForCharacter = vi.fn(async () => ok(null));

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: async () => err(FOLDER_LIBRARY_BLOCKED_MESSAGE),
          resolveViewerImage: async () => ({
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
          savePortraitCrop: async () => err('Not used'),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
        },
        {openForCharacter},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const file = new File(['image-bytes'], 'Matilda.png', {
      type: 'image/png',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [file],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const cropButton = uploadSection?.querySelector<HTMLButtonElement>('.bfa-art-sync__button');
    expect(cropButton?.textContent).toContain('Crop portrait');
    expect(uploadSection?.textContent).toContain(FOLDER_LIBRARY_BLOCKED_MESSAGE);

    cropButton?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openForCharacter).toHaveBeenCalledWith('169418374', uploadInput, {
      existingCropRect: null,
      selectedFile: file,
    });
  });

  it('keeps the selected portrait when the crop workflow writes the upload input', async () => {
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
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
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

    const selectedFile = new File(['image-bytes'], 'zurelda.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [selectedFile],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.querySelector('.bfa-art-sync__preview')).toBeNull();

    const croppedFile = new File(['cropped-image-bytes'], 'zurelda-portrait-crop.png', {
      type: 'image/png',
    });
    submitFileToPortraitUploadInput(uploadInput!, croppedFile, document);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.querySelector('.bfa-art-sync__preview')).toBeNull();
    expect(uploadSection?.textContent).toContain('Crop portrait');
  });

  it('shows an edit label and success status after a crop workflow completes', async () => {
    const openForCharacter = vi.fn(async () => ok({
      cropResult: {
        cropFile: new File(['crop'], 'zurelda-portrait-crop.png', {type: 'image/png'}),
        cropRect: {
          height: 450,
          width: 450,
          x: 100,
          y: 25,
        },
        height: 512,
        width: 512,
      },
      message: 'Portrait crop is ready in D&D Beyond. Click Change Portrait to finish.',
      savedLocally: false,
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
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
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

    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>('.bfa-art-sync__button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openForCharacter).toHaveBeenCalledWith('169418374', uploadInput, {
      existingCropRect: null,
      selectedFile: file,
    });
    expect(uploadSection?.textContent).toContain('Edit portrait crop');
    expect(uploadSection?.textContent)
        .toContain('Portrait crop is ready in D&D Beyond. Click Change Portrait to finish.');
  });

  it('does not save selected portrait uploads until change portrait is clicked', async () => {
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

    expect(saveArt).not.toHaveBeenCalled();
    expect(uploadSection?.querySelector('.bfa-art-sync__preview')).toBeNull();
    expect(uploadSection?.textContent).toContain('Crop portrait');
  });

  it('saves selected portrait uploads locally after change portrait is clicked', async () => {
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

    uploadSection?.querySelector<HTMLButtonElement>('.ct-decoration-manager__selected-actions > button')
        ?.click();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saveArt).toHaveBeenCalledWith('169418374', file, null);
    expect(uploadSection?.textContent).toContain('Portrait saved locally as full art.');
  });

  it('saves a prepared crop against the newly committed full-art blob key', async () => {
    const saveArt = vi.fn(async () => ok({
      blobKey: 'blob-full-2',
      byteSize: 1024,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      fileName: 'second.webp',
      height: 1200,
      mimeType: 'image/webp' as const,
      schemaVersion: 1 as const,
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 900,
    }));
    const savePortraitCrop = vi.fn(async () => ok({
      blobKey: 'blob-crop-2',
      byteSize: 512,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      cropRect: {
        height: 450,
        width: 450,
        x: 100,
        y: 25,
      },
      fileName: 'second-portrait-crop.png',
      height: 512,
      mimeType: 'image/png' as const,
      schemaVersion: 1 as const,
      sourceArtBlobKey: 'blob-full-2',
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 512,
    }));
    const openForCharacter = vi.fn(async () => ok({
      cropResult: {
        cropFile: new File(['crop-2'], 'second-portrait-crop.png', {type: 'image/png'}),
        cropRect: {
          height: 450,
          width: 450,
          x: 100,
          y: 25,
        },
        height: 512,
        width: 512,
      },
      message: 'Portrait crop is ready in D&D Beyond. Click Change Portrait to finish.',
      savedLocally: false,
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

    installCharacterArtControls(
        {manager: manager!, uploadInput: uploadInput!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getCropMetadata: async () => ok(null),
          getMetadata: vi
              .fn()
              .mockResolvedValueOnce(ok({
                blobKey: 'blob-full-1',
                byteSize: 1024,
                characterId: '169418374',
                createdAt: '2026-08-06T00:00:00.000Z',
                fileName: 'first.webp',
                height: 1200,
                mimeType: 'image/webp',
                schemaVersion: 1,
                updatedAt: '2026-08-06T00:00:00.000Z',
                width: 900,
              }))
              .mockResolvedValueOnce(ok({
                blobKey: 'blob-full-2',
                byteSize: 1024,
                characterId: '169418374',
                createdAt: '2026-08-06T00:00:00.000Z',
                fileName: 'second.webp',
                height: 1200,
                mimeType: 'image/webp',
                schemaVersion: 1,
                updatedAt: '2026-08-06T00:00:00.000Z',
                width: 900,
              }))
              .mockResolvedValue(ok({
                blobKey: 'blob-full-2',
                byteSize: 1024,
                characterId: '169418374',
                createdAt: '2026-08-06T00:00:00.000Z',
                fileName: 'second.webp',
                height: 1200,
                mimeType: 'image/webp',
                schemaVersion: 1,
                updatedAt: '2026-08-06T00:00:00.000Z',
                width: 900,
              })),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage: async () => ({
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
            warningMessage: null,
          }),
          saveArt,
          savePortraitCrop,
        },
        {openForCharacter},
        '169418374',
        document,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const selectedFile = new File(['image-bytes'], 'second.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [selectedFile],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>('.bfa-art-sync__button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(openForCharacter).toHaveBeenCalledTimes(1);

    uploadSection?.querySelector<HTMLButtonElement>('.ct-decoration-manager__selected-actions > button')
        ?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(savePortraitCrop).toHaveBeenCalledWith(expect.objectContaining({
      characterId: '169418374',
      fileName: 'second-portrait-crop.png',
      sourceArtBlobKey: 'blob-full-2',
    }));
    expect(uploadSection?.textContent).toContain('Portrait and crop saved locally.');
  });

  it('reloads the stored full-art revision after change portrait commits a replacement', async () => {
    const saveArt = vi.fn(async () => ok({
      blobKey: 'blob-2',
      byteSize: 1024,
      characterId: '169418374',
      createdAt: '2026-08-06T00:00:00.000Z',
      fileName: 'second.webp',
      height: 1200,
      mimeType: 'image/webp' as const,
      schemaVersion: 1 as const,
      updatedAt: '2026-08-06T00:00:00.000Z',
      width: 900,
    }));
    const resolveViewerImage = vi
        .fn()
        .mockResolvedValueOnce({
          altText: 'stored full art',
          imageUrl: 'blob:first-full-art',
          releaseImageUrl: () => {},
          sha256: '1'.repeat(64),
          usingStoredArt: true,
          warningMessage: null,
        })
        .mockResolvedValueOnce({
          altText: 'stored full art',
          imageUrl: 'blob:second-full-art',
          releaseImageUrl: () => {},
          sha256: '2'.repeat(64),
          usingStoredArt: true,
          warningMessage: null,
        });
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
          getMetadata: vi
              .fn()
              .mockResolvedValueOnce(ok({
                blobKey: 'blob-1',
                byteSize: 2048,
                characterId: '169418374',
                createdAt: '2026-08-06T00:00:00.000Z',
                fileName: 'first.png',
                height: 1024,
                mimeType: 'image/png',
                schemaVersion: 1,
                updatedAt: '2026-08-06T00:00:00.000Z',
                width: 1024,
              }))
              .mockResolvedValueOnce(ok({
                blobKey: 'blob-2',
                byteSize: 2048,
                characterId: '169418374',
                createdAt: '2026-08-06T00:00:00.000Z',
                fileName: 'second.webp',
                height: 1200,
                mimeType: 'image/webp',
                schemaVersion: 1,
                updatedAt: '2026-08-06T00:00:00.000Z',
                width: 900,
              }))
              .mockResolvedValue(ok({
                blobKey: 'blob-2',
                byteSize: 2048,
                characterId: '169418374',
                createdAt: '2026-08-06T00:00:00.000Z',
                fileName: 'second.webp',
                height: 1200,
                mimeType: 'image/webp',
                schemaVersion: 1,
                updatedAt: '2026-08-06T00:00:00.000Z',
                width: 900,
              })),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage,
          saveArt,
          savePortraitCrop: async () => err('Not used'),
        },
        {openForCharacter: async () => ok(null)},
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const replacementFile = new File(['image-bytes'], 'second.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [replacementFile],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));

    await new Promise((resolve) => setTimeout(resolve, 0));

    uploadSection?.querySelector<HTMLButtonElement>('.ct-decoration-manager__selected-actions > button')
        ?.click();

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(saveArt).toHaveBeenCalledWith(
        '169418374', replacementFile, '1'.repeat(64),
    );
    expect(resolveViewerImage).toHaveBeenCalledTimes(2);
    expect(manager?.querySelector('.bfa-art-sync__preview')).toBeNull();
  });

  it('uses the newly selected file as the crop source and clears the old crop state', async () => {
    const openForCharacter = vi
        .fn()
        .mockResolvedValueOnce(ok({
          cropResult: {
            cropFile: new File(['crop-1'], 'first-portrait-crop.png', {type: 'image/png'}),
            cropRect: {
              height: 450,
              width: 450,
              x: 100,
              y: 25,
            },
            height: 512,
            width: 512,
          },
          message: 'Portrait crop is ready in D&D Beyond. Click Change Portrait to finish.',
          savedLocally: false,
          tone: 'success' as const,
        }))
        .mockResolvedValueOnce(ok({
          cropResult: {
            cropFile: new File(['crop-2'], 'second-portrait-crop.png', {type: 'image/png'}),
            cropRect: {
              height: 500,
              width: 500,
              x: 50,
              y: 50,
            },
            height: 512,
            width: 512,
          },
          message: 'Portrait crop is ready in D&D Beyond. Click Change Portrait to finish.',
          savedLocally: false,
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
            fileName: 'stored-portrait-crop.png',
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
            fileName: 'stored.png',
            height: 1024,
            mimeType: 'image/png',
            schemaVersion: 1,
            updatedAt: '2026-08-06T00:00:00.000Z',
            width: 1024,
          }),
          getPortraitCropImageData: async () => ok(null),
          loadCropSource: async () => err('Not used'),
          resolveViewerImage: async () => ({
            altText: 'stored full art',
            imageUrl: 'blob:stored-full-art',
            releaseImageUrl: () => {},
            usingStoredArt: true,
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

    const firstSelectedFile = new File(['first'], 'first.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [firstSelectedFile],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.querySelector<HTMLButtonElement>('.bfa-art-sync__button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const secondSelectedFile = new File(['second'], 'second.webp', {
      type: 'image/webp',
    });
    Object.defineProperty(uploadInput!, 'files', {
      configurable: true,
      value: [secondSelectedFile],
    });
    uploadInput!.dispatchEvent(new Event('change', {bubbles: true}));
    await new Promise((resolve) => setTimeout(resolve, 0));

    document.querySelector<HTMLButtonElement>('.bfa-art-sync__button')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(openForCharacter).toHaveBeenNthCalledWith(1, '169418374', uploadInput, {
      existingCropRect: null,
      selectedFile: firstSelectedFile,
    });
    expect(openForCharacter).toHaveBeenNthCalledWith(2, '169418374', uploadInput, {
      existingCropRect: null,
      selectedFile: secondSelectedFile,
    });
  });

  it('places the crop button when the native confirm row appears shortly after file selection', async () => {
    vi.useFakeTimers();
    try {
      const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
      const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
      const uploadInput = document.querySelector<HTMLInputElement>(
          '.ct-decoration-manager__upload-file-input',
      );
      const delayedSelectedRow = uploadSection?.querySelector<HTMLElement>(
          '.ct-decoration-manager__selected',
      );
      expect(manager).not.toBeNull();
      expect(uploadSection).not.toBeNull();
      expect(uploadInput).not.toBeNull();
      expect(delayedSelectedRow).not.toBeNull();

      delayedSelectedRow?.remove();

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
            getPortraitCropImageData: async () => ok(null),
            loadCropSource: async () => err('Not used'),
            resolveViewerImage: async () => ({
              altText: 'stored full art',
              imageUrl: 'blob:stored-full-art',
              releaseImageUrl: () => {},
              usingStoredArt: true,
              sha256: 'a'.repeat(64),
              warningMessage: null,
            }),
            saveArt: async () => err('Not used'),
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

      setTimeout(() => {
        uploadSection!.append(delayedSelectedRow!);
      }, 10);

      await vi.advanceTimersByTimeAsync(300);

      const cropButton = delayedSelectedRow?.querySelector('.bfa-art-sync__button');
      expect(cropButton?.textContent).toContain('Crop portrait');
      expect(uploadSection?.querySelector('.bfa-art-sync__preview')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
