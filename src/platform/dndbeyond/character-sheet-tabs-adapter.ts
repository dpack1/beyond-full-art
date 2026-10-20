import {JOURNAL_SHEET_ROOT_SELECTOR} from '../../ddb/selectors';
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
  'menu',
].join(',');
const CORE_SHEET_TAB_LABELS = [
  'actions',
  'spells',
  'inventory',
  'features & traits',
  'extras',
];
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
  const sheetSelector = JOURNAL_SHEET_ROOT_SELECTOR;

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
      `[${CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME}], [${CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}], .bfa-character-journal-section, [data-bfa-journal-panel], [data-bfa-journal-scrim]`,
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
    contentHost: contentRegion,
    nativeTabs: findNativeTabs(extrasTab),
    tab: journalTab,
  };
}

export function getJournalTabHitTarget(tab: HTMLElement): HTMLElement {
  return tab.closest<HTMLElement>(
      `[${CHARACTER_SHEET_JOURNAL_TAB_ITEM_ATTRIBUTE_NAME}]`,
  ) ?? tab;
}

export function clearNativeTabSelection(
    tabs: readonly HTMLElement[],
    journalTab?: HTMLElement,
): void {
  if (journalTab !== undefined) {
    captureActiveTabChrome(journalTab);
  }

  for (const tab of tabs) {
    if (tab.getAttribute('aria-checked') === 'true') {
      tab.setAttribute('aria-checked', 'false');
    }
    if (tab.getAttribute('aria-selected') === 'true') {
      tab.setAttribute('aria-selected', 'false');
    }
  }

  for (const element of listNativeTabElements(tabs)) {
    for (const className of [...element.classList]) {
      if (!isActiveTabClass(className)) {
        continue;
      }

      element.dataset.bfaRestoreActive = className;
      element.classList.remove(className);
    }
  }
}

export function markNextNativeTab(target: HTMLElement): void {
  const item = nativeTabItem(target);
  if (isJournalTabPiece(item)) {
    return;
  }

  item.dataset.bfaNextActive = 'true';
}

export function clearNextNativeTab(target: HTMLElement): void {
  delete nativeTabItem(target).dataset.bfaNextActive;
}

export function captureActiveTabChrome(journalTab: HTMLElement): void {
  const hitTarget = getJournalTabHitTarget(journalTab);
  const root = findTabListRoot(hitTarget);
  if (root === null) {
    return;
  }

  const active = findVisuallyActiveTab(root);
  const view = active?.ownerDocument.defaultView;
  if (active === null || active === undefined || view === null || view === undefined) {
    return;
  }

  const style = view.getComputedStyle(active);
  const borderBottom = style.borderBottomStyle !== 'none'
    && style.borderBottomWidth !== '0px'
    && style.borderBottomWidth !== ''
      ? `${style.borderBottomWidth} ${style.borderBottomStyle} ${style.borderBottomColor}`
      : '';
  const boxShadow = style.boxShadow !== '' && style.boxShadow !== 'none'
    ? style.boxShadow
    : '';
  if (style.color === '' && borderBottom === '' && boxShadow === '') {
    return;
  }

  hitTarget.dataset.bfaTabChrome = [style.color, borderBottom, boxShadow].join('|');
}

export function restoreNativeTabAfterJournal(journalTab: HTMLElement): void {
  const hitTarget = getJournalTabHitTarget(journalTab);
  const activeClass = hitTarget.dataset.bfaNativeActiveClass;
  const root = findTabListRoot(hitTarget) ?? hitTarget.parentElement;
  if (root === null || activeClass === undefined || activeClass === '') {
    return;
  }

  hitTarget.classList.remove(activeClass);
  const candidates = Array.from(root.querySelectorAll<HTMLElement>('*'))
      .filter((element) => !isJournalTabPiece(element));
  const nextTab = candidates.find((element) => element.dataset.bfaNextActive === 'true')
    ?? candidates.find((element) => element.dataset.bfaRestoreActive === activeClass);
  for (const element of candidates) {
    delete element.dataset.bfaNextActive;
    delete element.dataset.bfaRestoreActive;
    element.classList.remove(activeClass);
  }
  nextTab?.classList.add(activeClass);
}

function findVisuallyActiveTab(root: HTMLElement): HTMLElement | null {
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
      .filter((element) => !isJournalTabPiece(element));
  const classed = elements.find((element) =>
    [...element.classList].some((className) => isActiveTabClass(className)),
  );
  if (classed !== undefined) {
    return classed;
  }

  const selected = elements.find((element) =>
    element.getAttribute('aria-selected') === 'true'
    || element.getAttribute('aria-checked') === 'true',
  );
  if (selected !== undefined) {
    return selected;
  }

  const view = root.ownerDocument.defaultView;
  if (view === null) {
    return null;
  }

  return elements.find((element) => {
    const style = view.getComputedStyle(element);
    const border = Number.parseFloat(style.borderBottomWidth);
    const underlined = Number.isFinite(border)
      && border >= 2
      && style.borderBottomStyle !== 'none';
    const shadow = style.boxShadow !== ''
      && style.boxShadow !== 'none'
      && style.boxShadow.includes('inset');
    return underlined || shadow;
  }) ?? null;
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
  const activeClassName = findActiveClassInRow(reference);
  if (activeClassName !== null) {
    item.dataset.bfaNativeActiveClass = activeClassName;
  }
}

function findActiveClassInRow(tab: HTMLElement): string | null {
  const root = findTabListRoot(tab) ?? tab.parentElement;
  const elements = root === null
    ? [tab]
    : [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
  for (const element of elements) {
    if (isJournalTabPiece(element)) {
      continue;
    }

    for (const className of element.classList) {
      if (isActiveTabClass(className)) {
        return className;
      }
    }
  }

  return null;
}

function listNativeTabElements(tabs: readonly HTMLElement[]): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const elements: HTMLElement[] = [];
  for (const tab of tabs) {
    const root = findTabListRoot(tab);
    const group = root === null
      ? [tab]
      : [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))];
    for (const element of group) {
      if (seen.has(element) || isJournalTabPiece(element)) {
        continue;
      }

      seen.add(element);
      elements.push(element);
    }
  }

  return elements;
}

function nativeTabItem(target: HTMLElement): HTMLElement {
  const root = findTabListRoot(target);
  if (root === null) {
    return target;
  }

  return findDirectChildContaining(root, target) ?? target;
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
    const hasClassicLabels = CHARACTER_SHEET_TAB_LABELS.every((label) =>
      currentText.includes(label),
    );
    const hasCoreLabels = CORE_SHEET_TAB_LABELS.every((label) =>
      currentText.includes(label),
    );
    if ((hasClassicLabels || hasCoreLabels) && findNextElementSibling(current) !== null) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}
