import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/commerce-browser',
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:4321',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox'],
    },
  },
  webServer: {
    command: 'npm run preview:commerce',
    url: 'http://127.0.0.1:4321',
    env: {
      APP_ENV: 'development',
      COMMERCE_CHECKOUT_ENABLED:
        process.env.COMMERCE_CHECKOUT_ENABLED || 'true',
      PUBLIC_SITE_URL: 'http://127.0.0.1:4321',
      ORDER_TOKEN_SECRET:
        'local-browser-test-key-not-for-production-0123456789',
    },
  },
  reporter: 'list',
});
