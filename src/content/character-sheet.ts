import {
  createCharacterArtService,
  type CharacterArtService,
} from '../features/character-art/art-service';
import {createCharacterJournalSection} from '../features/character-journal/character-journal-section';
import {createCharacterJournalService} from '../features/character-journal/character-journal-service';
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
  CHARACTER_JOURNAL_ENABLED_KEY,
  getCharacterJournalEnabled,
} from '../platform/chrome/storage';
import {
  observePanelPortraits,
  type PortraitTarget,
} from '../platform/dndbeyond/portrait-adapter';
import {
  isCharacterPageUrl,
  parseCharacterIdFromCharacterPageUrl,
} from '../platform/dndbeyond/urls';
import {
  clearNativeTabSelection,
  clearNextNativeTab,
  getJournalTabHitTarget,
  markNextNativeTab,
  observeJournalTabTargets,
  removeStaleJournalUi,
  type CharacterSheetJournalTabTarget,
} from '../platform/dndbeyond/character-sheet-tabs-adapter';
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

  removeStaleJournalUi(doc);

  const artService = createCharacterArtService(doc);
  const cropWorkflow = createCharacterPortraitCropWorkflow(artService, doc);
  const journalService = createCharacterJournalService();
  const journalSection = createCharacterJournalSection(journalService, doc);
  const viewer = createFullscreenViewer(doc);
  const cleanups = new Set<Cleanup>();
  const journalCleanups = new Set<Cleanup>();
  let activeControls: CharacterArtControlsController | null = null;
  let journalSyncGeneration = 0;
  let knownCharacterHref = doc.location.href;
  let releaseJournalBinding: Cleanup | null = null;
  let stopObservingJournalTabs: Cleanup | null = null;
  const getActiveControls = () => activeControls;

  const readCurrentCharacterId = (): string | null => {
    return parseCharacterIdFromCharacterPageUrl(new URL(doc.location.href));
  };

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

  const bindJournalTarget = (target: CharacterSheetJournalTabTarget) => {
    releaseJournalBinding?.();
    const journalHitTarget = getJournalTabHitTarget(target.tab);
    let openedFromPointer = false;
    const isJournalEvent = (event: Event) => {
      const eventTarget = event.target;
      return eventTarget instanceof Node && journalHitTarget.contains(eventTarget);
    };
    const openJournal = () => {
      const activeCharacterId = readCurrentCharacterId();
      if (activeCharacterId === null) {
        return;
      }

      clearNativeTabSelection(target.nativeTabs, target.tab);
      void journalSection.show({
        characterId: activeCharacterId,
        contentHost: target.contentHost,
        tab: target.tab,
      });
    };
    const stopSheetTabGesture = (event: Event) => {
      if (!isJournalEvent(event)) {
        return;
      }

      event.stopPropagation();
    };
    const onPointerDown = (event: Event) => {
      if (!isJournalEvent(event)) {
        return;
      }

      event.stopPropagation();
      openedFromPointer = true;
      openJournal();
    };
    const onClick = (event: MouseEvent) => {
      if (!isJournalEvent(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      if (openedFromPointer) {
        openedFromPointer = false;
        return;
      }

      openJournal();
    };
    const onNativeTabClick = (event: Event) => {
      if (event.currentTarget instanceof HTMLElement) {
        markNextNativeTab(event.currentTarget);
      }

      journalSection.requestHide(undefined, () => {
        if (event.currentTarget instanceof HTMLElement) {
          clearNextNativeTab(event.currentTarget);
        }
      });
    };

    // The sheet listens on the tab row, often on pointerdown, before the
    // inserted button's click listener runs. Capture on the document claims
    // the whole Journal hit target, including its padding.
    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('mousedown', stopSheetTabGesture, true);
    doc.addEventListener('click', onClick, true);
    for (const nativeTab of target.nativeTabs) {
      nativeTab.addEventListener('click', onNativeTabClick);
    }
    releaseJournalBinding = () => {
      doc.removeEventListener('pointerdown', onPointerDown, true);
      doc.removeEventListener('mousedown', stopSheetTabGesture, true);
      doc.removeEventListener('click', onClick, true);
      for (const nativeTab of target.nativeTabs) {
        nativeTab.removeEventListener('click', onNativeTabClick);
      }
    };

    if (journalSection.isShown()) {
      openJournal();
    }
  };

  const tearDownJournalChrome = () => {
    stopObservingJournalTabs?.();
    stopObservingJournalTabs = null;
    releaseJournalBinding?.();
    releaseJournalBinding = null;
    for (const cleanup of journalCleanups) {
      cleanup();
    }
    journalCleanups.clear();
    journalSection.hide();
  };

  const startJournalFeature = () => {
    if (stopObservingJournalTabs !== null) {
      return;
    }

    stopObservingJournalTabs = observeJournalTabTargets(bindJournalTarget, doc);
  };

  const stopJournalFeature = () => {
    journalSection.requestHide(() => {
      tearDownJournalChrome();
    });
  };

  const syncCharacterRoute = () => {
    if (doc.location.href === knownCharacterHref) {
      return;
    }

    knownCharacterHref = doc.location.href;
    const nextUrl = new URL(doc.location.href);
    if (!isCharacterPageUrl(nextUrl) || readCurrentCharacterId() === null) {
      journalSection.requestHide(() => {
        tearDownJournalChrome();
      });
      return;
    }

    journalSection.syncRoute(readCurrentCharacterId());
  };

  doc.defaultView?.addEventListener('popstate', syncCharacterRoute);
  const routeTimer = doc.defaultView?.setInterval(syncCharacterRoute, 400);

  const syncJournalEnabledState = async () => {
    const generation = ++journalSyncGeneration;
    const isEnabled = await getCharacterJournalEnabled();
    if (generation !== journalSyncGeneration) {
      return;
    }

    if (isEnabled) {
      startJournalFeature();
      return;
    }

    stopJournalFeature();
  };

  const stopJournalStorageListener = installStorageListener(
      CHARACTER_JOURNAL_ENABLED_KEY,
      syncJournalEnabledState,
  );
  void syncJournalEnabledState();

  return () => {
    stopObservingPortraitManagers();
    stopObserving();
    stopJournalStorageListener();
    doc.defaultView?.removeEventListener('popstate', syncCharacterRoute);
    if (routeTimer !== undefined) {
      doc.defaultView?.clearInterval(routeTimer);
    }
    journalSyncGeneration += 1;
    tearDownJournalChrome();
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.clear();
    journalSection.destroy();
    viewer.destroy();
  };
}

function installStorageListener(
    key: string,
    onChange: () => void,
): Cleanup {
  if (typeof chrome === 'undefined' || chrome.storage?.onChanged === undefined) {
    return () => {};
  }

  const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] =
    (changes, areaName) => {
      if (areaName !== 'local' || !Object.hasOwn(changes, key)) {
        return;
      }

      onChange();
    };

  chrome.storage.onChanged.addListener(listener);
  return () => {
    chrome.storage.onChanged.removeListener(listener);
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
