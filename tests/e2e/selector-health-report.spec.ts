import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  CHANGE_PORTRAIT_BUTTON_TEXT,
  CHARACTER_LIST_CARD_PORTRAIT_SELECTOR,
  CHARACTER_MANAGE_PANE_SELECTOR,
  CHARACTER_PORTRAIT_SURFACE_SELECTOR,
  CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME,
  ENHANCED_ATTRIBUTE_NAME,
  INFORMATION_SIDEBAR_SELECTOR,
  PORTRAIT_MANAGER_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
  PORTRAIT_MANAGER_UPLOAD_SELECTOR,
  VIEWER_STYLE_ATTRIBUTE_NAME,
} from '../../src/platform/dndbeyond/selectors';
import {
  characterSheetTabsFixture,
  currentDecorationsWithoutUploadFixture,
  currentInformationSidebarFixture,
  legacyManagePaneFixture,
  missingHooksFixture,
  myCharactersCardFixture,
  portraitManagerFixture,
  routeDndBeyondFixture,
  type RoutedFixture,
  waitForContentScript,
} from './support/dndbeyond-fixtures';
import {expect, test} from './support/extension-test';

interface ExpectedHealth {
  enhancedPortraitCount?: number;
  journalSectionFound?: boolean;
  journalTabFound?: boolean;
  sharperCardPortraitFound?: boolean;
  informationSidebarFound?: boolean;
  legacyPanelFound?: boolean;
  portraitManagerFound?: boolean;
  portraitSurfaceFound?: boolean;
  uploadInputFound?: boolean;
}

interface HealthCase {
  expected: ExpectedHealth;
  fixture: RoutedFixture;
}

interface SelectorHealth {
  bfaArtControlsFound: boolean;
  bfaViewerStylesInjected: boolean;
  changePortraitButtonFound: boolean;
  enhancedPortraitCount: number;
  fixtureName: string;
  informationSidebarFound: boolean;
  journalSectionFound: boolean;
  journalTabFound: boolean;
  legacyPanelFound: boolean;
  portraitManagerFound: boolean;
  portraitSurfaceFound: boolean;
  sharperCardPortraitFound: boolean;
  uploadInputFound: boolean;
  uploadSectionFound: boolean;
  url: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const reportPath = path.join(
  repoRoot,
  'test-results',
  'selector-health-report.json',
);

const healthCases: HealthCase[] = [
  {
    expected: {
      enhancedPortraitCount: 1,
      legacyPanelFound: true,
      portraitManagerFound: true,
      portraitSurfaceFound: true,
      uploadInputFound: true,
    },
    fixture: legacyManagePaneFixture,
  },
  {
    expected: {
      enhancedPortraitCount: 1,
      informationSidebarFound: true,
      portraitSurfaceFound: true,
    },
    fixture: currentInformationSidebarFixture,
  },
  {
    expected: {
      enhancedPortraitCount: 1,
      informationSidebarFound: true,
      portraitSurfaceFound: true,
      uploadInputFound: false,
    },
    fixture: currentDecorationsWithoutUploadFixture,
  },
  {
    expected: {
      informationSidebarFound: true,
      portraitManagerFound: true,
      uploadInputFound: true,
    },
    fixture: portraitManagerFixture,
  },
  {
    expected: {
      sharperCardPortraitFound: true,
    },
    fixture: myCharactersCardFixture,
  },
  {
    expected: {
      journalSectionFound: false,
      journalTabFound: true,
    },
    fixture: characterSheetTabsFixture,
  },
  {
    expected: {
      enhancedPortraitCount: 0,
      portraitSurfaceFound: false,
      uploadInputFound: false,
    },
    fixture: missingHooksFixture,
  },
];

test('writes selector health report for local D&D Beyond fixtures', async (
  {extensionContext, page},
  testInfo,
) => {
  const report: SelectorHealth[] = [];

  for (const {expected, fixture} of healthCases) {
    await routeDndBeyondFixture(extensionContext, fixture);
    await page.goto(fixture.url);
    await waitForContentScript(page);
    if (expected.sharperCardPortraitFound === true) {
      await page.waitForFunction((selector) =>
        [...document.querySelectorAll<HTMLElement>(selector)]
            .some((element) => element.style.backgroundImage.includes('width=600')),
        CHARACTER_LIST_CARD_PORTRAIT_SELECTOR,
      );
    }
    if (expected.journalTabFound === true) {
      await page.waitForFunction((attributeName) =>
        document.querySelector(`[${attributeName}="true"]`) !== null,
        CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME,
      );
    }

    const health = await page.evaluate(({
      changePortraitButtonText,
      enhancedAttributeName,
      fixtureName,
      journalTabAttributeName,
      selectors,
      viewerStyleAttributeName,
    }): SelectorHealth => {
      const buttonTexts = [...document.querySelectorAll('button')].map(
        (button) => button.textContent?.trim().replace(/\s+/g, ' ') ?? '',
      );

      return {
        bfaArtControlsFound: document.querySelector('.bfa-art-sync') !== null,
        bfaViewerStylesInjected:
          document.querySelector(`[${viewerStyleAttributeName}]`) !== null,
        changePortraitButtonFound: buttonTexts.includes(changePortraitButtonText),
        enhancedPortraitCount:
          document.querySelectorAll(`[${enhancedAttributeName}="true"]`).length,
        fixtureName,
        informationSidebarFound:
          document.querySelector(selectors.informationSidebar) !== null,
        journalTabFound:
          document.querySelector(`[${journalTabAttributeName}="true"]`) !== null,
        journalSectionFound:
          document.querySelector('.bfa-character-journal-section') !== null,
        legacyPanelFound:
          document.querySelector(selectors.legacyPanel) !== null,
        portraitManagerFound:
          document.querySelector(selectors.portraitManager) !== null,
        portraitSurfaceFound:
          document.querySelector(selectors.portraitSurface) !== null,
        sharperCardPortraitFound:
          [...document.querySelectorAll<HTMLElement>(selectors.cardPortrait)]
              .some((element) => element.style.backgroundImage.includes('width=600')),
        uploadInputFound:
          document.querySelector(selectors.uploadInput) !== null,
        uploadSectionFound:
          document.querySelector(selectors.uploadSection) !== null,
        url: location.href,
      };
    }, {
      changePortraitButtonText: CHANGE_PORTRAIT_BUTTON_TEXT,
      enhancedAttributeName: ENHANCED_ATTRIBUTE_NAME,
      fixtureName: fixture.name,
      journalTabAttributeName: CHARACTER_SHEET_JOURNAL_TAB_ATTRIBUTE_NAME,
      selectors: {
        cardPortrait: CHARACTER_LIST_CARD_PORTRAIT_SELECTOR,
        informationSidebar: INFORMATION_SIDEBAR_SELECTOR,
        legacyPanel: CHARACTER_MANAGE_PANE_SELECTOR,
        portraitManager: PORTRAIT_MANAGER_SELECTOR,
        portraitSurface: CHARACTER_PORTRAIT_SURFACE_SELECTOR,
        uploadInput: PORTRAIT_MANAGER_UPLOAD_INPUT_SELECTOR,
        uploadSection: PORTRAIT_MANAGER_UPLOAD_SELECTOR,
      },
      viewerStyleAttributeName: VIEWER_STYLE_ATTRIBUTE_NAME,
    });

    report.push(health);
    expectHealth(health, expected);
  }

  const contents = `${JSON.stringify(report, null, 2)}\n`;
  await mkdir(path.dirname(reportPath), {recursive: true});
  await writeFile(reportPath, contents, 'utf8');
  await testInfo.attach('selector-health-report', {
    body: contents,
    contentType: 'application/json',
  });
});

function expectHealth(health: SelectorHealth, expected: ExpectedHealth): void {
  for (const [key, value] of Object.entries(expected)) {
    expect(
      health[key as keyof SelectorHealth],
      `${health.fixtureName} expected ${key} to be ${String(value)}`,
    ).toBe(value);
  }
}
