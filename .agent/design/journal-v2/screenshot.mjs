import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`file://${join(root, 'index.html')}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);

const shots = page.locator('[data-shot]');
const count = await shots.count();
for (let index = 0; index < count; index += 1) {
  const shot = shots.nth(index);
  const name = await shot.getAttribute('data-shot');
  await shot.screenshot({ path: join(root, `${name}.png`) });
  console.log(name);
}

await browser.close();
console.log(`Saved ${count} screenshots`);
