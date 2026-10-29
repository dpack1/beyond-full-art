import {expect, test} from '@playwright/test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const observerPath = path.join(repoRoot, 'dist/content/character-deletion-main.js');

test('a failed page fetch is not sourced from the deletion observer', async ({page}) => {
  await page.setContent('<!doctype html><html><head></head><body></body></html>');
  await page.addScriptTag({path: observerPath});
  await page.route('https://menu.test/**', (route) => route.abort('failed'));

  const stack = await page.evaluate(() => new Promise<string>((resolve) => {
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      event.preventDefault();
      resolve(reason instanceof Error ? reason.stack ?? '' : String(reason));
    });
    async function loadMenu(): Promise<void> {
      await fetch('https://menu.test/assets/index.js');
    }
    void loadMenu();
  }));

  const frames = stack.split('\n').map((line) => line.trim()).filter((line) => line.startsWith('at '));
  expect(frames[0] ?? '').toContain('bfaNativeFetch');
  expect(frames[0] ?? '').not.toContain('character-deletion-main');
});

test('a character-service DELETE is still reported through the page fetch bridge', async ({page}) => {
  const cors = {
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'DELETE, OPTIONS',
    'access-control-allow-origin': 'http://127.0.0.1:8765',
  };
  await page.route('http://127.0.0.1:8765/**', (route) => route.fulfill({
    body: '<!doctype html><html><head></head><body></body></html>',
    contentType: 'text/html',
    status: 200,
  }));
  await page.route('https://character-service.dndbeyond.com/**', (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({headers: cors, status: 204});
    }
    return route.fulfill({
      body: '{}',
      contentType: 'application/json',
      headers: cors,
      status: 200,
    });
  });
  await page.goto('http://127.0.0.1:8765/');
  await page.addScriptTag({path: observerPath});

  const observed = await page.evaluate(async () => {
    const reported = new Promise((resolve) => {
      window.addEventListener('message', function onReport(event: MessageEvent) {
        const data = event.data as {source?: string} | null;
        if (data?.source === 'bfa-character-deletion-observed') {
          window.removeEventListener('message', onReport);
          resolve(data);
        }
      });
    });
    await fetch('https://character-service.dndbeyond.com/character/v5/character', {
      body: JSON.stringify({characterId: 900000002}),
      method: 'DELETE',
    });
    return reported;
  });

  expect(observed).toEqual({
    characterId: '900000002',
    source: 'bfa-character-deletion-observed',
    status: 200,
  });
});
