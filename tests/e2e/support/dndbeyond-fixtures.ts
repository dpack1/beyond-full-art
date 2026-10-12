import type {BrowserContext, Page} from '@playwright/test';

import {
  CHARACTER_MANAGE_PANE_FIXTURE,
  CURRENT_INFORMATION_SIDEBAR_FIXTURE,
} from '../../fixtures/character-manage-pane';
import {PORTRAIT_MANAGER_FIXTURE} from '../../fixtures/portrait-manager';

export const CHARACTER_ID = '169418374';
export const BASE_CHARACTER_URL = `https://www.dndbeyond.com/characters/${CHARACTER_ID}`;
export const NON_CHARACTER_URL = 'https://www.dndbeyond.com/classes/barbarian';

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

export async function routeDndBeyondFixture(
  context: BrowserContext,
  fixture: RoutedFixture,
): Promise<void> {
  await context.route(fixture.url, async (route) => {
    await route.fulfill({
      body: wrapFixture(fixture),
      contentType: 'text/html',
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
            margin: 0;
            min-height: 100vh;
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
