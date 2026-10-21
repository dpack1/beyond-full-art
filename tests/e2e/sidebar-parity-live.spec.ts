import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test} from './support/extension-test';
import {
  classTokenDrift,
  extraClassDrift,
  formatSidebarDrift,
  styleDrift,
  type SidebarDrift,
} from '../../src/platform/dndbeyond/sidebar-parity';

interface SidebarNode {
  className: string;
  match: string;
  role: string;
  styles?: Record<string, string>;
}

const REFERENCE_SHEET_URL = 'https://www.dndbeyond.com/characters/172153137';
const spec = JSON.parse(readFileSync(
    path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../docs/ddb-reference/sidebar.json',
    ),
    'utf8',
)) as {nodes: SidebarNode[]; optionalClasses: string[]};

const STYLE_ROLES = new Set(spec.nodes.filter((node) => node.styles !== undefined).map((node) => node.role));

test('diffs the journal panel against the live Information Sidebar', async ({page}) => {
  test.setTimeout(90_000);
  const sheetUrl = process.env.BFA_LIVE_CHARACTER_SHEET_URL?.trim() ?? '';
  test.skip(
      sheetUrl === '',
      `Set BFA_LIVE_CHARACTER_SHEET_URL to a logged-in sheet. The reference character is Matilda Greywolf at ${REFERENCE_SHEET_URL}.`,
  );
  await page.setViewportSize({width: 1440, height: 1100});
  await page.goto(sheetUrl, {timeout: 45_000, waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelector('#lanyard_root')?.remove();
    for (const button of document.querySelectorAll('button')) {
      if ((button.textContent ?? '').trim() === 'Accept All') {
        button.click();
      }
    }
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').trim().toLowerCase() === 'journal');
    tab?.click();
    document.querySelector<HTMLElement>('.bfa-journal-manage')?.click();
  });
  await page.waitForSelector('.bfa-journal-panel:not([hidden]) .ct-sidebar', {timeout: 15_000});
  const opened = await page.evaluate(() => {
    const skill = [...document.querySelectorAll('span, div, button')].find((element) =>
      (element.textContent ?? '').trim() === 'Acrobatics' && element.children.length < 4);
    if (skill instanceof HTMLElement) {
      skill.click();
      return true;
    }
    return false;
  });
  expect(opened, 'Acrobatics did not open the Information Sidebar').toBe(true);
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('.ct-sidebar__portal:not(.bfa-journal-panel) .ct-sidebar');
    return sidebar instanceof HTMLElement && sidebar.getBoundingClientRect().width > 200;
  });
  await page.waitForTimeout(300);

  const live = await page.evaluate((nodes) => {
    function read(root: Element | null) {
      if (root === null) {
        return [];
      }
      return nodes.map((node) => {
        const element = root.matches(node.match)
          ? root
          : root.querySelector(node.match);
        if (element === null) {
          return {className: '', role: node.role, styles: {}};
        }
        const computed = getComputedStyle(element);
        const styles: Record<string, string> = {};
        for (const key of Object.keys(node.styles ?? {})) {
          styles[key] = computed[key as keyof CSSStyleDeclaration]?.toString() ?? '';
        }
        return {
          className: element.getAttribute('class') ?? '',
          role: node.role,
          styles,
        };
      });
    }
    return {
      journal: read(document.querySelector('.bfa-journal-panel')),
      native: read(document.querySelector('.ct-sidebar__portal:not(.bfa-journal-panel)')),
    };
  }, spec.nodes.map((node) => ({
    match: node.match,
    role: node.role,
    styles: node.styles ?? {},
  })));

  const drifts: SidebarDrift[] = [];
  for (const node of spec.nodes) {
    if (node.role === 'nav') {
      continue;
    }
    const native = live.native.find((entry) => entry.role === node.role);
    const journal = live.journal.find((entry) => entry.role === node.role);
    drifts.push(...classTokenDrift(`native ${node.role}`, node.className, native?.className ?? ''));
    drifts.push(...extraClassDrift(
        `native ${node.role}`,
        node.className,
        native?.className ?? '',
        spec.optionalClasses,
    ));
    drifts.push(...classTokenDrift(`journal ${node.role}`, node.className, journal?.className ?? ''));
    if (node.styles !== undefined && STYLE_ROLES.has(node.role)) {
      drifts.push(...styleDrift(
          node.role,
          native?.styles ?? {},
          journal?.styles ?? {},
      ));
      const snapshotStyles = Object.fromEntries(
          Object.entries(node.styles).filter(([key]) => key !== 'backgroundColor'),
      );
      drifts.push(...styleDrift(
          `snapshot ${node.role}`,
          snapshotStyles,
          native?.styles ?? {},
      ));
    }
  }

  const messages = drifts.map(formatSidebarDrift);
  expect(messages, messages.join('\n')).toEqual([]);
});
