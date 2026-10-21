import {copyFile, mkdir, readFile} from 'node:fs/promises';
import path from 'node:path';

import {
  liveCharacterSheetFixture,
  routeDndBeyondFixture,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import type {Page} from '@playwright/test';

import {expect, test} from './support/extension-test';

const BUILD_DIR = path.resolve('.agent/design/journal-v2/build');
const PUBLIC_LIGHT = path.resolve(
    '.agent/design/journal-v2/reference/live-sheet-light.png',
);
const NATIVE = path.resolve('docs/ddb-reference');
const NOTE_BODY = '**Bold vow**\n\n- first oath\n- second oath';

test('saves light and dark journal screens beside the sheet reference', async ({
  extensionContext,
  page,
}) => {
  test.setTimeout(90_000);
  await mkdir(BUILD_DIR, {recursive: true});
  await copyFile(PUBLIC_LIGHT, path.join(BUILD_DIR, 'reference-public-sheet-light.png'));
  await routeDndBeyondFixture(extensionContext, liveCharacterSheetFixture);
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto(liveCharacterSheetFixture.url);
  await waitForContentScript(page);

  await page.screenshot({
    path: path.join(BUILD_DIR, 'reference-fixture-dark.png'),
  });
  await openJournal(page);
  await page.locator('.bfa-journal-section-toolbar').screenshot({
    path: path.join(BUILD_DIR, 'toolbar-dark.png'),
  });
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-empty-dark-desktop.png'),
  });
  await page.getByRole('button', {name: 'Filter'}).click();
  await expect(page.getByRole('checkbox', {name: 'Sessions'})).toBeVisible();
  await page.locator('.bfa-character-journal-section').screenshot({
    path: path.join(BUILD_DIR, 'filter-open-dark.png'),
  });
  await page.keyboard.press('Escape');

  await page.getByRole('button', {name: 'Manage Notes'}).click();
  await page.getByRole('combobox', {name: 'Type'}).selectOption('npc');
  await page.getByRole('textbox', {name: 'Title'}).fill('Warden of the chapel');
  await page.getByRole('textbox', {name: 'Note', exact: true}).fill(NOTE_BODY);
  await expect(page.getByText('Saved', {exact: true})).toBeVisible();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-edit-dark-desktop.png'),
  });
  await shotHeader(page, 'header-dark.png');
  await page.getByRole('button', {name: 'Done editing'}).click();
  await expect(page.locator('.bfa-journal-read strong')).toHaveText('Bold vow');
  await expect(page.locator('.bfa-journal-read li').first()).toHaveText('first oath');
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-read-dark-desktop.png'),
  });
  await shotHeader(page, 'header-read-dark.png');
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-populated-dark-desktop.png'),
  });

  await page.getByRole('button', {name: 'Manage Notes'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByText('This note is not saved yet.')).toBeVisible();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-discard-dark-desktop.png'),
  });
  await page.getByRole('button', {name: 'Discard'}).click();

  await page.setViewportSize({width: 375, height: 812});
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-dark-375.png'),
  });
  await page.getByRole('button', {name: /Warden of the chapel/}).click();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-read-dark-375.png'),
  });
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.setViewportSize({width: 1280, height: 900});
  await page.getByRole('button', {name: 'Appearance'}).click();
  await expect(page.locator('#sheet')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({
    path: path.join(BUILD_DIR, 'reference-fixture-light.png'),
  });
  await page.locator('.bfa-journal-section-toolbar').screenshot({
    path: path.join(BUILD_DIR, 'toolbar-light.png'),
  });
  await page.getByRole('button', {name: 'Filter'}).click();
  await expect(page.getByRole('checkbox', {name: 'NPCs'})).toBeVisible();
  await page.locator('.bfa-character-journal-section').screenshot({
    path: path.join(BUILD_DIR, 'filter-open-light.png'),
  });
  await page.keyboard.press('Escape');
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-populated-light-desktop.png'),
  });
  await page.getByRole('button', {name: /Warden of the chapel/}).click();
  await expect(page.locator('.bfa-journal-read strong')).toHaveText('Bold vow');
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-read-light-desktop.png'),
  });
  await shotHeader(page, 'header-light.png');
  await page.getByRole('button', {name: 'Edit'}).click();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-edit-light-desktop.png'),
  });
  await shotHeader(page, 'header-edit-light.png');
  await page.getByRole('button', {name: 'Done editing'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', {name: 'Manage Notes'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByText('This note is not saved yet.')).toBeVisible();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-discard-light-desktop.png'),
  });
  await page.getByRole('button', {name: 'Discard'}).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.setViewportSize({width: 375, height: 812});
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-light-375.png'),
  });
  await page.getByRole('button', {name: /Warden of the chapel/}).click();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-read-light-375.png'),
  });

  await writePair(page, 'extras-tab-dark.png', 'toolbar-dark.png', 'compare-toolbar-dark.png', 'Toolbar');
  await writePair(page, 'extras-tab-light.png', 'toolbar-light.png', 'compare-toolbar-light.png', 'Toolbar');
  await writePair(page, 'extras-tab-dark.png', 'filter-open-dark.png', 'compare-filter-dark.png', 'Filter');
  await writePair(page, 'extras-tab-light.png', 'filter-open-light.png', 'compare-filter-light.png', 'Filter');
  await writePair(page, 'sidebar-item-dark.png', 'panel-read-dark-desktop.png', 'compare-read-dark.png', 'Read');
  await writePair(page, 'sidebar-item-light.png', 'panel-read-light-desktop.png', 'compare-read-light.png', 'Read');
  await writePair(page, 'sidebar-form-dark.png', 'panel-edit-dark-desktop.png', 'compare-edit-dark.png', 'Edit');
  await writePair(page, 'sidebar-form-light.png', 'panel-edit-light-desktop.png', 'compare-edit-light.png', 'Edit');
  await writePair(page, 'sidebar-item-dark.png', 'header-dark.png', 'compare-header-dark.png', 'Header');
  await writePair(page, 'sidebar-item-light.png', 'header-light.png', 'compare-header-light.png', 'Header');
});

async function openJournal(page: Page): Promise<void> {
  await page.locator('[data-bfa-character-journal-tab-item]').click({
    position: {x: 4, y: 4},
  });
  await expect(page.getByRole('button', {name: 'Manage Notes'})).toBeVisible();
}

async function shotHeader(page: Page, name: string): Promise<void> {
  const chrome = await page.locator('.bfa-journal-panel [role="dialog"]').boundingBox();
  const title = await page.locator('.bfa-journal-panel-title').boundingBox();
  if (chrome === null || title === null) {
    throw new Error('Missing sidebar chrome');
  }
  await page.screenshot({
    clip: {
      height: title.y + title.height - chrome.y + 12,
      width: Math.max(chrome.width, title.width + (title.x - chrome.x)),
      x: chrome.x,
      y: chrome.y,
    },
    path: path.join(BUILD_DIR, name),
  });
}

async function writePair(
    page: Page,
    nativeName: string,
    oursName: string,
    outName: string,
    caption: string,
): Promise<void> {
  const native = (await readFile(path.join(NATIVE, nativeName))).toString('base64');
  const ours = (await readFile(path.join(BUILD_DIR, oursName))).toString('base64');
  await page.setViewportSize({width: 1400, height: 900});
  await page.setContent(`<!doctype html>
    <html>
      <body style="margin:0;background:#1c2428;color:#f4f1ec;font:14px sans-serif">
        <h1 style="margin:12px 16px;font-size:16px">${caption}: native, then journal</h1>
        <div style="display:flex;gap:12px;align-items:flex-start;padding:0 12px 12px">
          <img alt="Native" src="data:image/png;base64,${native}" style="width:48%;height:auto">
          <img alt="Journal" src="data:image/png;base64,${ours}" style="width:48%;height:auto;background:#111">
        </div>
      </body>
    </html>`);
  await page.screenshot({
    fullPage: true,
    path: path.join(BUILD_DIR, outName),
  });
}
