import {
  PORTRAIT_MANAGER_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_SELECTOR,
} from './selectors';
import {
  isHtmlButtonElement,
  isHtmlElement,
  isHtmlInputElement,
} from '../../shared/dom';
import type {Cleanup} from '../../shared/types';

export interface PortraitManagementTarget {
  manager: HTMLElement;
  uploadInput: HTMLInputElement;
  uploadSection: HTMLElement;
}

const CHANGE_PORTRAIT_BUTTON_TEXT = 'Change Portrait';
const CURRENT_CUSTOM_CONTENT_SELECTOR = '.ct-decoration-manager__custom-content';

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

export function findChangePortraitButton(
    uploadSection: ParentNode,
): HTMLButtonElement | null {
  const buttons = uploadSection.querySelectorAll('button');
  for (const button of buttons) {
    if (!isHtmlButtonElement(button)) {
      continue;
    }

    if (normalizeButtonText(button.textContent) === CHANGE_PORTRAIT_BUTTON_TEXT) {
      return button;
    }
  }

  return null;
}

export function findChangePortraitButtonContainer(
    uploadSection: ParentNode,
): HTMLElement | null {
  const changePortraitButton = findChangePortraitButton(uploadSection);
  return isHtmlElement(changePortraitButton?.parentElement ?? null)
    ? changePortraitButton?.parentElement ?? null
    : null;
}

export function findCurrentCustomContent(
    manager: ParentNode,
): HTMLElement | null {
  const customContent = manager.querySelector(CURRENT_CUSTOM_CONTENT_SELECTOR);
  return isHtmlElement(customContent) ? customContent : null;
}

export function findSelectedPortraitContainer(
    uploadSection: ParentNode,
): HTMLElement | null {
  const changePortraitButtonContainer = findChangePortraitButtonContainer(uploadSection);
  return isHtmlElement(changePortraitButtonContainer?.parentElement ?? null)
    ? changePortraitButtonContainer?.parentElement ?? null
    : null;
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

function normalizeButtonText(value: string | null): string {
  return value?.trim().replace(/\s+/g, ' ') ?? '';
}
