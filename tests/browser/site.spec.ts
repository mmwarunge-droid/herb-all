import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const routes = [
  '/',
  '/products/',
  '/seedlings/',
  '/learn/',
  '/products/moringa-tea/',
  '/seedlings/avocado/',
  '/learn/beginners-guide-to-moringa/',
  '/contact/',
  '/about/',
  '/gardens/',
  '/seedlings/moringa/',
  '/privacy/',
  '/terms/',
  '/disclaimer/',
];
for (const width of [320, 375, 768, 1024, 1440]) {
  test(`routes fit ${width}px with images and no browser errors`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const images = page.locator('main img');
      for (let i = 0; i < (await images.count()); i++) {
        await images.nth(i).scrollIntoViewIfNeeded();
        await expect(images.nth(i)).toHaveJSProperty('complete', true);
        expect(
          await images
            .nth(i)
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBeGreaterThan(0);
      }
    }
    expect(errors).toEqual([]);
  });
}
test('search, combined filters, empty/reset states and query persistence', async ({
  page,
}) => {
  await page.goto('/products/');
  await page.getByLabel('Search products').fill('moringa');
  await expect(page.locator('[data-item]:visible')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('Search products')).toHaveValue('moringa');
  await expect(page.locator('[data-item]:visible')).toHaveCount(1);
  await page
    .getByLabel('Category', { exact: true })
    .selectOption('Herbal Blends');
  await expect(page.locator('[data-empty]')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('[data-item]:visible')).toHaveCount(6);
  await page.getByLabel('Ingredient', { exact: true }).selectOption('Ginger');
  await expect(page.locator('[data-item]:visible')).toHaveCount(1);
  await page.goto('/seedlings/');
  await page.getByLabel('Category', { exact: true }).selectOption('Vines');
  await expect(page.locator('[data-item]:visible')).toHaveCount(1);
  await page.goto('/learn/');
  await page.getByLabel('Tag', { exact: true }).selectOption('ginger');
  await expect(page.locator('[data-item]:visible')).toHaveCount(1);
});
test('enquiry topics and supplied contact channels work', async ({ page }) => {
  await page.goto('/contact/?topic=Garden%20visit&item=Moringa');
  await expect(page.getByLabel('Enquiry type')).toHaveValue('Garden visit');
  await expect(page.getByLabel('Product or seedling (optional)')).toHaveValue(
    'Moringa',
  );
  await expect(
    page.getByRole('button', { name: 'Open email enquiry' }),
  ).toBeEnabled();
  await expect(
    page.getByRole('link', { name: 'Start a WhatsApp conversation' }),
  ).toHaveAttribute('href', 'https://wa.me/254722603819');
  await expect(
    page.getByRole('link', { name: 'dwmuriu725@gmail.com' }),
  ).toHaveAttribute('href', 'mailto:dwmuriu725@gmail.com');
  await page.goto('/contact/?topic=Unknown');
  await expect(page.getByLabel('Enquiry type')).toHaveValue('General enquiry');
  await page.goto('/gardens/');
  await page
    .locator('#learning')
    .getByRole('link', { name: 'Discuss a consultation' })
    .click();
  await expect(page.getByLabel('Enquiry type')).toHaveValue('Consultation');
});
test('mobile navigation, keyboard skip link and no-JS content', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Skip to content' }),
  ).toBeFocused();
  await page.getByText('Menu', { exact: true }).click();
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation' }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .getByRole('link', { name: 'Seedlings', exact: true })
    .click();
  await expect(page).toHaveURL(/seedlings/);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto('http://127.0.0.1:4321/products/');
  await expect(staticPage.locator('[data-item]')).toHaveCount(6);
  await expect(
    staticPage.getByRole('heading', { name: 'Herbal products', exact: true }),
  ).toBeVisible();
  await context.close();
});
test('image failures fall back with corrected alt text', async ({ page }) => {
  await page.route('**/packaged-herbs-*.webp', (route) => route.abort());
  await page.goto('/products/');
  const image = page.locator('main img').first();
  await expect(image).toHaveAttribute('src', '/images/botanical.webp');
  await expect(image).toHaveAttribute(
    'alt',
    'Botanical placeholder photograph of tea leaves',
  );
});
test('core routes have no WCAG A/AA automated violations', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  }
});
