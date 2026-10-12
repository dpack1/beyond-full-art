import {
  createCharacterArtService,
  type CharacterArtService,
} from '../features/character-art/art-service';
import {createCharacterPortraitCropWorkflow} from '../features/crop-workflow/crop-workflow';
import {
  installCharacterArtControls,
  type CharacterArtControlsController,
} from '../features/character-art/upload-control';
import {
  createFullscreenViewer,
  type ViewerAction,
  type ViewerImageSource,
  type ViewerActionResult,
} from '../features/fullscreen-viewer/viewer';
import {observePortraitManagementTargets} from '../platform/dndbeyond/portrait-manager-adapter';
import {
  ENHANCED_ATTRIBUTE_NAME,
  PANEL_PORTRAIT_TRIGGER_CLASS_NAME,
} from '../platform/dndbeyond/selectors';
import {
  observePanelPortraits,
  type PortraitTarget,
} from '../platform/dndbeyond/portrait-adapter';
import {
  isCharacterPageUrl,
  parseCharacterIdFromCharacterPageUrl,
} from '../platform/dndbeyond/urls';
import {
  createCharacterArtDownloadFileName,
  downloadBlobUrl,
} from '../shared/download';
import {isKeyboardActivationKey} from '../shared/dom';
import type {Cleanup} from '../shared/types';

interface ElementStateSnapshot {
  ariaHaspopup: string | null;
  ariaLabel: string | null;
  role: string | null;
  tabIndex: string | null;
}

export function installCharacterSheetEnhancement(
    doc: Document = document,
): Cleanup {
  const currentUrl = new URL(doc.location.href);
  if (!isCharacterPageUrl(currentUrl)) {
    return () => {};
  }

  const characterId = parseCharacterIdFromCharacterPageUrl(currentUrl);
  if (characterId === null) {
    return () => {};
  }

  const artService = createCharacterArtService(doc);
  const cropWorkflow = createCharacterPortraitCropWorkflow(artService, doc);
  const viewer = createFullscreenViewer(doc);
  const cleanups = new Set<Cleanup>();
  let activeControls: CharacterArtControlsController | null = null;
  const getActiveControls = () => activeControls;

  const stopObservingPortraitManagers = observePortraitManagementTargets((target) => {
    const controls = installCharacterArtControls(
        target,
        artService,
        cropWorkflow,
        characterId,
        doc,
    );
    activeControls = controls;
    cleanups.add(() => {
      if (activeControls === controls) {
        activeControls = null;
      }
      controls.cleanup();
    });
  }, doc);

  const stopObserving = observePanelPortraits((target) => {
    if (target.clickSurface.getAttribute(ENHANCED_ATTRIBUTE_NAME) === 'true') {
      return;
    }

    const cleanup = enhancePortraitTarget(
        target,
        viewer,
        characterId,
        artService,
        getActiveControls,
    );
    cleanups.add(() => {
      cleanup();
    });
  }, doc);

  return () => {
    stopObservingPortraitManagers();
    stopObserving();
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.clear();
    viewer.destroy();
  };
}

function enhancePortraitTarget(
    target: PortraitTarget,
    viewer: ReturnType<typeof createFullscreenViewer>,
    characterId: string,
    artService: ReturnType<typeof createCharacterArtService>,
    getControls: () => CharacterArtControlsController | null,
): Cleanup {
  const originalState = snapshotElementState(target.clickSurface);
  let isOpening = false;
  const openViewer = async () => {
    if (isOpening) {
      return;
    }

    const fallbackImageUrl = getPreferredImageUrl(target.image);
    if (fallbackImageUrl === null) {
      return;
    }

    isOpening = true;
    try {
      const source = await artService.resolveViewerImage(characterId, {
        altText: getViewerAltText(target.image),
        imageUrl: fallbackImageUrl,
      });
      if (source.warningMessage !== null) {
        getControls()?.setStatus(source.warningMessage, 'error');
      }

      const viewerImageSource = {
        ...(source.usingStoredArt
          ? {
            actions: createStoredArtViewerActions(
                source,
                characterId,
                fallbackImageUrl,
                artService,
                getControls,
                target.image.ownerDocument,
            ),
          }
          : {}),
        altText: source.altText,
        imageUrl: source.imageUrl,
        ...(source.releaseImageUrl === undefined
          ? {}
          : {releaseImageUrl: source.releaseImageUrl}),
      } satisfies ViewerImageSource;

      viewer.open(viewerImageSource, target.clickSurface);
    } finally {
      isOpening = false;
    }
  };

  target.clickSurface.setAttribute(ENHANCED_ATTRIBUTE_NAME, 'true');
  target.clickSurface.classList.add(PANEL_PORTRAIT_TRIGGER_CLASS_NAME);
  target.clickSurface.setAttribute('aria-haspopup', 'dialog');
  target.clickSurface.setAttribute('aria-label', 'View character portrait fullscreen');
  target.clickSurface.setAttribute('role', 'button');
  target.clickSurface.tabIndex = 0;

  const onClick = (event: MouseEvent) => {
    if (!event.defaultPrevented) {
      void openViewer();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isKeyboardActivationKey(event)) {
      return;
    }

    event.preventDefault();
    void openViewer();
  };

  target.clickSurface.addEventListener('click', onClick);
  target.clickSurface.addEventListener('keydown', onKeyDown);

  return () => {
    target.clickSurface.removeEventListener('click', onClick);
    target.clickSurface.removeEventListener('keydown', onKeyDown);
    target.clickSurface.classList.remove(PANEL_PORTRAIT_TRIGGER_CLASS_NAME);
    target.clickSurface.removeAttribute(ENHANCED_ATTRIBUTE_NAME);
    restoreElementState(target.clickSurface, originalState);
  };
}

function createStoredArtViewerActions(
    source: Awaited<ReturnType<CharacterArtService['resolveViewerImage']>>,
    characterId: string,
    fallbackImageUrl: string,
    artService: CharacterArtService,
    getControls: () => CharacterArtControlsController | null,
    doc: Document,
): ViewerAction[] {
  return [
    {
      busyText: 'Downloading...',
      onClick: async (): Promise<ViewerActionResult> => {
        downloadImage(
            source.imageUrl,
            source.storedArtFileName ?? createCharacterArtDownloadFileName(characterId),
            doc,
        );
        return {
          status: {
            message: 'Stored full art download started.',
            tone: 'success',
          },
        };
      },
      text: 'Download full art',
    },
    {
      busyText: 'Removing...',
      onClick: async (): Promise<ViewerActionResult> => {
        const confirmationView = doc.defaultView;
        if (confirmationView === null) {
          return {
            status: {
              message: 'Delete confirmation could not be shown.',
              tone: 'error',
            },
          };
        }

        if (!confirmationView.confirm(
            'Remove the stored full art for this character? The D&D Beyond portrait will stay unchanged.',
        )) {
          return {};
        }

        const deleteResult = await artService.deleteArt(characterId);
        if (!deleteResult.ok) {
          getControls()?.setStatus(deleteResult.error, 'error');
          return {
            status: {
              message: deleteResult.error,
              tone: 'error',
            },
          };
        }

        await getControls()?.refresh();
        getControls()?.setStatus('Stored full art deleted.', 'success');
        return {
          nextSource: {
            altText: source.altText,
            imageUrl: fallbackImageUrl,
          } satisfies ViewerImageSource,
        };
      },
      text: 'Remove stored full art',
      tone: 'danger',
    },
  ];
}

function downloadImage(
    imageUrl: string,
    fileName: string,
    doc: Document,
): void {
  downloadBlobUrl(imageUrl, fileName, doc);
}

function getPreferredImageUrl(image: HTMLElement): string | null {
  if (image instanceof HTMLImageElement && image.currentSrc.trim() !== '') {
    return image.currentSrc;
  }

  if (image instanceof HTMLImageElement && image.src.trim() !== '') {
    return image.src;
  }

  return getBackgroundImageUrl(image);
}

function getViewerAltText(image: HTMLElement): string {
  const trimmedAltText = image instanceof HTMLImageElement ? image.alt.trim() : '';
  if (trimmedAltText !== '') {
    return trimmedAltText;
  }

  return 'Character portrait';
}

function getBackgroundImageUrl(element: HTMLElement): string | null {
  const backgroundImage = element.ownerDocument.defaultView
      ?.getComputedStyle(element)
      .backgroundImage ?? '';
  const match = /^url\((['"]?)(.+?)\1\)$/.exec(backgroundImage.trim());
  return match?.[2] ?? null;
}

function snapshotElementState(element: HTMLElement): ElementStateSnapshot {
  return {
    ariaHaspopup: element.getAttribute('aria-haspopup'),
    ariaLabel: element.getAttribute('aria-label'),
    role: element.getAttribute('role'),
    tabIndex: element.getAttribute('tabindex'),
  };
}

function restoreElementState(
    element: HTMLElement,
    snapshot: ElementStateSnapshot,
): void {
  restoreAttribute(element, 'aria-haspopup', snapshot.ariaHaspopup);
  restoreAttribute(element, 'aria-label', snapshot.ariaLabel);
  restoreAttribute(element, 'role', snapshot.role);
  restoreAttribute(element, 'tabindex', snapshot.tabIndex);
}

function restoreAttribute(
    element: HTMLElement,
    name: string,
    value: string | null,
): void {
  if (value === null) {
    element.removeAttribute(name);
    return;
  }

  element.setAttribute(name, value);
}
