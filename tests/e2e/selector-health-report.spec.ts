import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

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
      await page.waitForFunction(() =>
        [...document.querySelectorAll<HTMLElement>('.image.user-selected-avatar')]
            .some((element) => element.style.backgroundImage.includes('width=600')),
      );
    }
    if (expected.journalTabFound === true) {
      await page.waitForFunction(() =>
        document.querySelector('[data-bfa-character-journal-tab="true"]') !==
        null,
      );
    }

    const health = await page.evaluate((fixtureName): SelectorHealth => {
      const buttonTexts = [...document.querySelectorAll('button')].map(
        (button) => button.textContent?.trim().replace(/\s+/g, ' ') ?? '',
      );

      return {
        bfaArtControlsFound: document.querySelector('.bfa-art-sync') !== null,
        bfaViewerStylesInjected:
          document.querySelector('[data-bfa-viewer-styles]') !== null,
        changePortraitButtonFound: buttonTexts.includes('Change Portrait'),
        enhancedPortraitCount:
          document.querySelectorAll('[data-bfa-enhanced="true"]').length,
        fixtureName,
        informationSidebarFound:
          document.querySelector('[aria-label="Information Sidebar"]') !== null,
        journalTabFound:
          document.querySelector('[data-bfa-character-journal-tab="true"]') !==
          null,
        journalSectionFound:
          document.querySelector('.bfa-character-journal-section') !== null,
        legacyPanelFound:
          document.querySelector('[data-testid="character-manage-pane"]') !==
          null,
        portraitManagerFound:
          document.querySelector('.ct-decoration-manager') !== null,
        portraitSurfaceFound:
          document.querySelector('.ddbc-character-avatar__portrait') !== null,
        sharperCardPortraitFound:
          [...document.querySelectorAll<HTMLElement>('.image.user-selected-avatar')]
              .some((element) => element.style.backgroundImage.includes('width=600')),
        uploadInputFound:
          document.querySelector(
            '.ct-decoration-manager__upload-file-input[type="file"]',
          ) !== null,
        uploadSectionFound:
          document.querySelector('.ct-decoration-manager__upload') !== null,
        url: location.href,
      };
    }, fixture.name);

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
