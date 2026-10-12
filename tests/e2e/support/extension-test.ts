import {
  test as base,
  chromium,
  type BrowserContext,
  type Page,
} from '@playwright/test';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const distPath = path.join(repoRoot, 'dist');
const chromiumChannel = process.env.BFA_PLAYWRIGHT_CHROMIUM_CHANNEL;

type LaunchOptions = NonNullable<
  Parameters<typeof chromium.launchPersistentContext>[1]
>;

interface ExtensionFixtures {
  extensionContext: BrowserContext;
  page: Page;
}

export const test = base.extend<ExtensionFixtures>({
  extensionContext: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'bfa-playwright-'));
    const launchOptions: LaunchOptions = {
      args: [
        '--disable-features=DisableLoadExtensionCommandLineSwitch',
        `--disable-extensions-except=${distPath}`,
        `--load-extension=${distPath}`,
        '--no-first-run',
      ],
      headless: false,
    };
    if (chromiumChannel !== undefined && chromiumChannel.trim() !== '') {
      launchOptions.channel = chromiumChannel;
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOptions,
    });

    try {
      await use(context);
    } finally {
      await context.close();
      await rm(userDataDir, {force: true, recursive: true});
    }
  },

  page: async ({extensionContext}, use) => {
    const page = await extensionContext.newPage();

    try {
      await use(page);
    } finally {
      await page.close();
    }
  },
});

export {expect} from '@playwright/test';
