import {createFullscreenViewer} from '../features/fullscreen-viewer/viewer';
import {
  ENHANCED_ATTRIBUTE_NAME,
  PANEL_PORTRAIT_TRIGGER_CLASS_NAME,
} from '../platform/dndbeyond/selectors';
import {
  observePanelPortraits,
  type PortraitTarget,
} from '../platform/dndbeyond/portrait-adapter';
import {isCharacterSheetUrl} from '../platform/dndbeyond/urls';
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
  if (!isCharacterSheetUrl(new URL(doc.location.href))) {
    return () => {};
  }

  const viewer = createFullscreenViewer(doc);
  const cleanups = new Map<HTMLElement, Cleanup>();
  const stopObserving = observePanelPortraits((target) => {
    if (cleanups.has(target.clickSurface)) {
      return;
    }

    cleanups.set(target.clickSurface, enhancePortraitTarget(target, viewer));
  }, doc);

  return () => {
    stopObserving();
    for (const cleanup of cleanups.values()) {
      cleanup();
    }
    cleanups.clear();
    viewer.destroy();
  };
}

function enhancePortraitTarget(
    target: PortraitTarget,
    viewer: ReturnType<typeof createFullscreenViewer>,
): Cleanup {
  const originalState = snapshotElementState(target.clickSurface);
  const openViewer = () => {
    const imageUrl = getPreferredImageUrl(target.image);
    if (imageUrl === null) {
      return;
    }

    viewer.open({
      altText: getViewerAltText(target.image),
      imageUrl,
    }, target.clickSurface);
  };

  target.clickSurface.setAttribute(ENHANCED_ATTRIBUTE_NAME, 'true');
  target.clickSurface.classList.add(PANEL_PORTRAIT_TRIGGER_CLASS_NAME);
  target.clickSurface.setAttribute('aria-haspopup', 'dialog');
  target.clickSurface.setAttribute('aria-label', 'View character portrait fullscreen');
  target.clickSurface.setAttribute('role', 'button');
  target.clickSurface.tabIndex = 0;

  const onClick = (event: MouseEvent) => {
    if (!event.defaultPrevented) {
      openViewer();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (!isKeyboardActivationKey(event)) {
      return;
    }

    event.preventDefault();
    openViewer();
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

function getPreferredImageUrl(image: HTMLImageElement): string | null {
  if (image.currentSrc.trim() !== '') {
    return image.currentSrc;
  }

  if (image.src.trim() !== '') {
    return image.src;
  }

  return null;
}

function getViewerAltText(image: HTMLImageElement): string {
  const trimmedAltText = image.alt.trim();
  if (trimmedAltText !== '') {
    return trimmedAltText;
  }

  return 'Character portrait';
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
