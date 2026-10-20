import {copyFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

import {
  liveCharacterSheetFixture,
  routeDndBeyondFixture,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import {expect, test} from './support/extension-test';

const BUILD_DIR = path.resolve('.agent/design/journal-v2/build');
const PUBLIC_LIGHT = path.resolve(
    '.agent/design/journal-v2/reference/live-sheet-light.png',
);

test('saves light and dark journal screens beside the sheet reference', async ({
  extensionContext,
  page,
}) => {
  test.setTimeout(60_000);
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
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-empty-dark-desktop.png'),
  });

  await page.getByRole('button', {name: 'New note'}).click();
  await page.getByRole('menuitem', {name: 'NPC'}).click();
  await page.getByRole('textbox', {name: 'Title'}).fill('Warden of the chapel');
  await page.getByRole('textbox', {name: 'Note', exact: true}).fill('Met Matilda beside the locked door.');
  await expect(page.getByText('Saved', {exact: true})).toBeVisible();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-edit-dark-desktop.png'),
  });
  await page.getByRole('button', {name: 'Done editing'}).click();
  await expect(page.getByRole('dialog').getByText('Met Matilda beside the locked door.')).toBeVisible();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-read-dark-desktop.png'),
  });
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-populated-dark-desktop.png'),
  });

  await page.getByRole('button', {name: 'New note'}).click();
  await page.getByRole('menuitem', {name: 'Place'}).click();
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
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-populated-light-desktop.png'),
  });
  await page.getByRole('button', {name: /Warden of the chapel/}).click();
  await page.screenshot({
    path: path.join(BUILD_DIR, 'panel-read-light-desktop.png'),
  });
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();

  await page.setViewportSize({width: 375, height: 812});
  await page.screenshot({
    path: path.join(BUILD_DIR, 'list-light-375.png'),
  });
});

async function openJournal(page: import('@playwright/test').Page): Promise<void> {
  await page.locator('[data-bfa-character-journal-tab-item]').click({
    position: {x: 4, y: 4},
  });
  await expect(page.getByRole('heading', {name: 'Journal'})).toBeVisible();
}
