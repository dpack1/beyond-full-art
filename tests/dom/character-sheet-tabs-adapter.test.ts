import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  clearNativeTabSelection,
  findOrCreateJournalTab,
  markNextNativeTab,
  observeJournalTabTargets,
  restoreNativeTabAfterJournal,
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
    expect(target?.tab.parentElement?.className ?? '')
        .not.toContain('is-active');
    expect(target?.tab.querySelector('svg')).toBeNull();
    expect(target?.tab.textContent).toBe('Journal');
    expect(target?.tab.parentElement?.dataset.bfaNativeActiveClass)
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
    const journalItem = target?.tab.parentElement;
    if (target === null || spells === undefined || actions === undefined || journalItem === null || journalItem === undefined) {
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
    expect(target.tab.parentElement?.dataset.bfaNativeActiveClass)
        .toBe('ddbc-tab-list__nav-item--is-active');
  });
});

function tabItem(label: string): HTMLElement | undefined {
  return Array.from(document.querySelectorAll<HTMLElement>('.ddbc-tab-list__nav-item'))
      .find((element) => element.textContent?.trim() === label);
}
