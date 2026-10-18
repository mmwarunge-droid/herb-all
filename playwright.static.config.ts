import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/static-browser',
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: process.env.STATIC_TEST_BASE_URL || 'http://127.0.0.1:4321',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox'],
    },
  },
  webServer: process.env.STATIC_TEST_BASE_URL
    ? undefined
    : {
        command: 'npx wrangler dev --local --port 4321',
        url: 'http://127.0.0.1:4321',
        env: {
          WRANGLER_SEND_METRICS: 'false',
          PUBLIC_SITE_URL: 'https://herb-all.example',
        },
      },
  reporter: 'list',
});
