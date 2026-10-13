import type {BrowserContext, Page} from '@playwright/test';
import {Buffer} from 'node:buffer';

import {
  CHARACTER_MANAGE_PANE_FIXTURE,
  CURRENT_INFORMATION_SIDEBAR_FIXTURE,
} from '../../fixtures/character-manage-pane';
import {MY_CHARACTERS_CARD_FIXTURE} from '../../fixtures/campaign-character-cards';
import {CHARACTER_SHEET_TABS_FIXTURE} from '../../fixtures/character-sheet-tabs';
import {PORTRAIT_MANAGER_FIXTURE} from '../../fixtures/portrait-manager';

export const CHARACTER_ID = '169418374';
export const BASE_CHARACTER_URL = `https://www.dndbeyond.com/characters/${CHARACTER_ID}`;
export const MY_CHARACTERS_URL = 'https://www.dndbeyond.com/characters';
export const NON_CHARACTER_URL = 'https://www.dndbeyond.com/classes/barbarian';
const TRANSPARENT_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
    'base64',
);

export interface RoutedFixture {
  body: string;
  name: string;
  url: string;
}

export const legacyManagePaneFixture: RoutedFixture = {
  body: CHARACTER_MANAGE_PANE_FIXTURE,
  name: 'legacy-manage-pane',
  url: `${BASE_CHARACTER_URL}?bfaFixture=legacy-manage-pane`,
};

export const currentInformationSidebarFixture: RoutedFixture = {
  body: CURRENT_INFORMATION_SIDEBAR_FIXTURE,
  name: 'current-information-sidebar',
  url: `${BASE_CHARACTER_URL}?bfaFixture=current-information-sidebar`,
};

export const characterSheetTabsFixture: RoutedFixture = {
  body: CHARACTER_SHEET_TABS_FIXTURE,
  name: 'character-sheet-tabs',
  url: `${BASE_CHARACTER_URL}?bfaFixture=character-sheet-tabs`,
};

export const currentDecorationsWithoutUploadFixture: RoutedFixture = {
  body: `
    <div class="ct-sidebar__portal">
      <aside aria-label="Information Sidebar">
        <section>
          <h1>Current Decorations</h1>
          <div
            class="ddbc-character-avatar__portrait ddbc-character-avatar__portrait--none"
            style="background-image: url(&quot;https://www.dndbeyond.com/Content/Skins/Waterdeep/images/characters/default-avatar-builder.png&quot;); width: 130px; height: 130px;"
          ></div>
          <h2>Browse Decorations</h2>
          <button type="button"><span>Backdrops</span></button>
          <button type="button"><span>Frames</span></button>
          <button type="button"><span>Themes</span></button>
          <button type="button"><span>Portraits</span></button>
        </section>
      </aside>
    </div>
  `,
  name: 'current-decorations-without-upload',
  url: `${BASE_CHARACTER_URL}?bfaFixture=current-decorations-without-upload`,
};

export const portraitManagerFixture: RoutedFixture = {
  body: `
    <div class="ct-sidebar__portal">
      <aside aria-label="Information Sidebar">
        ${PORTRAIT_MANAGER_FIXTURE}
      </aside>
    </div>
  `,
  name: 'legacy-portrait-manager',
  url: `${BASE_CHARACTER_URL}?bfaFixture=legacy-portrait-manager`,
};

export const missingHooksFixture: RoutedFixture = {
  body: `
    <main>
      <h1>Matilda Greywolf</h1>
      <p>This character page intentionally has no known portrait or upload hooks.</p>
    </main>
  `,
  name: 'missing-hooks',
  url: `${BASE_CHARACTER_URL}?bfaFixture=missing-hooks`,
};

export const myCharactersCardFixture: RoutedFixture = {
  body: MY_CHARACTERS_CARD_FIXTURE,
  name: 'my-characters-card',
  url: `${MY_CHARACTERS_URL}?bfaFixture=my-characters-card`,
};

export async function routeDndBeyondFixture(
  context: BrowserContext,
  fixture: RoutedFixture,
): Promise<void> {
  await routeDndBeyondImages(context);
  await context.route(fixture.url, async (route) => {
    await route.fulfill({
      body: wrapFixture(fixture),
      contentType: 'text/html',
      status: 200,
    });
  });
}

async function routeDndBeyondImages(context: BrowserContext): Promise<void> {
  await context.route('https://www.dndbeyond.com/avatars/**', async (route) => {
    await route.fulfill({
      body: TRANSPARENT_PNG,
      contentType: 'image/png',
      status: 200,
    });
  });
}

export async function routeNonCharacterPage(
  context: BrowserContext,
): Promise<void> {
  await context.route(NON_CHARACTER_URL, async (route) => {
    await route.fulfill({
      body: wrapDocument('<main><h1>Barbarian</h1></main>'),
      contentType: 'text/html',
      status: 200,
    });
  });
}

export async function waitForContentScript(page: Page): Promise<void> {
  await page.waitForFunction(() => document.readyState === 'complete');
}

function wrapFixture(fixture: RoutedFixture): string {
  return wrapDocument(`
    <main data-fixture-name="${fixture.name}">
      ${fixture.body}
    </main>
  `);
}

function wrapDocument(body: string): string {
  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>D&D Beyond Fixture</title>
        <style>
          body {
            color: #242527;
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            min-height: 100vh;
          }

          main[data-fixture-name="character-sheet-tabs"] {
            box-sizing: border-box;
            margin: 0 auto;
            max-width: 1180px;
            min-width: 0;
            padding: 16px;
          }

          .ct-character-sheet-tabs {
            border-bottom: 1px solid rgba(36, 37, 39, 0.22);
            display: flex;
            flex-wrap: wrap;
            gap: 0;
            list-style: none;
            margin: 0;
            min-width: 0;
            padding: 0;
          }

          .ct-character-sheet-tab-item {
            display: flex;
            min-width: 0;
          }

          .ct-character-sheet-tab {
            appearance: none;
            background: transparent;
            border: 0;
            border-bottom: 3px solid transparent;
            box-sizing: border-box;
            color: #242527;
            cursor: pointer;
            font: inherit;
            font-size: 12px;
            font-weight: 700;
            min-height: 42px;
            padding: 0 11px;
            text-transform: uppercase;
          }

          .ct-character-sheet-tab.bfa-character-journal-tab--active {
            border-bottom-color: #c5312d;
            color: #c5312d;
          }

          .ct-character-sheet-content {
            box-sizing: border-box;
            min-width: 0;
          }

          .ct-character-sheet-panel {
            box-sizing: border-box;
            padding: 18px 16px;
          }

          @media (max-width: 420px) {
            main[data-fixture-name="character-sheet-tabs"] {
              padding: 10px;
            }

            .ct-character-sheet-tab {
              min-height: 38px;
              padding: 0 8px;
            }
          }

          .ct-sidebar__portal {
            min-height: 200px;
          }

          [aria-label="Information Sidebar"],
          [data-testid="character-manage-pane"] {
            display: block;
            min-height: 160px;
            padding: 16px;
          }

          .ddbc-character-avatar__portrait {
            background-position: center;
            background-size: cover;
            display: block;
          }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `;
}
