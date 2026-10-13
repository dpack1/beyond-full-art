import {
  characterSheetTabsFixture,
  currentInformationSidebarFixture,
  legacyManagePaneFixture,
  missingHooksFixture,
  myCharactersCardFixture,
  NON_CHARACTER_URL,
  routeDndBeyondFixture,
  routeNonCharacterPage,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import {expect, test} from './support/extension-test';

test('enhances the current background-image sidebar portrait and opens the viewer', async ({
  extensionContext,
  page,
}) => {
  await routeDndBeyondFixture(extensionContext, currentInformationSidebarFixture);

  await page.goto(currentInformationSidebarFixture.url);
  await waitForContentScript(page);

  const portrait = page.locator('.styles_avatar__t7tEz');
  await expect(portrait).toHaveAttribute('data-bfa-enhanced', 'true');
  await expect(portrait).toHaveAttribute('role', 'button');

  await portrait.click();

  await expect(page.locator('.bfa-viewer-overlay')).toBeVisible();
  await expect(page.locator('.bfa-viewer-image')).toHaveAttribute(
    'src',
    /169418374\.jpeg/,
  );
});

test('keeps the legacy image sidebar portrait working', async ({
  extensionContext,
  page,
}) => {
  await routeDndBeyondFixture(extensionContext, legacyManagePaneFixture);

  await page.goto(legacyManagePaneFixture.url);
  await waitForContentScript(page);

  const portrait = page
    .locator(
      '[data-testid="character-manage-pane"] img.ddbc-character-avatar__portrait',
    )
    .first();
  await expect(portrait).toHaveAttribute('data-bfa-enhanced', 'true');

  await portrait.click();

  await expect(page.locator('.bfa-viewer-overlay')).toBeVisible();
  await expect(page.locator('.bfa-viewer-image')).toHaveAttribute(
    'src',
    /169418374\.jpeg/,
  );
});

test('does not throw or inject controls when known page hooks are missing', async ({
  extensionContext,
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  await routeDndBeyondFixture(extensionContext, missingHooksFixture);

  await page.goto(missingHooksFixture.url);
  await waitForContentScript(page);

  await expect(page.locator('[data-bfa-enhanced="true"]')).toHaveCount(0);
  await expect(page.locator('.bfa-art-sync')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('upgrades My Characters card portrait image quality', async ({
  extensionContext,
  page,
}) => {
  await routeDndBeyondFixture(extensionContext, myCharactersCardFixture);

  await page.goto(myCharactersCardFixture.url);
  await waitForContentScript(page);

  const portrait = page.locator('.character-card .image.user-selected-avatar');
  await expect(portrait).toHaveCSS(
    'background-image',
    /width=600.*height=600|height=600.*width=600/,
  );
  await expect(portrait).toHaveAttribute(
    'data-bfa-card-portrait-state',
    'upgraded',
  );
});

test('adds a local character journal tab with persisted entries', async ({
  extensionContext,
  page,
}) => {
  await routeDndBeyondFixture(extensionContext, characterSheetTabsFixture);

  await page.goto(characterSheetTabsFixture.url);
  await waitForContentScript(page);
  await expect(page.getByRole('button', {name: 'Journal'})).toBeVisible();

  const tabLabels = await page
    .locator('.ct-character-sheet-tab-item button')
    .evaluateAll((buttons) =>
      buttons.map((button) => button.textContent?.trim() ?? ''),
    );
  expect(tabLabels).toEqual([
    'Actions',
    'Inventory',
    'Extras',
    'Journal',
    'Notes',
  ]);

  await page.getByRole('button', {name: 'Journal'}).click();
  await expect(page.locator('.bfa-character-journal-section')).toBeVisible();
  await expect(page.locator('[data-testid="native-character-panel"]')).toBeHidden();
  await expect(page.locator('.bfa-character-journal-images')).toBeVisible();

  await page.getByLabel('Journal entry title').fill('Session note');
  await page.getByLabel('Journal entry body').fill('Matilda wrote this locally.');
  await page.getByRole('button', {name: 'Save'}).click();
  await expect(
      page.locator('.bfa-character-journal-editor > .bfa-character-journal-status'),
  ).toHaveText('Saved.');

  await page.reload();
  await waitForContentScript(page);
  await page.getByRole('button', {name: 'Journal'}).click();

  await expect(page.getByLabel('Journal entry title')).toHaveValue('Session note');
  await expect(page.getByLabel('Journal entry body'))
      .toHaveValue('Matilda wrote this locally.');

  await page.getByRole('button', {name: 'Actions'}).click();
  await expect(page.locator('.bfa-character-journal-section')).toBeHidden();
  await expect(page.locator('[data-testid="native-character-panel"]')).toBeVisible();
});

test('keeps the character journal reachable across viewport sizes', async ({
  extensionContext,
  page,
}) => {
  await routeDndBeyondFixture(extensionContext, characterSheetTabsFixture);

  for (const viewport of [
    {height: 812, name: 'phone', width: 375},
    {height: 900, name: 'tablet', width: 768},
    {height: 900, name: 'desktop', width: 1440},
  ]) {
    await page.setViewportSize({
      height: viewport.height,
      width: viewport.width,
    });
    await page.goto(characterSheetTabsFixture.url);
    await waitForContentScript(page);

    const journalTab = page.getByRole('button', {name: 'Journal'});
    await expect(journalTab, viewport.name).toBeVisible();
    await journalTab.click();

    await expect(page.locator('.bfa-character-journal-section'), viewport.name)
        .toBeVisible();
    await expect(page.getByLabel('Journal entry title'), viewport.name)
        .toBeVisible();
    await expect(page.getByLabel('Journal entry body'), viewport.name)
        .toBeVisible();
    await expect(page.getByRole('button', {name: 'Save'}), viewport.name)
        .toBeVisible();
    await expect(page.getByRole('button', {name: 'New entry'}), viewport.name)
        .toBeVisible();

    const hasPageOverflow = await page.evaluate(() =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
    );
    expect(hasPageOverflow, viewport.name).toBe(false);
  }
});

test('does not run on unrelated D&D Beyond pages', async ({
  extensionContext,
  page,
}) => {
  await routeNonCharacterPage(extensionContext);

  await page.goto(NON_CHARACTER_URL);
  await waitForContentScript(page);

  await expect(page.locator('[data-bfa-viewer-styles]')).toHaveCount(0);
  await expect(page.locator('[data-bfa-enhanced="true"]')).toHaveCount(0);
});
