import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {describe, expect, test} from 'vitest';

import {
  darkThemeSelectors,
  findSelectorHealthFailures,
  formatSelectorHealthFailure,
  selectorsForLiveCharacterSheet,
} from '../../src/platform/dndbeyond/selector-health';
import {DDB_SELECTORS} from '../../src/platform/dndbeyond/selectors';
import {
  CAMPAIGN_CHARACTER_CARD_FIXTURE,
  CAMPAIGN_THUMBNAIL_CHARACTER_CARD_FIXTURE,
  MY_CHARACTERS_CARD_FIXTURE,
  OWNED_CAMPAIGN_CHARACTER_CARD_FIXTURE,
} from '../fixtures/campaign-character-cards';
import {
  CHARACTER_MANAGE_PANE_FIXTURE,
  CURRENT_INFORMATION_SIDEBAR_FIXTURE,
} from '../fixtures/character-manage-pane';
import {
  CHARACTER_SHEET_TABS_FIXTURE,
  CURRENT_CHARACTER_SHEET_TABS_FIXTURE,
  LIVE_CHARACTER_SHEET_TABS_FIXTURE,
} from '../fixtures/character-sheet-tabs';
import {PORTRAIT_MANAGER_FIXTURE} from '../fixtures/portrait-manager';
import {SIDEBAR_SHELL_FIXTURE} from '../fixtures/sidebar-shell';

const fixtures: Record<string, string> = {
  'campaign-card': CAMPAIGN_CHARACTER_CARD_FIXTURE,
  'campaign-thumbnail-card': CAMPAIGN_THUMBNAIL_CHARACTER_CARD_FIXTURE,
  'current-sheet-tabs': CURRENT_CHARACTER_SHEET_TABS_FIXTURE,
  'information-sidebar': CURRENT_INFORMATION_SIDEBAR_FIXTURE,
  'live-sheet-tabs': LIVE_CHARACTER_SHEET_TABS_FIXTURE,
  'manage-pane': CHARACTER_MANAGE_PANE_FIXTURE,
  'my-characters-card': MY_CHARACTERS_CARD_FIXTURE,
  'owned-campaign-card': OWNED_CAMPAIGN_CHARACTER_CARD_FIXTURE,
  'portrait-manager': PORTRAIT_MANAGER_FIXTURE,
  'sidebar-shell': SIDEBAR_SHELL_FIXTURE,
  'sheet-tabs': CHARACTER_SHEET_TABS_FIXTURE,
};

const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);

// Tokens that must stay in the selector map. This is not a scan for every
// D&D Beyond string, only these class names and the avatar path.
const ddbClassPattern = /ddbc-|ct-decoration|ct-sidebar|ct-character|ct-theme|ct-primary|ddb-campaigns-|character-manage-pane|Information Sidebar|user-selected-avatar|\/avatars\//;

describe('selector health', () => {
  test('every code selector matches the fixture that is supposed to contain it', () => {
    const messages: string[] = [];
    for (const [fixtureId, html] of Object.entries(fixtures)) {
      document.body.innerHTML = html;
      const entries = DDB_SELECTORS.filter((entry) =>
        entry.fixtures.includes(fixtureId),
      );
      const failures = findSelectorHealthFailures(
          document,
          entries,
          `fixture "${fixtureId}"`,
      );
      messages.push(...failures.map(formatSelectorHealthFailure));
    }

    expect(messages).toEqual([]);
  });

  test('reports a named failure when a selector is missing', () => {
    document.body.innerHTML = '<main><p>No portrait tools on this page.</p></main>';
    const entry = DDB_SELECTORS.find((candidate) =>
      candidate.id === 'portrait-manager-upload-input',
    );
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }

    const [failure] = findSelectorHealthFailures(
        document,
        [entry],
        'fixture "portrait-manager"',
    );
    expect(failure).toBeDefined();
    if (failure === undefined) {
      return;
    }

    expect(formatSelectorHealthFailure(failure)).toBe([
      'Selector "portrait-manager-upload-input" failed.',
      'Selector: .ct-decoration-manager__upload-file-input[type="file"]',
      'Breaks: Full-art storage, Portrait edit panel, Portrait crop',
      'Targeted: Native file input inside the portrait manager upload form.',
      'Look for: The file picker in the portrait upload form, sheet sidebar or builder. D&D Beyond usually renamed the class. Find the input with type="file".',
      'Fix: update that one entry in src/platform/dndbeyond/selectors.ts. A renamed class is usually the whole fix.',
      'Checked fixture "portrait-manager". No element matched.',
    ].join('\n'));
  });

  test('names the journal tab labels when Extras cannot be found', () => {
    document.body.innerHTML = '<div>Spells</div>';
    const entry = DDB_SELECTORS.find((candidate) =>
      candidate.id === 'sheet-tab-labels',
    );
    expect(entry).toBeDefined();
    if (entry === undefined) {
      return;
    }

    const [failure] = findSelectorHealthFailures(
        document,
        [entry],
        'the live character sheet',
    );
    const message = failure === undefined
      ? ''
      : formatSelectorHealthFailure(failure);
    expect(message).toContain('Selector "sheet-tab-labels" failed.');
    expect(message).toContain('Breaks: Character journal');
    expect(message).toContain('right-hand content box');
    expect(message).toContain('"extras"');
  });

  test('keeps the catalog well formed', () => {
    const ids = DDB_SELECTORS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const entry of DDB_SELECTORS) {
      expect(entry.selector.trim()).not.toBe('');
      expect(entry.targets.trim()).not.toBe('');
      expect(entry.lookFor.trim()).not.toBe('');
      expect(entry.features.length).toBeGreaterThan(0);
      for (const fixtureId of entry.fixtures) {
        expect(fixtures[fixtureId], `${entry.id} names unknown fixture ${fixtureId}`)
            .toEqual(expect.any(String));
      }
      if (entry.source === 'code') {
        expect(entry.fixtures.length, entry.id).toBeGreaterThan(0);
      } else {
        expect(entry.fixtures, entry.id).toEqual([]);
        expect(entry.liveSheet || entry.darkThemeOnly, entry.id).toBe(true);
      }
    }
  });

  test('asks the live sheet only for selectors that are on the default view', () => {
    const unspecified = selectorsForLiveCharacterSheet('unspecified')
        .map((entry) => entry.id);
    expect(unspecified).toContain('sheet-tab-labels');
    expect(unspecified).toContain('sheet-tab-nav-item');
    expect(unspecified).toContain('primary-box');
    expect(unspecified).not.toContain('portrait-manager');
    expect(unspecified).not.toContain('theme-dark');

    const dark = selectorsForLiveCharacterSheet('dark').map((entry) => entry.id);
    expect(dark).toEqual(expect.arrayContaining(
        darkThemeSelectors().map((entry) => entry.id),
    ));
    expect(dark).toContain('character-sheet-dark-mode');
  });

  test('keeps D&D Beyond class strings inside the selector map', () => {
    const offenders: string[] = [];
    for (const filePath of sourceFiles(path.join(repoRoot, 'src'))) {
      if (filePath.endsWith(`${path.sep}platform${path.sep}dndbeyond${path.sep}selectors.ts`)) {
        continue;
      }
      const lines = readFileSync(filePath, 'utf8').split('\n');
      for (const [index, line] of lines.entries()) {
        if (ddbClassPattern.test(line)) {
          offenders.push(`${path.relative(repoRoot, filePath)}:${index + 1}: ${line.trim()}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...sourceFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      files.push(fullPath);
    }
  }
  return files;
}
