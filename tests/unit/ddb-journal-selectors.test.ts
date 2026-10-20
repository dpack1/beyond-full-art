import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';

import {describe, expect, it} from 'vitest';

import {
  JOURNAL_SELECTOR_HEALTH,
  type JournalSelectorFixture,
} from '../../src/ddb/selectors';

const FIXTURES: Record<JournalSelectorFixture, string> = {
  'classic-tabs': `
    <div class="ct-character-sheet ct-character-sheet--dark-mode">
      <div class="ddbc-tab-list__nav">
        <div class="ddbc-tab-list__nav-item ddbc-tab-list__nav-item--is-active">Extras</div>
      </div>
      <div class="ddbc-tab-list__content"></div>
    </div>
  `,
  'primary-box': `
    <section class="ct-primary-box">
      <h2 class="ct-primary-box__label">Actions</h2>
      <div class="ct-primary-box__tab"></div>
    </section>
  `,
  sidebar: `
    <div class="ct-sidebar__portal">
      <aside class="ct-sidebar">
        <div class="ct-sidebar__inner">
          <header class="ct-sidebar__header">
            <h2 class="ct-sidebar__heading">Allies</h2>
          </header>
        </div>
      </aside>
    </div>
  `,
};

describe('journal D&D Beyond selector health', () => {
  it('matches every journal selector in the fixture that owns it', () => {
    for (const fixture of Object.keys(FIXTURES) as JournalSelectorFixture[]) {
      document.body.innerHTML = FIXTURES[fixture];
      const checks = JOURNAL_SELECTOR_HEALTH.filter((check) => check.fixture === fixture);
      expect(checks.length).toBeGreaterThan(0);
      for (const check of checks) {
        const match = document.querySelector(check.selector);
        expect(
            match,
            `${check.name} (${check.selector}) matched nothing in the ${fixture} fixture. ${check.feature}`,
        ).not.toBeNull();
      }
    }
  });

  it('keeps journal D&D Beyond class names inside the selector map', () => {
    const map = readFileSync(
        path.resolve('src/ddb/selectors.ts'),
        'utf8',
    );
    const offenders: string[] = [];
    for (const file of sourceFiles(path.resolve('src/features/character-journal'))) {
      offenders.push(...selectorsOutsideMap(file, map));
    }
    offenders.push(...selectorsOutsideMap(
        path.resolve('src/platform/dndbeyond/character-sheet-tabs-adapter.ts'),
        map,
    ));
    offenders.push(...selectorsOutsideMap(
        path.resolve('src/features/character-journal/character-journal-theme.ts'),
        map,
    ));

    expect(
        offenders,
        offenders.join('\n'),
    ).toEqual([]);
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

function selectorsOutsideMap(file: string, map: string): string[] {
  const source = readFileSync(file, 'utf8');
  const tokens = source.match(/\b(?:ct|ddbc)-[A-Za-z0-9_-]+/g) ?? [];
  const hashed = source.match(/\bstyles_[A-Za-z0-9_-]+/g) ?? [];
  const relative = path.relative(process.cwd(), file);
  return [
    ...tokens
        .filter((token) => !map.includes(token))
        .map((token) =>
          `${relative} uses ${token}, which is not in the Journal group of src/ddb/selectors.ts. Add it there or the feature that queries it breaks with no name in the health test.`),
    ...hashed.map((token) =>
      `${relative} hardcodes hashed class ${token}. Copy that class from the live sheet at runtime; a D&D Beyond deploy changes the hash and the Journal tab or panel stops matching.`),
  ];
}
