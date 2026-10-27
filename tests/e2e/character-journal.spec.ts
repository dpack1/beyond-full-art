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
  await expect(page.getByText('No notes', {exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'New Note'})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-empty.png'),
  });

  await page.getByRole('button', {name: 'New Note'}).click();
  await page.getByRole('combobox', {name: 'Type'}).selectOption('session');
  await page.getByRole('textbox', {name: 'Title'}).fill('The locked door');
  await page.getByRole('textbox', {name: 'Note', exact: true}).fill([
    '**Bold vow** and *soft* beneath the chapel.',
    '# Hall',
    '- outer',
    '  - inner',
    '- [ ] packed',
    'See [site](https://example.com/notes) and [[Voss]].',
  ].join('\n\n'));
  await expect(page.getByText('Saved', {exact: true})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-saved-note.png'),
  });

  await page.locator('.bfa-journal-file-input').setInputFiles(PHOTO_FIXTURE);
  await expect(page.getByRole('textbox', {name: 'Note', exact: true})).toHaveValue(
      /!\[\[img:[A-Za-z0-9-]+\|icon-128\.png\]\]/,
  );
  await page.getByRole('button', {name: 'Done editing'}).click();
  await page.addStyleTag({
    content: [
      '.ct-sidebar strong, .ct-note-manage-pane strong { font-weight: 400; }',
      '.ct-sidebar em, .ct-note-manage-pane em { font-style: normal; }',
      '.ct-note-manage-pane { white-space: pre-wrap; }',
    ].join(''),
  });
  const readStyles = await page.locator('.bfa-journal-read').evaluate((read) => {
    const strong = read.querySelector('strong');
    const em = read.querySelector('em');
    return {
      em: em instanceof HTMLElement ? getComputedStyle(em).fontStyle : '',
      strong: strong instanceof HTMLElement ? getComputedStyle(strong).fontWeight : '',
      text: read.textContent ?? '',
      whiteSpace: getComputedStyle(read).whiteSpace,
    };
  });
  expect(readStyles.text).toContain('Bold vow');
  expect(readStyles.text).not.toContain('**');
  expect(['700', 'bold']).toContain(readStyles.strong);
  expect(readStyles.em).toBe('italic');
  expect(readStyles.whiteSpace).toBe('normal');
  const photoButton = page.getByRole('button', {name: 'View photo icon-128.png'});
  await expect(photoButton).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-with-photo.png'),
  });

  await page.reload();
  await waitForContentScript(page);
  await page.getByRole('button', {name: 'Journal'}).click();
  await page.getByRole('button', {name: /The locked door/}).click();
  await expect(page.getByRole('heading', {name: 'The locked door'})).toBeVisible();
  await expect(page.locator('.bfa-journal-read .bfa-journal-inline-image')).toBeVisible();

  await page.getByRole('button', {name: 'View photo icon-128.png'}).click();
  await expect(page.getByRole('dialog', {name: 'icon-128.png'})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-photo-viewer.png'),
  });
  await page.getByRole('button', {name: 'Close photo'}).click();
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByRole('button', {name: 'New Note'}).click();
  await page.getByRole('combobox', {name: 'Type'}).selectOption('place');
  await page.getByRole('textbox', {name: 'Title'}).fill('Market day');
  await page.getByRole('textbox', {name: 'Note', exact: true}).fill('Bought rope and rations before the rain.');
  await expect(page.getByText('Saved', {exact: true})).toBeVisible();
  await page.getByRole('dialog').getByRole('button', {name: 'Close', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  await page.getByLabel('Search notes').fill('chapel');
  await expect(page.getByRole('button', {name: /The locked door/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Market day/})).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-search-match.png'),
  });

  await page.getByLabel('Search notes').fill('zzzz-no-match');
  await expect(page.getByText('No matches', {exact: true})).toBeVisible();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-search-empty.png'),
  });

  await page.getByLabel('Search notes').fill('');
  await page.getByRole('button', {name: 'Filter'}).click();
  await page.getByRole('checkbox', {name: 'Sessions'}).check();
  await expect(page.getByRole('button', {name: /The locked door/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Market day/})).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-photo-filter.png'),
  });

  await page.setViewportSize({width: 390, height: 844});
  await page.getByRole('checkbox', {name: 'Sessions'}).uncheck();
  await page.screenshot({
    fullPage: true,
    path: path.join(ARTIFACT_DIR, 'journal-phone.png'),
  });
});
