import {afterEach, beforeEach, describe, expect, it} from 'vitest';

import {
  findOrCreateJournalTab,
  observeJournalTabTargets,
} from '../../src/platform/dndbeyond/character-sheet-tabs-adapter';
import {
  CHARACTER_SHEET_TABS_FIXTURE,
  CURRENT_CHARACTER_SHEET_TABS_FIXTURE,
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
});
