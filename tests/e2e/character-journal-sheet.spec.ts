import {mkdir} from 'node:fs/promises';
import path from 'node:path';

import {
  liveCharacterSheetFixture,
  routeDndBeyondFixture,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import {expect, test} from './support/extension-test';

const ARTIFACT_DIR = '/opt/cursor/artifacts/journal';

test('opens the live-shaped journal on the first click in dark and light themes', async ({
  extensionContext,
  page,
}) => {
  await mkdir(ARTIFACT_DIR, {recursive: true});
  await routeDndBeyondFixture(extensionContext, liveCharacterSheetFixture);
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto(liveCharacterSheetFixture.url);
  await waitForContentScript(page);
  await page.locator('[data-bfa-character-journal-tab-item]').click({
    position: {x: 4, y: 4},
  });

  const journalTab = page.locator('[data-bfa-character-journal-tab="true"]');
  const journalItem = page.locator('[data-bfa-character-journal-tab-item]');
  await expect(journalTab).toHaveCSS('text-transform', 'uppercase');
  await expect(journalTab).toHaveCSS('border-top-width', '0px');
  await expect(journalTab).toHaveCSS('border-bottom-width', '0px');
  await expect(journalTab).toHaveCSS('outline-style', 'none');
  await expect(journalTab.locator('svg')).toHaveCount(0);
  await expect(journalItem).toHaveClass(/is-active/);
  await expect(journalItem).toHaveCSS('box-shadow', /rgb\(197, 49, 45\)/);

  const journal = page.locator('.bfa-character-journal-section');
  await expect(journal).toBeVisible();
  await expect(page.getByText('No notes yet.')).toBeVisible();
  await expect(journalItem).toHaveClass(/ddbc-tab-list__nav-item--is-active/);
  await expect(page.locator('.ddbc-tab-list__nav-item--is-active')).toHaveCount(1);
  await expect(page.locator('[data-testid="sheet-scroller"] .bfa-character-journal-section'))
      .toBeVisible();
  await expect(page.locator('#sheet-nav')).not.toHaveAttribute('data-sheet-pointerdowns');

  const darkHeading = await page.locator('.bfa-character-journal-heading')
      .evaluate((element) => getComputedStyle(element).color);
  const darkSearch = await page.locator('.bfa-character-journal-search')
      .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(relativeLuminance(darkHeading)).toBeGreaterThan(0.6);
  expect(darkSearch).not.toBe('rgb(255, 255, 255)');
  await page.locator('#sheet-nav').screenshot({
    path: path.join(ARTIFACT_DIR, 'journal-tab-dark.png'),
  });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'journal-dark.png'),
  });

  await page.getByLabel('Journal entry body').fill(`${'A long session note. '.repeat(80)}\n`);
  const save = page.getByRole('button', {name: 'Save'});
  await save.scrollIntoViewIfNeeded();
  const saveBox = await save.boundingBox();
  const scrollerBox = await page.getByTestId('sheet-scroller').boundingBox();
  expect(saveBox).not.toBeNull();
  expect(scrollerBox).not.toBeNull();
  if (saveBox !== null && scrollerBox !== null) {
    expect(saveBox.y).toBeGreaterThanOrEqual(scrollerBox.y - 1);
    expect(saveBox.y + saveBox.height)
        .toBeLessThanOrEqual(scrollerBox.y + scrollerBox.height + 1);
  }
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'journal-dark-scrolled.png'),
  });

  await page.getByRole('button', {name: 'Appearance'}).click();
  await expect(page.locator('#sheet')).toHaveAttribute('data-theme', 'light');
  await expect.poll(async () => relativeLuminance(
      await page.locator('.bfa-character-journal-heading')
          .evaluate((element) => getComputedStyle(element).color),
  )).toBeLessThan(0.35);
  await page.locator('#sheet-nav').screenshot({
    path: path.join(ARTIFACT_DIR, 'journal-tab-light.png'),
  });
  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'journal-light.png'),
  });
});

function relativeLuminance(color: string): number {
  const match = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(color);
  if (match === null) {
    throw new Error(`Unparsed color ${color}`);
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);
  return ((0.2126 * red) + (0.7152 * green) + (0.0722 * blue)) / 255;
}
