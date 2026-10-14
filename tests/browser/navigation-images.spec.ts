import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('desktop primary links, More disclosure and nested active states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/seedlings/avocado/');
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const name of ['Home', 'Shop', 'Seedlings', 'Gardens', 'Learn', 'About'])
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  await expect(
    nav.getByRole('link', { name: 'Seedlings', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  const more = nav.locator('summary');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(
    nav.getByRole('link', { name: 'Herbal Products', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(more).toBeFocused();
  await expect(nav.locator('details')).not.toHaveAttribute('open', '');
  await more.click();
  await nav.getByRole('link', { name: 'Herbal Products', exact: true }).click();
  await expect(page).toHaveURL(/\/products\/$/);
  await expect(nav.locator('summary')).toHaveClass(/section-active/);
});
test('mobile drawer traps focus, closes with Escape/backdrop and restores scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Menu', exact: true });
  await button.click();
  const dialog = page.getByRole('dialog', { name: 'Explore Herb-All' });
  await expect(dialog).toBeVisible();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(
    dialog.getByRole('button', { name: 'Close navigation' }),
  ).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('link', { name: 'Contact & enquiries' }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Close navigation' }),
  ).toBeFocused();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
  ).toBe('hidden');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(button).toBeFocused();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(
    await page.evaluate(() => getComputedStyle(document.body).overflow),
  ).not.toBe('hidden');
  await page.setViewportSize({ width: 768, height: 900 });
  await button.click();
  await page.mouse.click(10, 100);
  await expect(dialog).not.toBeVisible();
  await button.click();
  await dialog.getByRole('link', { name: 'Gardens', exact: true }).click();
  await expect(page).toHaveURL(/\/gardens\/$/);
});
test('cart count has accessible singular/plural names and survives reload', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem(
      'herb-all-cart',
      JSON.stringify([{ product_id: 'test-id', quantity: 3 }]),
    );
    window.dispatchEvent(new Event('cart-updated'));
  });
  await expect(
    page.getByRole('link', { name: 'Shopping cart, 3 items', exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-cart-count]')).toHaveText('3');
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Shopping cart, 3 items', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('herb-all-cart', JSON.stringify([{ quantity: 1 }]));
    window.dispatchEvent(new Event('cart-updated'));
  });
  await expect(
    page.getByRole('link', { name: 'Shopping cart, 1 item', exact: true }),
  ).toBeVisible();
});
test('representative static images and credits render; supplied photos remain', async ({
  page,
}) => {
  await page.goto('/seedlings/');
  await page
    .getByRole('link', { name: 'View Avocado Seedlings', exact: true })
    .click();
  await expect(page).toHaveURL(/seedlings\/avocado/);
  await expect(
    page.locator('main [data-product-image]').first(),
  ).toHaveAttribute('src', /\/images\/products\/temporary\/avocado-/);
  await expect(
    page.locator('main [data-product-visual]').first(),
  ).toContainText('Representative image');
  await page
    .locator('main [data-product-visual]')
    .first()
    .getByRole('link', { name: 'Image credits' })
    .click();
  await expect(page).toHaveURL(/image-credits\/#avocado/);
  await expect(page.locator('#avocado')).toContainText('CC BY-SA');
  await page.goto('/seedlings/moringa/');
  await expect(
    page.locator('main [data-product-image]').first(),
  ).toHaveAttribute('src', /\/images\/brand\/moringa-seedlings/);
  await expect(
    page.locator('main [data-product-visual]').first(),
  ).not.toContainText('Representative image');
});
test('broken representative images show named botanical fallback without a broken icon', async ({
  page,
}) => {
  await page.route('**/avocado-*.webp', (r) => r.abort());
  await page.goto('/seedlings/avocado/');
  const visual = page.locator('main [data-product-visual]').first();
  await expect(visual.locator('[data-product-image]')).toBeHidden();
  await expect(
    visual.getByRole('img', {
      name: 'Avocado Seedlings — botanical placeholder',
      exact: true,
    }),
  ).toBeVisible();
  await expect(visual).toContainText('Avocado Seedlings');
});
test('live-shop presentation prefers uploaded photos; unknown products get a named fallback', async ({
  page,
}) => {
  const product = {
    id: '00000000-0000-4000-8000-000000000001',
    sku: 'HA-GRAFTED-HASS-AVOCADO',
    slug: 'grafted-hass-avocado',
    name: 'Grafted Hass Avocado',
    category: 'Avocados',
    price_cents: 20000,
    unit: 'seedling',
    unavailable: true,
    available: 0,
    min_quantity: 1,
    max_quantity: 100,
    images: [],
  };
  await page.route('**/api/categories', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/products?*', (r) =>
    r.fulfill({ json: { items: [product], total: 1, page: 1 } }),
  );
  await page.goto('/shop/');
  await expect(page.locator('#shop-content img')).toHaveAttribute(
    'src',
    /temporary\/avocado-/,
  );
  await expect(
    page.getByRole('button', { name: 'Add to cart' }),
  ).toBeDisabled();
  product.images = [
    { id: '00000000-0000-4000-8000-000000000002', alt: 'Actual nursery photo' },
  ] as any;
  await page.route('**/api/media/*', (r) =>
    r.fulfill({
      path: 'public/images/brand/moringa-seedlings-480.webp',
      contentType: 'image/webp',
    }),
  );
  await page.reload();
  await expect(page.locator('#shop-content img')).toHaveAttribute(
    'src',
    /\/api\/media\//,
  );
  await expect(page.locator('#shop-content')).not.toContainText(
    'Representative image',
  );
  product.images = [];
  product.sku = 'UNMAPPED';
  await page.reload();
  await expect(
    page.locator('#shop-content').getByRole('img', {
      name: 'Grafted Hass Avocado — botanical placeholder',
    }),
  ).toBeVisible();
  await expect(page.locator('#shop-content img')).toHaveCount(0);
});
test('desktop More and open mobile drawer meet automated WCAG checks', async ({
  page,
}) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    if (width === 1440) await page.locator('.nav-more summary').click();
    else await page.getByRole('button', { name: 'Menu', exact: true }).click();
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(r.violations, JSON.stringify(r.violations, null, 2)).toEqual([]);
  }
});
