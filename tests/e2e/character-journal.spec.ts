import {mkdir} from 'node:fs/promises';
import path from 'node:path';

import {
  characterSheetTabsFixture,
  routeDndBeyondFixture,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import {expect, test} from './support/extension-test';

const ARTIFACT_DIR = '/opt/cursor/artifacts/journal';
const PHOTO_FIXTURE = path.resolve('assets/icons/icon-128.png');

test('uses the journal for notes, photos, and search', async ({
  extensionContext,
  page,
}) => {
  await mkdir(ARTIFACT_DIR, {recursive: true});
  await routeDndBeyondFixture(extensionContext, characterSheetTabsFixture);
  await page.setViewportSize({width: 1280, height: 900});
  await page.goto(characterSheetTabsFixture.url);
  await waitForContentScript(page);

  await page.getByRole('button', {name: 'Journal'}).click();
  await expect(page.getByText('No notes yet.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Journal'})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-empty.png'),
  });

  await page.getByLabel('Journal entry title').fill('The locked door');
  await page.getByLabel('Journal entry body').fill(
      'Matilda found a locked door beneath the chapel.',
  );
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(page.getByText('Saved.', {exact: true})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-saved-note.png'),
  });

  await page.locator('.bfa-character-journal-photo-input').setInputFiles(PHOTO_FIXTURE);
  const photoButton = page.getByRole('button', {name: 'View photo icon-128.png'});
  await expect(photoButton).toBeVisible();
  await expect(page.locator('.bfa-character-journal-photo img')).toBeVisible();
  await expect(page.getByText('Photo added.')).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-with-photo.png'),
  });

  await page.reload();
  await waitForContentScript(page);
  await page.getByRole('button', {name: 'Journal'}).click();
  await expect(page.getByLabel('Journal entry title')).toHaveValue('The locked door');
  await expect(page.locator('.bfa-character-journal-photo img')).toBeVisible();

  await page.getByRole('button', {name: 'View photo icon-128.png'}).click();
  await expect(page.getByRole('dialog', {name: 'icon-128.png'})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-photo-viewer.png'),
  });
  await page.getByRole('button', {name: 'Close photo'}).click();
  await expect(page.getByRole('dialog', {name: 'icon-128.png'})).toBeHidden();

  await page.getByRole('button', {name: 'New entry'}).click();
  await page.getByLabel('Journal entry title').fill('Market day');
  await page.getByLabel('Journal entry body').fill(
      'Bought rope and rations before the rain.',
  );
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(page.getByText('Saved.', {exact: true})).toBeVisible();

  await page.getByLabel('Search notes').fill('chapel');
  await expect(page.getByRole('button', {name: /The locked door/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Market day/})).toHaveCount(0);
  await page.getByRole('button', {name: /The locked door/}).click();
  await expect(page.getByLabel('Journal entry title')).toHaveValue('The locked door');
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-search-match.png'),
  });

  await page.getByLabel('Search notes').fill('zzzz-no-match');
  await expect(page.getByText(/No notes match/)).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-search-empty.png'),
  });

  await page.getByLabel('Search notes').fill('');
  await page.getByRole('button', {name: 'With photos'}).click();
  await expect(page.getByRole('button', {name: /The locked door/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Market day/})).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-photo-filter.png'),
  });

  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('button', {name: 'All notes'}).click();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-phone.png'),
  });
});
