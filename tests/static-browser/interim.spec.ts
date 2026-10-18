import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const routes = walk('dist')
  .filter((path) => path.endsWith('index.html'))
  .map((path) => '/' + path.slice(5).replace(/index\.html$/, ''));

for (const width of [320, 375, 768, 1024, 1440])
  test(`static public routes and images at ${width}px without API requests`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const apis: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (new URL(r.url()).pathname.startsWith('/api/')) apis.push(r.url());
    });
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await page.evaluate(async () => {
        await Promise.all(
          [...document.images].map(
            (i) => ((i.loading = 'eager'), i.decode().catch(() => {})),
          ),
        );
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        route,
      ).toBe(true);
      expect(
        await page
          .locator('img')
          .evaluateAll((imgs) =>
            imgs.every(
              (i) =>
                i instanceof HTMLImageElement &&
                i.complete &&
                i.naturalWidth > 0,
            ),
          ),
        route,
      ).toBe(true);
    }
    expect(apis).toEqual([]);
    expect(errors).toEqual([]);
  });
test('catalogue, closed services, navigation, enquiry and accessibility', async ({
  page,
}) => {
  await page.goto('/shop/');
  await expect(
    page.getByText(
      'Online ordering is temporarily unavailable. Please contact Herb-All to confirm current availability.',
    ),
  ).toBeVisible();
  expect(await page.locator('.card').count()).toBeGreaterThan(5);
  await expect(
    page.getByRole('link', { name: 'Enquire about availability' }),
  ).toBeVisible();
  await expect(page.locator('.cart-link')).toHaveCount(0);
  for (const route of ['/shop/', '/checkout/', '/admin/', '/contact/']) {
    await page.goto(route);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.goto('/checkout/');
  await expect(page.locator('form')).toHaveCount(0);
  await page.goto('/admin/');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.goto('/contact/');
  await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('API explicitly unavailable with private headers, never fabricated commerce', async ({
  request,
}) => {
  for (const path of [
    'products',
    'public/settings',
    'orders',
    'auth/login',
    'maintenance',
  ]) {
    const r = await request.post('/api/' + path, { data: {} });
    expect(r.status()).toBe(503);
    expect(r.headers()['cache-control']).toBe('no-store');
    expect(r.headers()['x-robots-tag']).toBe('noindex');
    expect(await r.json()).toEqual({
      error:
        'Online services are temporarily unavailable. Please contact Herb-All directly.',
    });
  }
});
