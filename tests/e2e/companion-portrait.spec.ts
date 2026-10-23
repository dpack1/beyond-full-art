import {
  extrasCompanionFixture,
  routeDndBeyondFixture,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import {expect, test} from './support/extension-test';

test('selects, restores, and clears a companion portrait', async ({
  extensionContext,
  page,
}) => {
  await routeDndBeyondFixture(extensionContext, extrasCompanionFixture);
  await page.goto(extrasCompanionFixture.url);
  await waitForContentScript(page);

  const checkbox = page.getByRole('checkbox', {
    name: 'Show Petali beside character portrait',
  });
  await expect(checkbox).toBeVisible();
  await checkbox.check();

  const overlay = page.locator('[data-bfa-companion-overlay]');
  await expect(overlay).toBeVisible();
  await expect(overlay).toHaveAttribute('alt', 'Petali companion portrait');
  await expect(overlay).toHaveCSS('pointer-events', 'none');

  await page.reload();
  await waitForContentScript(page);
  await expect(page.locator('[data-bfa-companion-overlay]')).toBeVisible();
  await expect(page.getByRole('checkbox', {
    name: 'Show Petali beside character portrait',
  })).toBeChecked();

  await page.getByRole('checkbox', {
    name: 'Show Petali beside character portrait',
  }).uncheck();
  await expect(page.locator('[data-bfa-companion-overlay]')).toHaveCount(0);
});
