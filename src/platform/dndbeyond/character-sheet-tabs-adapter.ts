import type {Cleanup} from '../../shared/types';
import {
  CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME,
  CHARACTER_SHEET_JOURNAL_TAB_CLASS_NAME,
} from './selectors';

const JOURNAL_TAB_ITEM_ATTRIBUTE_NAME = 'data-bfa-character-journal-tab-item';
const TAB_CONTROL_SELECTOR = [
  'a',
  'button',
  'label',
  '[role="tab"]',
  '[role="button"]',
  '[role="radio"]',
  'input[type="radio"]',
].join(',');
const TEXT_TAB_SELECTOR = [
  'a',
  'button',
  'div',
  'label',
  'span',
  '[role]',
].join(',');
const TAB_LIST_SELECTOR = [
  '[role="tablist"]',
  '[role="list"]',
  'ul',
  'ol',
  'nav',
].join(',');
const CHARACTER_SHEET_TAB_LABELS = [
  'actions',
  'spells',
  'inventory',
  'features & traits',
  'background',
  'notes',
  'extras',
];

export interface CharacterSheetJournalTabTarget {
  cleanup: Cleanup;
  contentHost: HTMLElement;
  nativeTabs: HTMLElement[];
  tab: HTMLButtonElement;
}

export function observeJournalTabTargets(
    onTarget: (target: CharacterSheetJournalTabTarget) => void,
    doc: Document = document,
): Cleanup {
  let activeTarget: CharacterSheetJournalTabTarget | null = null;

  const scan = () => {
    if (activeTarget?.tab.isConnected === true) {
      return;
    }

    activeTarget?.cleanup();
    activeTarget = findOrCreateJournalTab(doc);
    if (activeTarget !== null) {
      onTarget(activeTarget);
    }
  };

  scan();

  const observer = new MutationObserver(scan);
  observer.observe(doc.body, {
    childList: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    activeTarget?.cleanup();
    activeTarget = null;
  };
}

export function findOrCreateJournalTab(
    root: ParentNode,
): CharacterSheetJournalTabTarget | null {
  const existingTab = root.querySelector<HTMLButtonElement>(
      `[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}="true"]`,
  );
  if (existingTab !== null) {
    const contentHost = findContentHost(existingTab);
    if (contentHost === null) {
      return null;
    }

    return {
      cleanup: () => {
        removeJournalTab(existingTab);
      },
      contentHost,
      nativeTabs: findNativeTabs(existingTab),
      tab: existingTab,
    };
  }

  const extrasTab = findExtrasTab(root);
  if (extrasTab === null) {
    return null;
  }

  const insertionElement = getInsertionElement(extrasTab);
  const contentHost = findContentHost(extrasTab);
  if (contentHost === null) {
    return null;
  }

  const journalTab = createJournalTab(extrasTab);
  const journalItem = createInsertionItem(insertionElement, journalTab);
  insertionElement.after(journalItem);

  return {
    cleanup: () => {
      journalItem.remove();
    },
    contentHost,
    nativeTabs: findNativeTabs(extrasTab),
    tab: journalTab,
  };
}

function findExtrasTab(root: ParentNode): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(TAB_CONTROL_SELECTOR);

  for (const candidate of candidates) {
    if (candidate.closest(`[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}]`) !== null) {
      continue;
    }

    if (normalizeText(getControlText(candidate)) === 'extras') {
      return candidate;
    }
  }

  return findExactTextExtrasTab(root);
}

function getInsertionElement(extrasTab: HTMLElement): HTMLElement {
  const tabListRoot = findTabListRoot(extrasTab);
  if (tabListRoot !== null) {
    const listItem = findDirectChildContaining(tabListRoot, extrasTab);
    if (listItem !== null) {
      return listItem;
    }
  }

  return extrasTab.closest('li, [role="listitem"]') ?? extrasTab;
}

function findNativeTabs(extrasTab: HTMLElement): HTMLElement[] {
  const tabListRoot = findTabListRoot(extrasTab);
  if (tabListRoot === null) {
    return [];
  }

  return Array.from(tabListRoot.querySelectorAll<HTMLElement>(
      TAB_CONTROL_SELECTOR,
  ))
      .concat(Array.from(tabListRoot.children)
          .filter((element): element is HTMLElement => element instanceof HTMLElement))
      .filter((element, index, elements) =>
        element.getAttribute(CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME) !== 'true'
        && element.closest(`[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}]`) === null
        && elements.indexOf(element) === index,
      );
}

function findContentHost(extrasTab: HTMLElement): HTMLElement | null {
  const tabListRoot = findTabListRoot(extrasTab);
  if (tabListRoot === null) {
    return null;
  }

  const nextListSibling = findNextElementSibling(tabListRoot);
  if (nextListSibling !== null) {
    return nextListSibling;
  }

  const parent = tabListRoot.parentElement;
  if (parent === null) {
    return null;
  }

  const nextParentSibling = findNextElementSibling(parent);
  if (nextParentSibling !== null) {
    return nextParentSibling;
  }

  return null;
}

function createInsertionItem(
    referenceElement: HTMLElement,
    journalTab: HTMLButtonElement,
): HTMLElement {
  if (!referenceElement.matches(TAB_CONTROL_SELECTOR)) {
    const item = referenceElement.ownerDocument.createElement(
        referenceElement.tagName,
    );
    item.className = referenceElement.className;
    item.setAttribute(JOURNAL_TAB_ITEM_ATTRIBUTE_NAME, 'true');
    item.append(journalTab);
    return item;
  }

  journalTab.setAttribute(JOURNAL_TAB_ITEM_ATTRIBUTE_NAME, 'true');
  return journalTab;
}

function createJournalTab(referenceTab: HTMLElement): HTMLButtonElement {
  const doc = referenceTab.ownerDocument;
  const tab = doc.createElement('button');

  tab.className = [
    referenceTab.className,
    CHARACTER_SHEET_JOURNAL_TAB_CLASS_NAME,
  ].filter(Boolean).join(' ');
  tab.setAttribute(CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME, 'true');
  tab.textContent = 'Journal';
  tab.type = 'button';

  if (referenceTab.getAttribute('role') === 'tab') {
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('role', 'tab');
  }

  return tab;
}

function findTabListRoot(tab: HTMLElement): HTMLElement | null {
  const semanticRoot = tab.closest<HTMLElement>(TAB_LIST_SELECTOR);
  if (semanticRoot !== null) {
    return semanticRoot;
  }

  return findTabListRootByLabels(tab);
}

function findDirectChildContaining(
    parent: HTMLElement,
    child: HTMLElement,
): HTMLElement | null {
  let current: HTMLElement | null = child;
  while (current !== null && current.parentElement !== parent) {
    current = current.parentElement;
  }

  return current;
}

function findNextElementSibling(element: HTMLElement): HTMLElement | null {
  let candidate = element.nextElementSibling;
  while (candidate !== null) {
    if (candidate instanceof HTMLElement) {
      return candidate;
    }
    candidate = candidate.nextElementSibling;
  }

  return null;
}

function removeJournalTab(tab: HTMLButtonElement): void {
  const insertedItem = tab.closest<HTMLElement>(
      `[${JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}="true"]`,
  );
  if (insertedItem !== null) {
    insertedItem.remove();
    return;
  }

  tab.remove();
}

function getControlText(control: HTMLElement): string {
  const labelText =
    control instanceof HTMLInputElement
      ? control.closest('label')?.textContent
      : null;

  return [
    control.textContent,
    control.getAttribute('aria-label'),
    control.getAttribute('value'),
    labelText,
  ].filter((text): text is string => text != null && text.trim() !== '')
      .join(' ');
}

function findExactTextExtrasTab(root: ParentNode): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(TEXT_TAB_SELECTOR);
  for (const candidate of candidates) {
    if (candidate.closest(`[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}]`) !== null) {
      continue;
    }

    if (
      normalizeText(getDirectText(candidate)) === 'extras'
      && findTabListRoot(candidate) !== null
    ) {
      return candidate;
    }
  }

  return null;
}

function getDirectText(element: HTMLElement): string {
  return Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? '')
      .join(' ');
}

function findTabListRootByLabels(tab: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = tab;
  while (current !== null && current !== current.ownerDocument.body) {
    const currentText = normalizeText(current.textContent ?? '');
    if (
      CHARACTER_SHEET_TAB_LABELS.every((label) => currentText.includes(label))
      && findNextElementSibling(current) !== null
    ) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
