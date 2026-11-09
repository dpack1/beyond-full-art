import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import journalStyles from '../../src/features/character-journal/character-journal.css?raw';
import {
  clearNativeTabSelection,
  findOrCreateJournalTab,
  markNextNativeTab,
  observeJournalTabTargets,
  restoreNativeTabAfterJournal,
  setJournalTabSelected,
} from '../../src/platform/dndbeyond/character-sheet-tabs-adapter';
import {
  CHARACTER_SHEET_TABS_FIXTURE,
  CURRENT_CHARACTER_SHEET_TABS_FIXTURE,
  LIVE_CHARACTER_SHEET_TABS_FIXTURE,
} from '../fixtures/character-sheet-tabs';

describe('character sheet tabs adapter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.head.replaceChildren();
    document.body.innerHTML = '';
  });

  it('inserts the journal tab immediately after Extras', () => {
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    const target = findOrCreateJournalTab(document);
    const labels = Array.from(
        document.querySelectorAll('.ct-character-sheet-tab-item button'),
        (button) => button.textContent?.trim(),
    );

    expect(target?.tab.textContent).toBe('Journal');
    expect(labels).toEqual([
      'Actions',
      'Inventory',
      'Extras',
      'Journal',
      'Notes',
    ]);
    expect(target?.contentHost).toBe(
        document.querySelector('.ct-character-sheet-content'),
    );

    target?.cleanup();
    expect(document.querySelector('[data-bfa-character-journal-tab]')).toBeNull();
  });

  it('uses the live radio-list sheet panel as the content host', () => {
    document.body.innerHTML = CURRENT_CHARACTER_SHEET_TABS_FIXTURE;

    const target = findOrCreateJournalTab(document);
    const tabList = document.querySelector('.ct-character-sheet-tabs');
    const labels = Array.from(
        tabList?.children ?? [],
        (element) => element.textContent?.trim().replace(/\s+/g, ' '),
    );

    expect(target?.tab.textContent).toBe('Journal');
    expect(labels).toEqual([
      'ACTIONS',
      'SPELLS',
      'INVENTORY',
      'FEATURES & TRAITS',
      'BACKGROUND',
      'NOTES',
      'EXTRAS',
      'Journal',
    ]);
    expect(target?.tab.parentElement?.className)
        .toBe('ct-character-sheet-tab-option');
    expect(target?.contentHost).toBe(
        document.querySelector('.ct-character-sheet-content'),
    );
    expect(target?.nativeTabs.map((tab) => tab.textContent?.trim()))
        .toContain('FEATURES & TRAITS');
  });

  it('does not duplicate an existing journal tab', () => {
    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;

    findOrCreateJournalTab(document);
    findOrCreateJournalTab(document);

    expect(
        document.querySelectorAll('[data-bfa-character-journal-tab="true"]'),
    ).toHaveLength(1);
  });

  it('does nothing when Extras is missing', () => {
    document.body.innerHTML = `
      <nav aria-label="Character sheet sections">
        <button type="button">Actions</button>
      </nav>
    `;

    expect(findOrCreateJournalTab(document)).toBeNull();
  });

  it('observes lazily rendered tabs', async () => {
    let callbackCount = 0;
    const stopObserving = observeJournalTabTargets(() => {
      callbackCount += 1;
    });

    document.body.innerHTML = CHARACTER_SHEET_TABS_FIXTURE;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(callbackCount).toBe(1);
    expect(document.querySelector('[data-bfa-character-journal-tab]')).not.toBeNull();

    stopObserving();
    expect(document.querySelector('[data-bfa-character-journal-tab]')).toBeNull();
  });

  it('mounts the journal on the content region and drops the active tab class', () => {
    document.body.innerHTML = LIVE_CHARACTER_SHEET_TABS_FIXTURE;

    const target = findOrCreateJournalTab(document);

    expect(target?.contentHost).toBe(
        document.querySelector('.ddbc-tab-list__content'),
    );
    const journalItem = journalTabItem(target?.tab ?? null);
    expect(journalItem?.className ?? '')
        .not.toContain('is-active');
    expect(target?.tab.querySelector('svg')).toBeNull();
    expect(target?.tab.textContent).toBe('Journal');
    expect(journalItem?.dataset.bfaNativeActiveClass)
        .toBe('ddbc-tab-list__nav-item--is-active');
    expect(target?.nativeTabs.some((tab) => tab.textContent?.includes('Journal')))
        .toBe(false);
  });

  it('uses the active class from whichever native tab is selected', () => {
    document.body.innerHTML = LIVE_CHARACTER_SHEET_TABS_FIXTURE;
    const spells = tabItem('Spells');
    const extras = tabItem('Extras');
    const actions = tabItem('Actions');
    extras?.classList.remove('ddbc-tab-list__nav-item--is-active');
    spells?.classList.add('ddbc-tab-list__nav-item--is-active');

    const target = findOrCreateJournalTab(document);
    const journalItem = journalTabItem(target?.tab ?? null);
    if (target === null || spells === undefined || actions === undefined || journalItem === null) {
      throw new Error('Missing tab target');
    }

    expect(journalItem.dataset.bfaNativeActiveClass)
        .toBe('ddbc-tab-list__nav-item--is-active');

    clearNativeTabSelection(target.nativeTabs);
    expect(spells.classList.contains('ddbc-tab-list__nav-item--is-active'))
        .toBe(false);

    journalItem.classList.add('ddbc-tab-list__nav-item--is-active');
    restoreNativeTabAfterJournal(target.tab);
    expect(spells.classList.contains('ddbc-tab-list__nav-item--is-active'))
        .toBe(true);
    expect(journalItem.classList.contains('ddbc-tab-list__nav-item--is-active'))
        .toBe(false);

    spells.classList.add('ddbc-tab-list__nav-item--is-active');
    clearNativeTabSelection(target.nativeTabs);
    journalItem.classList.add('ddbc-tab-list__nav-item--is-active');
    markNextNativeTab(actions);
    restoreNativeTabAfterJournal(target.tab);
    expect(actions.classList.contains('ddbc-tab-list__nav-item--is-active'))
        .toBe(true);
    expect(spells.classList.contains('ddbc-tab-list__nav-item--is-active'))
        .toBe(false);
  });

  it('mounts on the content region when a nested pane also scrolls', () => {
    document.body.innerHTML = LIVE_CHARACTER_SHEET_TABS_FIXTURE;
    const panel = document.querySelector('[data-testid="native-character-panel"]');
    const nested = document.createElement('div');
    nested.dataset.testid = 'nested-scroller';
    nested.style.overflow = 'auto';
    nested.style.height = '80px';
    panel?.append(nested);

    const target = findOrCreateJournalTab(document);

    expect(target?.contentHost).toBe(
        document.querySelector('.ddbc-tab-list__content'),
    );
  });

  it('clears is-active on a nested tab span and learns the class from Actions', () => {
    document.body.innerHTML = LIVE_CHARACTER_SHEET_TABS_FIXTURE;
    const extras = tabItem('Extras');
    extras?.classList.remove('ddbc-tab-list__nav-item--is-active');
    const actions = tabItem('Actions');
    const nested = document.createElement('span');
    nested.className = 'ddbc-tab-list__nav-item--is-active';
    nested.textContent = 'Actions label';
    actions?.append(nested);

    const target = findOrCreateJournalTab(document);
    if (target === null) {
      throw new Error('Missing tab target');
    }

    clearNativeTabSelection(target.nativeTabs, target.tab);
    expect(nested.classList.contains('ddbc-tab-list__nav-item--is-active'))
        .toBe(false);
    expect(journalTabItem(target.tab)?.dataset.bfaNativeActiveClass)
        .toBe('ddbc-tab-list__nav-item--is-active');
  });

  it('copies a sibling tab so Journal matches its computed type', () => {
    document.body.innerHTML = `
      <style>
        menu { color: rgb(180, 180, 180); font-size: 16px; font-weight: 400; letter-spacing: 0.2em; text-transform: none; }
        .styles_tabButton { color: rgb(117, 131, 139); font-size: 14px; font-weight: 700; letter-spacing: normal; text-transform: uppercase; }
        .styles_tabButton[aria-checked="true"] { border-bottom: 3px solid rgb(197, 49, 49); color: rgb(18, 24, 28); }
      </style>
      <menu>
        <li><button class="styles_tabButton" type="button" aria-checked="true">Actions</button></li>
        <li><button class="styles_tabButton" type="button" aria-checked="false">Spells</button></li>
        <li><button class="styles_tabButton" type="button" aria-checked="false">Inventory</button></li>
        <li><button class="styles_tabButton" type="button" aria-checked="false">Features &amp; Traits</button></li>
        <li><button class="styles_tabButton" type="button" aria-checked="false">Extras</button></li>
      </menu>
      <section></section>
    `;
    const extensionStyles = document.createElement('style');
    extensionStyles.textContent = journalStyles;
    document.head.append(extensionStyles);

    const target = findOrCreateJournalTab(document);
    const extras = document.querySelector<HTMLElement>('button.styles_tabButton[aria-checked="false"]');
    const actions = document.querySelector<HTMLElement>('button.styles_tabButton[aria-checked="true"]');
    if (target === null || extras === null || actions === null) {
      throw new Error('Missing tab target');
    }

    expect(target.tab.className).toContain('styles_tabButton');
    expect(target.tab.getAttribute('aria-checked')).toBe('false');
    expect(tabPaint(target.tab)).toEqual(tabPaint(extras));

    setJournalTabSelected(target.tab, true);
    expect(tabPaint(target.tab)).toEqual(tabPaint(actions));
    target.tab.classList.add('bfa-character-journal-tab--active');
    journalTabItem(target.tab)?.classList.add('bfa-character-journal-tab--active');
    const journalItem = journalTabItem(target.tab);
    const actionsItem = actions.closest('li');
    if (journalItem === null || actionsItem === null) {
      throw new Error('Missing tab item');
    }

    expect(indicatorCount(actionsItem)).toBe(1);
    expect(indicatorCount(journalItem)).toBe(indicatorCount(actionsItem));
  });

  it('inserts Journal after the builder route becomes the sheet', async () => {
    vi.useFakeTimers();
    const originalHref = window.location.href;
    window.history.replaceState(
        {},
        '',
        '/characters/172153137/builder/class/manage',
    );
    document.body.innerHTML = CURRENT_CHARACTER_SHEET_TABS_FIXTURE;
    const sheet = document.querySelector<HTMLElement>('.ct-character-sheet');
    if (sheet === null) {
      throw new Error('Missing sheet');
    }

    const tabs = sheet.innerHTML;
    sheet.innerHTML = '';
    const stopObserving = observeJournalTabTargets(() => {});
    try {
      await spendJournalScanBudget(sheet);
      sheet.innerHTML = tabs;
      await flushJournalScan();
      expect(journalTab()).toBeNull();

      await vi.advanceTimersByTimeAsync(3000);
      expect(journalTab()).toBeNull();

      window.history.replaceState({}, '', '/characters/172153137');
      await vi.advanceTimersByTimeAsync(400);
      expect(journalTab()?.textContent).toBe('Journal');
    } finally {
      stopObserving();
      window.history.replaceState({}, '', originalHref);
      vi.useRealTimers();
    }
  });

  it('inserts Journal when the watched sheet root is replaced', async () => {
    vi.useFakeTimers();
    const originalHref = window.location.href;
    window.history.replaceState({}, '', '/characters/172153137');
    document.body.innerHTML = '<div class="ct-character-sheet" id="stale-sheet"></div>';
    const stopObserving = observeJournalTabTargets(() => {});
    try {
      document.getElementById('stale-sheet')
          ?.append(document.createElement('span'));
      await flushJournalScan();
      document.body.innerHTML = CURRENT_CHARACTER_SHEET_TABS_FIXTURE;
      await flushJournalScan();
      expect(journalTab()).toBeNull();

      await vi.advanceTimersByTimeAsync(500);
      expect(journalTab()?.textContent).toBe('Journal');
    } finally {
      stopObserving();
      window.history.replaceState({}, '', originalHref);
      vi.useRealTimers();
    }
  });
});

async function flushJournalScan(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

async function spendJournalScanBudget(sheet: HTMLElement): Promise<void> {
  await flushJournalScan();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    sheet.append(document.createElement('span'));
    await flushJournalScan();
  }
}

function journalTab(): Element | null {
  return document.querySelector('[data-bfa-character-journal-tab="true"]');
}

function indicatorCount(root: HTMLElement): number {
  const view = root.ownerDocument.defaultView;
  if (view === null) {
    return 0;
  }

  let count = 0;
  const nodes = [root, ...root.querySelectorAll<HTMLElement>('*')];
  for (const node of nodes) {
    count += indicatorLines(view.getComputedStyle(node));
    count += pseudoIndicators(node);
  }

  return count;
}

function pseudoIndicators(node: Element): number {
  let count = 0;
  for (const sheet of node.ownerDocument.styleSheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }

    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) {
        continue;
      }

      const selector = rule.selectorText;
      if (!selector.includes('::before') && !selector.includes('::after')) {
        continue;
      }

      const base = selector.replace(/::(?:before|after)/g, '');
      let matches = false;
      try {
        matches = node.matches(base);
      } catch {
        matches = false;
      }
      if (!matches) {
        continue;
      }

      count += indicatorLines(rule.style);
    }
  }

  return count;
}

function indicatorLines(style: CSSStyleDeclaration): number {
  let count = 0;
  const width = Number.parseFloat(style.borderBottomWidth);
  if (
    Number.isFinite(width)
    && width >= 2
    && style.borderBottomStyle !== 'none'
    && style.borderBottomStyle !== 'hidden'
  ) {
    count += 1;
  }

  if (style.boxShadow !== '' && style.boxShadow !== 'none') {
    count += 1;
  }

  return count;
}

function journalTabItem(tab: HTMLElement | null): HTMLElement | null {
  return tab?.closest<HTMLElement>('[data-bfa-character-journal-tab-item]') ?? null;
}

function tabPaint(tab: HTMLElement): {
  color: string;
  fontSize: string;
  fontWeight: string;
  letterSpacing: string;
  textTransform: string;
} {
  const style = tab.ownerDocument.defaultView?.getComputedStyle(tab);
  return {
    color: style?.color ?? '',
    fontSize: style?.fontSize ?? '',
    fontWeight: style?.fontWeight ?? '',
    letterSpacing: style?.letterSpacing ?? '',
    textTransform: style?.textTransform ?? '',
  };
}

function tabItem(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('.ddbc-tab-list__nav-item'))
      .find((element) => element.textContent?.trim() === label);
}
