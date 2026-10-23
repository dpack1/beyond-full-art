import type {BrowserContext, Page} from '@playwright/test';
import {Buffer} from 'node:buffer';

import {
  CHARACTER_MANAGE_PANE_FIXTURE,
  CURRENT_INFORMATION_SIDEBAR_FIXTURE,
} from '../../fixtures/character-manage-pane';
import {MY_CHARACTERS_CARD_FIXTURE} from '../../fixtures/campaign-character-cards';
import {
  CHARACTER_SHEET_TABS_FIXTURE,
  LIVE_CHARACTER_SHEET_TABS_FIXTURE,
} from '../../fixtures/character-sheet-tabs';
import {PORTRAIT_MANAGER_FIXTURE} from '../../fixtures/portrait-manager';
import {EXTRAS_COMPANION_FIXTURE} from '../../fixtures/extras-companion';

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

export const liveCharacterSheetFixture: RoutedFixture = {
  body: LIVE_CHARACTER_SHEET_TABS_FIXTURE,
  name: 'live-character-sheet',
  url: `${BASE_CHARACTER_URL}?bfaFixture=live-character-sheet`,
};

export const extrasCompanionFixture: RoutedFixture = {
  body: EXTRAS_COMPANION_FIXTURE,
  name: 'extras-companion',
  url: `${BASE_CHARACTER_URL}?bfaFixture=extras-companion`,
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
            background: #e7e3dc;
            color: #242527;
            font-family: "Segoe UI", Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif;
            margin: 0;
            min-height: 100vh;
          }

          main[data-fixture-name="character-sheet-tabs"] {
            box-sizing: border-box;
            margin: 0 auto;
            max-width: 1180px;
            min-width: 0;
            padding: 28px 16px 40px;
          }

          .ct-character-sheet-shell {
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(36, 37, 39, 0.08), 0 8px 24px rgba(36, 37, 39, 0.06);
            margin: 0 auto;
            max-width: 1040px;
          }

          .ct-character-header {
            align-items: center;
            display: flex;
            gap: 16px;
            padding: 18px 18px 8px;
          }

          .ct-character-header__portrait {
            background:
              radial-gradient(circle at 35% 30%, #f3d2b0 0 28%, transparent 29%),
              linear-gradient(160deg, #8d3b32 0%, #2d211c 70%);
            border-radius: 4px;
            flex: 0 0 auto;
            height: 72px;
            width: 72px;
          }

          .ct-character-header__eyebrow,
          .ct-character-header__meta,
          .ct-character-header__name {
            margin: 0;
          }

          .ct-character-header__eyebrow {
            color: #8a8680;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .ct-character-header__name {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 1.15;
          }

          .ct-character-header__meta {
            color: #5c5852;
            font-size: 14px;
            margin-top: 4px;
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

          .ct-character-sheet-tab:hover {
            color: #121212;
          }

          .ct-character-sheet-tab.bfa-character-journal-tab--active,
          .ct-character-sheet-tab.bfa-character-journal-tab--active:hover {
            border-bottom-color: #c5312d;
            color: #c5312d;
          }

          .ct-character-sheet-content {
            box-sizing: border-box;
            min-width: 0;
          }

          .ct-character-sheet-panel {
            box-sizing: border-box;
            padding: 18px 16px 28px;
          }

          .ct-character-sheet-panel h2 {
            font-size: 15px;
            letter-spacing: 0.06em;
            margin: 0 0 8px;
            text-transform: uppercase;
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

          main[data-fixture-name="live-character-sheet"] .ct-character-sheet--dark-mode {
            background: #1c1b1a;
            color: #f3efe6;
          }

          main[data-fixture-name="live-character-sheet"] .ct-character-sheet:not(.ct-character-sheet--dark-mode) {
            background: #f7f4ef;
            color: #242527;
          }

          .ddbc-tab-list__nav {
            display: flex;
            flex-wrap: wrap;
          }

          .ddbc-tab-list__nav-item {
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.04em;
            padding: 12px 14px;
            text-transform: uppercase;
          }

          main[data-fixture-name="live-character-sheet"] .ct-character-sheet--dark-mode .ddbc-tab-list__nav-item:hover {
            color: #ffffff;
          }

          main[data-fixture-name="live-character-sheet"] .ct-character-sheet:not(.ct-character-sheet--dark-mode) .ddbc-tab-list__nav-item:hover {
            color: #121212;
          }

          .ddbc-tab-list__nav-item--is-active,
          .ddbc-tab-list__nav-item--is-active:hover {
            box-shadow: inset 0 -3px 0 #c5312d;
            color: #c5312d;
          }

          .ct-extras-filter__interactions,
          .ct-inventory-filter__interactions,
          .ct-spells-filter__interactions {
            align-items: center;
            display: flex;
            flex-wrap: nowrap;
            margin-bottom: 12px;
          }

          .ct-extras-filter__box,
          .ct-inventory-filter__box,
          .ct-spells-filter__box {
            border: 1px solid #a2acb2;
            border-radius: 4px;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.07);
            flex: 1 1 auto;
            min-width: 0;
            padding: 5px 10px;
          }

          .ct-extras-filter__primary,
          .ct-extras-filter__primary-group,
          .ct-inventory-filter__primary,
          .ct-inventory-filter__primary-group,
          .ct-spells-filter__primary,
          .ct-spells-filter__primary-group {
            align-items: center;
            display: flex;
            min-width: 0;
          }

          .ct-extras-filter__field,
          .ct-inventory-filter__field,
          .ct-spells-filter__field {
            flex: 1 1 auto;
            min-width: 0;
          }

          .ct-extras-filter__icon,
          .ct-inventory-filter__icon,
          .ct-spells-filter__icon {
            background: transparent 50% url(https://www.dndbeyond.com/Content/Skins/Waterdeep/images/icons/search-grey.svg) no-repeat;
            background-size: 14px 14px;
            flex: 0 0 auto;
            height: 14px;
            margin-right: 10px;
            width: 14px;
          }

          .ct-extras-filter__input,
          .ct-inventory-filter__input,
          .ct-spells-filter__input {
            background: transparent;
            border: 0;
            color: inherit;
            font: inherit;
            font-size: 13px;
            line-height: 24px;
            min-height: 0;
            padding: 0;
            width: 100%;
          }

          .ct-extras-filter__advanced,
          .ct-inventory-filter__advanced,
          .ct-spells-filter__advanced {
            flex: 0 0 auto;
            height: 14px;
            margin-left: 10px;
            width: 14px;
          }

          .ct-extras-filter__advanced svg,
          .ct-inventory-filter__advanced svg,
          .ct-spells-filter__advanced svg {
            display: block;
            height: 100%;
            width: 100%;
          }

          .ct-extras-filter__callout {
            flex: 0 0 auto;
            padding-left: 10px;
          }

          .ct-theme-button.ct-button {
            background: #fff;
            border: 1px solid #c53131;
            border-radius: 3px;
            color: #c53131;
            font-family: "Roboto Condensed", Roboto, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1;
            padding: 6px 10px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `;
}
