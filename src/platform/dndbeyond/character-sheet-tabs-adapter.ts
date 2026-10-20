import type {Cleanup} from '../../shared/types';
import {
  CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME,
  CHARACTER_SHEET_JOURNAL_TAB_CLASS_NAME,
  CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME,
} from './selectors';
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
  let insertAttempts = 0;
  let attemptWindowStartedAt = Date.now();
  let scanScheduled = false;
  const sheetSelector = '.ct-character-sheet, .ct-character-sheet-shell';

  const scan = () => {
    if (
      activeTarget?.tab.isConnected === true
      && activeTarget.contentHost.isConnected
    ) {
      return;
    }

    const now = Date.now();
    if (now - attemptWindowStartedAt > 2000) {
      insertAttempts = 0;
      attemptWindowStartedAt = now;
    }
    if (insertAttempts >= 6) {
      return;
    }

    insertAttempts += 1;
    activeTarget?.cleanup();
    activeTarget = findOrCreateJournalTab(doc);
    if (activeTarget !== null) {
      onTarget(activeTarget);
    }
  };

  const scheduleScan = () => {
    if (scanScheduled) {
      return;
    }

    scanScheduled = true;
    queueMicrotask(() => {
      scanScheduled = false;
      scan();
    });
  };

  scheduleScan();

  const observer = new MutationObserver(() => {
    const sheet = doc.querySelector(sheetSelector);
    if (sheet !== null && observerRoot !== sheet) {
      observer.disconnect();
      observerRoot = sheet;
      observer.observe(sheet, {
        childList: true,
        subtree: true,
      });
    }
    scheduleScan();
  });
  let observerRoot: Node = doc.body;
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

export function removeStaleJournalUi(doc: Document): void {
  for (const node of doc.querySelectorAll(
      `[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}], [${CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}], .bfa-character-journal-section`,
  )) {
    node.remove();
  }
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
      contentHost: findJournalMount(contentHost),
      nativeTabs: findNativeTabs(existingTab),
      tab: existingTab,
    };
  }

  const extrasTab = findExtrasTab(root);
  if (extrasTab === null) {
    return null;
  }

  const insertionElement = getInsertionElement(extrasTab);
  const contentRegion = findContentHost(extrasTab);
  if (contentRegion === null) {
    return null;
  }

  const journalTab = createJournalTab(extrasTab);
  const journalItem = createInsertionItem(insertionElement, journalTab);
  insertionElement.after(journalItem);

  return {
    cleanup: () => {
      journalItem.remove();
    },
    contentHost: findJournalMount(contentRegion),
    nativeTabs: findNativeTabs(extrasTab),
    tab: journalTab,
  };
}

export function getJournalTabHitTarget(tab: HTMLElement): HTMLElement {
  return tab.closest<HTMLElement>(
      `[${CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}]`,
  ) ?? tab;
}

export function clearNativeTabSelection(tabs: readonly HTMLElement[]): void {
  for (const tab of tabs) {
    if (tab.getAttribute('aria-checked') === 'true') {
      tab.setAttribute('aria-checked', 'false');
    }
    if (tab.getAttribute('aria-selected') === 'true') {
      tab.setAttribute('aria-selected', 'false');
    }

    for (const className of [...tab.classList]) {
      if (isActiveTabClass(className)) {
        tab.classList.remove(className);
      }
    }
  }
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
        !isJournalTabPiece(element)
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
    item.className = stripActiveTabClasses(referenceElement.className);
    item.setAttribute(CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME, 'true');
    rememberNativeActiveClass(referenceElement, item);
    journalTab.className = CHARACTER_SHEET_JOURNAL_TAB_CLASS_NAME;
    item.append(journalTab);
    return item;
  }

  journalTab.setAttribute(CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME, 'true');
  rememberNativeActiveClass(referenceElement, journalTab);
  return journalTab;
}

function createJournalTab(referenceTab: HTMLElement): HTMLButtonElement {
  const doc = referenceTab.ownerDocument;
  const tab = doc.createElement('button');

  tab.className = [
    stripActiveTabClasses(referenceTab.className),
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

function rememberNativeActiveClass(
    reference: HTMLElement,
    item: HTMLElement,
): void {
  const activeClassName = reference.className
      .split(/\s+/)
      .find((name) => isActiveTabClass(name));
  if (activeClassName !== undefined) {
    item.dataset.bfaNativeActiveClass = activeClassName;
  }
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

function findJournalMount(contentRegion: HTMLElement): HTMLElement {
  let mount = contentRegion;
  for (const element of contentRegion.querySelectorAll<HTMLElement>('*')) {
    if (elementScrolls(element)) {
      mount = element;
    }
  }

  return mount;
}

function elementScrolls(element: HTMLElement): boolean {
  const computed = element.ownerDocument.defaultView?.getComputedStyle(element);
  return isScrollOverflow(element.style.overflow)
    || isScrollOverflow(element.style.overflowY)
    || isScrollOverflow(computed?.overflow ?? '')
    || isScrollOverflow(computed?.overflowY ?? '');
}

function isScrollOverflow(value: string): boolean {
  return value.split(/\s+/).some((part) => part === 'auto' || part === 'scroll');
}

function isJournalTabPiece(element: HTMLElement): boolean {
  return element.closest(
      `[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}], [${CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}]`,
  ) !== null;
}

function stripActiveTabClasses(className: string): string {
  return className
      .split(/\s+/)
      .filter((name) => name !== '' && !isActiveTabClass(name))
      .join(' ');
}

function isActiveTabClass(className: string): boolean {
  if (className.startsWith('bfa-')) {
    return false;
  }

  return /(?:^|[-_])(?:is-)?active$/i.test(className);
}

function removeJournalTab(tab: HTMLButtonElement): void {
  const insertedItem = tab.closest<HTMLElement>(
      `[${CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}="true"]`,
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
