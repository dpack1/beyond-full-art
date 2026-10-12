import {defineConfig} from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 5_000,
  },
  fullyParallel: false,
  outputDir: 'test-results/playwright-artifacts',
  reporter: [['list']],
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  workers: 1,
});
