import {chromium, expect, test} from '@playwright/test';
import {JSDOM} from 'jsdom';

import {
  darkThemeSelectors,
  findSelectorHealthFailures,
  findSelectorsThatShouldBeAbsent,
  formatSelectorHealthFailure,
  parseLiveSheetTheme,
  selectorsForLiveCharacterSheet,
} from '../../src/platform/dndbeyond/selector-health';

const REFERENCE_SHEET_URL = 'https://www.dndbeyond.com/characters/172153137';

test('checks D&D Beyond selectors on a live character sheet', async () => {
  const sheetUrl = process.env.BFA_LIVE_CHARACTER_SHEET_URL?.trim() ?? '';
  test.skip(
      sheetUrl === '',
      `Set BFA_LIVE_CHARACTER_SHEET_URL to a logged-in sheet. The reference character is Matilda Greywolf at ${REFERENCE_SHEET_URL}.`,
  );

  const storageState = process.env.BFA_LIVE_STORAGE_STATE?.trim();
  const browser = await chromium.launch();
  const context = await browser.newContext(
      storageState !== undefined && storageState !== ''
        ? {storageState}
        : {},
  );
  const page = await context.newPage();

  try {
    await page.goto(sheetUrl, {
      timeout: 45_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('networkidle', {timeout: 15_000})
        .catch(() => undefined);

    if (/login|sign-in|signin/i.test(page.url())) {
      throw new Error(
          'The live sheet URL opened a sign-in page. Log in, save a Playwright storageState, and set BFA_LIVE_STORAGE_STATE. The reference sheet is Matilda Greywolf, ' +
          REFERENCE_SHEET_URL,
      );
    }

    const theme = parseLiveSheetTheme(process.env.BFA_LIVE_SHEET_THEME);
    const document = new JSDOM(await page.content()).window.document;
    const checked = `live character sheet ${sheetUrl}`;
    const failures = findSelectorHealthFailures(
        document,
        selectorsForLiveCharacterSheet(theme),
        checked,
    );
    if (theme === 'light') {
      failures.push(...findSelectorsThatShouldBeAbsent(
          document,
          darkThemeSelectors(),
          'live sheet with BFA_LIVE_SHEET_THEME=light',
      ));
    }

    const messages = failures.map(formatSelectorHealthFailure);
    expect(messages, messages.join('\n\n')).toEqual([]);
  } finally {
    await context.close();
    await browser.close();
  }
});
