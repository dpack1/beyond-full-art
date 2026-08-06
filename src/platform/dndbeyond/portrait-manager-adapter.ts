import {
  PORTRAIT_MANAGER_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_SELECTOR,
} from './selectors';
import {isHtmlElement, isHtmlInputElement} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

export interface PortraitManagementTarget {
  manager: HTMLElement;
  uploadInput: HTMLInputElement;
  uploadSection: HTMLElement;
}

export function findPortraitManagementTargets(
    root: ParentNode,
): PortraitManagementTarget[] {
  const targets: PortraitManagementTarget[] = [];
  const managers = root.querySelectorAll(PORTRAIT_MANAGER_SELECTOR);

  for (const manager of managers) {
    if (!isHtmlElement(manager)) {
      continue;
    }

    const uploadSection = manager.querySelector(PORTRAIT_MANAGER_UPLOAD_SELECTOR);
    if (!isHtmlElement(uploadSection)) {
      continue;
    }

    const uploadInput = uploadSection.querySelector(
        PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
    );
    if (!isHtmlInputElement(uploadInput)) {
      continue;
    }

    targets.push({
      manager,
      uploadInput,
      uploadSection,
    });
  }

  return targets;
}

export function observePortraitManagementTargets(
    callback: (target: PortraitManagementTarget) => void,
    doc: Document = document,
): Cleanup {
  const notify = () => {
    for (const target of findPortraitManagementTargets(doc)) {
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
