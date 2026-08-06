import {
  CHARACTER_MANAGE_PANE_SELECTOR,
  CHARACTER_PORTRAIT_SELECTOR,
  SIDEBAR_PORTAL_SELECTOR,
} from './selectors';
import {isHtmlElement, isHtmlImageElement} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

export interface PortraitTarget {
  controlsContainer: HTMLElement;
  image: HTMLImageElement;
  clickSurface: HTMLElement;
  panel: HTMLElement;
}

export function findPanelPortrait(root: ParentNode): PortraitTarget | null {
  const searchRoot = findSearchRoot(root);
  const panel = searchRoot.querySelector(CHARACTER_MANAGE_PANE_SELECTOR);
  if (!isHtmlElement(panel)) {
    return null;
  }

  const image = panel.querySelector(CHARACTER_PORTRAIT_SELECTOR);
  if (!isHtmlImageElement(image)) {
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

  const sidebarPortal = root.querySelector(SIDEBAR_PORTAL_SELECTOR);
  if (sidebarPortal !== null) {
    return sidebarPortal;
  }

  return root;
}

function findControlsContainer(panel: HTMLElement): HTMLElement {
  const firstElementChild = panel.firstElementChild;
  if (firstElementChild instanceof HTMLElement) {
    return firstElementChild;
  }

  return panel;
}
