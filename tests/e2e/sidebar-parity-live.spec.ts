import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {expect, test} from './support/extension-test';
import {
  classTokenDrift,
  controlsSitOnPanel,
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
const PLACEMENT_KEYS = new Set(['height', 'left', 'position', 'right', 'top', 'width', 'zIndex']);

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
  const nativeOpen = await page.evaluate((nodes) => {
    const root = document.querySelector('.ct-sidebar__portal:not(.bfa-journal-panel)');
    const sidebar = root?.querySelector('.ct-sidebar');
    return {
      nodes: readSidebar(root, nodes),
      top: sidebar instanceof HTMLElement ? sidebar.getBoundingClientRect().top : 0,
    };

    function readSidebar(
        sidebarRoot: Element | null,
        specs: {match: string; role: string; styles: Record<string, string>}[],
    ) {
      if (sidebarRoot === null) {
        return [];
      }
      return specs.map((node) => {
        const element = sidebarRoot.matches(node.match)
          ? sidebarRoot
          : sidebarRoot.querySelector(node.match);
        if (element === null) {
          return {className: '', role: node.role, styles: {}};
        }
        const computed = getComputedStyle(element);
        const styles: Record<string, string> = {};
        for (const key of Object.keys(node.styles)) {
          styles[key] = computed[key as keyof CSSStyleDeclaration]?.toString() ?? '';
        }
        return {
          className: element.getAttribute('class') ?? '',
          role: node.role,
          styles,
        };
      });
    }
  }, spec.nodes.map((node) => ({
    match: node.match,
    role: node.role,
    styles: node.styles ?? {},
  })));

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button')].find((button) =>
      (button.textContent ?? '').trim().toLowerCase() === 'journal');
    tab?.click();
    document.querySelector<HTMLElement>('.bfa-journal-manage')?.click();
  });
  await page.waitForSelector('.bfa-journal-panel:not([hidden]) .ct-sidebar', {timeout: 15_000});
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('.ct-sidebar__portal:not(.bfa-journal-panel) .ct-sidebar');
    return sidebar instanceof HTMLElement && sidebar.getBoundingClientRect().width < 80;
  });

  const journal = await page.evaluate((nodes) => {
    const root = document.querySelector('.bfa-journal-panel');
    const dialog = root?.querySelector('.ct-sidebar');
    const controls = root?.querySelector('.styles_controls__NSnn3');
    const pane = root?.querySelector('.styles_pane__AOt0h');
    const dialogStyle = dialog instanceof HTMLElement ? getComputedStyle(dialog) : null;
    return {
      height: dialogStyle?.height ?? '',
      nodes: readSidebar(root, nodes),
      position: dialogStyle?.position ?? '',
      rects: {
        controls: box(controls),
        paneTop: pane instanceof HTMLElement ? pane.getBoundingClientRect().top : 0,
        panel: box(dialog),
      },
      right: dialogStyle?.right ?? '',
      top: dialogStyle?.top ?? '',
      viewportHeight: window.innerHeight,
      width: dialogStyle?.width ?? '',
      zIndex: dialogStyle?.zIndex ?? '',
    };

    function box(element: Element | null | undefined) {
      const rect = element instanceof HTMLElement
        ? element.getBoundingClientRect()
        : {bottom: 0, left: 0, right: 0, top: 0};
      return {bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top};
    }

    function readSidebar(
        sidebarRoot: Element | null,
        specs: {match: string; role: string; styles: Record<string, string>}[],
    ) {
      if (sidebarRoot === null) {
        return [];
      }
      return specs.map((node) => {
        const element = sidebarRoot.matches(node.match)
          ? sidebarRoot
          : sidebarRoot.querySelector(node.match);
        if (element === null) {
          return {className: '', role: node.role, styles: {}};
        }
        const computed = getComputedStyle(element);
        const styles: Record<string, string> = {};
        for (const key of Object.keys(node.styles)) {
          styles[key] = computed[key as keyof CSSStyleDeclaration]?.toString() ?? '';
        }
        return {
          className: element.getAttribute('class') ?? '',
          role: node.role,
          styles,
        };
      });
    }
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
    const native = nativeOpen.nodes.find((entry) => entry.role === node.role);
    const ours = journal.nodes.find((entry) => entry.role === node.role);
    drifts.push(...classTokenDrift(`native ${node.role}`, node.className, native?.className ?? ''));
    drifts.push(...extraClassDrift(
        `native ${node.role}`,
        node.className,
        native?.className ?? '',
        spec.optionalClasses,
    ));
    drifts.push(...classTokenDrift(`journal ${node.role}`, node.className, ours?.className ?? ''));
    if (node.styles !== undefined && STYLE_ROLES.has(node.role)) {
      const sharedStyles = Object.fromEntries(
          Object.entries(native?.styles ?? {}).filter(([key]) => !PLACEMENT_KEYS.has(key)),
      );
      drifts.push(...styleDrift(node.role, sharedStyles, ours?.styles ?? {}));
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
  drifts.push(...controlsSitOnPanel({
    controls: journal.rects.controls,
    paneTop: journal.rects.paneTop,
    panel: journal.rects.panel,
  }));

  const messages = drifts.map(formatSidebarDrift);
  expect(messages, messages.join('\n')).toEqual([]);
  expect(journal.position).toBe('fixed');
  expect(journal.right).toBe('0px');
  expect(journal.width).toBe('400px');
  expect(journal.zIndex).toBe('10001');
  const top = Number.parseFloat(journal.top);
  const height = Number.parseFloat(journal.height);
  expect(Math.abs(top - nativeOpen.top)).toBeLessThanOrEqual(8);
  expect(Math.abs(height - (journal.viewportHeight - top))).toBeLessThanOrEqual(2);
  expect(journal.rects.panel.right).toBeGreaterThan(journal.rects.panel.left + 300);
  expect(journal.rects.controls.top).toBeGreaterThanOrEqual(journal.rects.panel.top - 2);
  expect(journal.rects.controls.bottom).toBeLessThanOrEqual(journal.rects.paneTop + 12);
});
