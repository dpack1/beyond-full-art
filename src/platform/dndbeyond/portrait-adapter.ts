import {
  CHARACTER_MANAGE_PANE_SELECTOR,
  CHARACTER_PORTRAIT_SELECTOR,
  CHARACTER_PORTRAIT_SURFACE_SELECTOR,
  DECORATE_PANE_SELECTOR,
  INFORMATION_SIDEBAR_SELECTOR,
  SIDEBAR_PORTAL_SELECTOR,
} from './selectors';
import {isHtmlElement, isHtmlImageElement} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

export interface PortraitTarget {
  controlsContainer: HTMLElement;
  image: HTMLElement;
  clickSurface: HTMLElement;
  panel: HTMLElement;
}

export function findPanelPortrait(root: ParentNode): PortraitTarget | null {
  const searchRoot = findSearchRoot(root);
  const panel = findPanelRoot(searchRoot);
  if (panel === null) {
    return null;
  }

  const image = findPortraitSurface(panel);
  if (image === null) {
    return null;
  }

  return {
    controlsContainer: findControlsContainer(panel),
    clickSurface: image,
    image,
    panel,
  };
}

export function observePanelPortraits(
    callback: (target: PortraitTarget) => void,
    doc: Document = document,
): Cleanup {
  const notify = () => {
    const target = findPanelPortrait(doc);
    if (target !== null) {
      callback(target);
    }
  };

  notify();

  const observer = createMutationObserver(doc, notify);
  observer.observe(doc.body, {childList: true, subtree: true});

  return () => {
    observer.disconnect();
  };
}

function createMutationObserver(
    doc: Document,
    callback: MutationCallback,
): MutationObserver {
  const ViewMutationObserver = doc.defaultView?.MutationObserver;
  if (ViewMutationObserver === undefined) {
    return new MutationObserver(callback);
  }

  return new ViewMutationObserver(callback);
}

function findSearchRoot(root: ParentNode): ParentNode {
  if (!(root instanceof Document)) {
    return root;
  }

  const sidebarPortal = firstOutsideJournal(root, SIDEBAR_PORTAL_SELECTOR);
  if (sidebarPortal !== null) {
    return sidebarPortal;
  }

  return root;
}

function findPanelRoot(root: ParentNode): HTMLElement | null {
  const legacyPanel = firstOutsideJournal(root, CHARACTER_MANAGE_PANE_SELECTOR);
  if (legacyPanel !== null) {
    return legacyPanel;
  }

  const informationSidebar = firstOutsideJournal(root, INFORMATION_SIDEBAR_SELECTOR);
  if (informationSidebar !== null) {
    return informationSidebar;
  }

  if (root instanceof HTMLElement && findPortraitSurface(root) !== null) {
    return root;
  }

  return null;
}

function firstOutsideJournal(root: ParentNode, selector: string): HTMLElement | null {
  for (const candidate of root.querySelectorAll(selector)) {
    if (!(candidate instanceof HTMLElement)) {
      continue;
    }
    if (candidate.closest('.bfa-journal-panel') !== null) {
      continue;
    }
    return candidate;
  }

  return null;
}

function findPortraitSurface(root: ParentNode): HTMLElement | null {
  const legacyPortrait = findFirstOutsideDecoratePane(
      root,
      CHARACTER_PORTRAIT_SELECTOR,
      isHtmlImageElement,
  );
  if (legacyPortrait !== null) {
    return legacyPortrait;
  }

  const portraitSurfaces = [...root.querySelectorAll(
      CHARACTER_PORTRAIT_SURFACE_SELECTOR,
  )].filter((element): element is HTMLElement =>
    isHtmlElement(element) && !isInsideDecoratePane(element),
  );

  if (portraitSurfaces.length === 0) {
    return null;
  }

  return portraitSurfaces.reduce((largest, candidate) => (
    getElementArea(candidate) >= getElementArea(largest) ? candidate : largest
  ));
}

function findFirstOutsideDecoratePane<T extends Element>(
    root: ParentNode,
    selector: string,
    isMatch: (element: Element) => element is T,
): T | null {
  for (const candidate of root.querySelectorAll(selector)) {
    if (!isMatch(candidate) || isInsideDecoratePane(candidate)) {
      continue;
    }

    return candidate;
  }

  return null;
}

function isInsideDecoratePane(element: Element): boolean {
  return element.closest(DECORATE_PANE_SELECTOR) !== null;
}

function getElementArea(element: HTMLElement): number {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height;
}

function findControlsContainer(panel: HTMLElement): HTMLElement {
  const firstElementChild = panel.firstElementChild;
  if (firstElementChild instanceof HTMLElement) {
    return firstElementChild;
  }

  return panel;
}
