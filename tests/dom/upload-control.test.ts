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
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();

    installCharacterArtControls(
        {manager: manager!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getMetadata: async () => ok(null),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
        },
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.textContent).not.toContain('Remove stored full art');
    expect(uploadSection?.querySelector('.bfa-art-sync__buttons')).toBeNull();
    expect(uploadSection?.querySelector('.bfa-art-sync__status')?.hasAttribute('hidden'))
        .toBe(true);
  });

  it('uses the light theme inside light portrait modals', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();

    uploadSection!.style.backgroundColor = 'rgb(255, 255, 255)';

    installCharacterArtControls(
        {manager: manager!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getMetadata: async () => ok(null),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt: async () => err('Not used'),
        },
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const controls = uploadSection?.querySelector('.bfa-art-sync');
    expect(controls).not.toBeNull();
    expect(controls?.classList.contains('bfa-art-sync--light')).toBe(true);
  });

  it('stays quiet when stored art exists', async () => {
    const manager = document.querySelector<HTMLElement>('.ct-decoration-manager');
    const uploadSection = document.querySelector<HTMLElement>('.ct-decoration-manager__upload');
    expect(manager).not.toBeNull();
    expect(uploadSection).not.toBeNull();

    installCharacterArtControls(
        {manager: manager!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
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
        },
        '169418374',
        document,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadSection?.textContent).not.toContain('Remove stored full art');
    expect(uploadSection?.querySelector('.bfa-art-sync__status')?.hasAttribute('hidden'))
        .toBe(true);
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
        {manager: manager!, uploadSection: uploadSection!},
        {
          deleteArt: async () => ok(undefined),
          getMetadata: async () => ok(null),
          resolveViewerImage: async () => ({
            altText: 'fallback',
            imageUrl: 'https://example.com/fallback.png',
            usingStoredArt: false,
            warningMessage: null,
          }),
          saveArt,
        },
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
