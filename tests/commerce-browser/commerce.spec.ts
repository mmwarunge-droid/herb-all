import { test, expect } from '@playwright/test';
import sharp from 'sharp';
import AxeBuilder from '@axe-core/playwright';
import {
  reset,
  fixtureAdmin,
  fixtureProduct,
  basket,
} from '../commerce/fixtures.mjs';
import { closeDatabase, database } from '../../server/db.mjs';
let admin: any;
test.beforeEach(async () => {
  await reset();
  admin = await fixtureAdmin();
});
test.afterAll(closeDatabase);
async function login(page: any) {
  await page.goto('/admin/');
  await page.getByLabel('Email', { exact: true }).fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Operational overview' }),
  ).toBeVisible();
  page.on('dialog', (d: any) => d.accept());
}
async function axe(page: any) {
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(r.violations, JSON.stringify(r.violations)).toEqual([]);
}
test('complete mobile purchase, admin stock/quote, evidence verification, dispatch and tracking', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page
    .getByRole('button', { name: 'Products & stock', exact: true })
    .click();
  const product = page.locator('#product-form');
  await product
    .getByLabel('Product name', { exact: true })
    .fill('Avocado seedlings');
  await product.getByLabel('URL slug').fill('avocado-live-fixture');
  await product.getByLabel('SKU', { exact: true }).fill('TEST-AVOCADO');
  await product.getByLabel('Category', { exact: true }).fill('Seedlings');
  await product.getByLabel('Unit of sale').fill('seedling');
  await product.getByLabel('Unit price (KES)').fill('150');
  await product.getByLabel('Published', { exact: true }).check();
  await product
    .getByRole('button', { name: 'Create product', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Edit Avocado seedlings', exact: true })
    .click();
  await page
    .locator('#stock-form')
    .getByLabel('Total physical stock (including reserved)')
    .fill('5');
  await page
    .locator('#stock-form')
    .getByLabel('Adjustment reason')
    .fill('Browser fixture stock');
  await page
    .locator('#stock-form')
    .getByRole('button', { name: 'Adjust stock', exact: true })
    .click();
  await expect(
    page.getByText('stock 5, reserved 0, available 5', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Edit Avocado seedlings', exact: true })
    .click();
  await page
    .locator('#image-form')
    .getByLabel('Describe the photograph')
    .fill('Isolated QA image upload');
  await page
    .locator('#image-form')
    .getByLabel('JPEG, PNG or WebP; maximum 2 MB')
    .setInputFiles({
      name: 'qa.png',
      mimeType: 'image/png',
      buffer: await sharp({
        create: { width: 20, height: 20, channels: 3, background: '#00aa00' },
      })
        .png()
        .toBuffer(),
    });
  await page
    .locator('#image-form')
    .getByRole('button', { name: 'Upload product photograph', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Image uploaded');
  await fixtureProduct(admin, 'Guava seedlings', '80', 10);
  await fixtureProduct(admin, 'Moringa seed packets', '200', 2);
  await page
    .getByRole('button', { name: 'Business settings', exact: true })
    .click();
  const sf = page.locator('#settings-form');
  await sf
    .getByLabel('Verified Pochi registered payee')
    .fill('Isolated QA payee');
  await sf.getByLabel('Verified Pochi phone number').fill('0712345678');
  await sf
    .getByLabel('Pochi payment instructions')
    .fill('Isolated QA instructions; no real payment.');
  await sf.getByLabel('Enable payment instructions').check();
  await sf
    .getByLabel(
      'I independently verified the Pochi account and these instructions',
    )
    .check();
  await sf.getByLabel('Merchandise balance policy').selectOption('delivery');
  await sf
    .getByRole('button', { name: 'Business & payment settings', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Saved successfully');
  const customer = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const shop = await customer.newPage();
  await shop.goto('/shop/');
  await expect(
    shop.getByRole('heading', { name: 'Avocado seedlings', exact: true }),
  ).toBeVisible();
  let cartCount = 0;
  for (const [name, qty] of [
    ['Avocado seedlings', '5'],
    ['Guava seedlings', '10'],
    ['Moringa seed packets', '2'],
  ]) {
    const card = shop
      .locator('article')
      .filter({ has: shop.getByRole('heading', { name, exact: true }) });
    await card.getByLabel('Quantity for ' + name).fill(qty);
    await card
      .getByRole('button', { name: 'Add to cart', exact: true })
      .click();
    cartCount += Number(qty);
    await expect(shop.locator('[data-cart-count]')).toHaveText(
      String(cartCount),
    );
    await expect(shop.getByRole('status')).toContainText('Added to your cart');
  }
  await shop.goto('/cart/');
  await expect(shop.getByText('KES 1,950.00', { exact: true })).toBeVisible();
  await expect(shop.getByText('KES 975.00', { exact: true })).toBeVisible();
  await shop.getByRole('link', { name: 'Proceed to checkout' }).click();
  await shop.getByLabel('Full name').fill('Browser Test Customer');
  await shop.getByLabel('Mobile phone').fill('0712345678');
  await shop.getByLabel('County', { exact: true }).fill('Test county');
  await shop.getByLabel('Town', { exact: true }).fill('Test town');
  await shop.getByLabel('Estate or location').fill('Test estate');
  await shop
    .getByLabel('Address, landmark & delivery instructions')
    .fill('Test destination only');
  await axe(shop);
  await shop.getByRole('button', { name: 'Place order request' }).click();
  await expect(shop).toHaveURL(/\/order\//);
  await expect(shop.locator('#order-content')).toContainText('awaiting stock');
  const reference = await shop
    .getByLabel('Order reference', { exact: true })
    .inputValue();
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open ' + reference, exact: true })
    .click();
  await page
    .locator('#order-action')
    .getByLabel('Action', { exact: true })
    .selectOption('confirm_stock');
  await page
    .locator('#order-action')
    .getByRole('button', { name: 'Order operations', exact: true })
    .click();
  await expect(page.locator('#order-detail')).toContainText(
    'awaiting_transport',
  );
  await page
    .locator('#quote-form')
    .getByLabel('Transport fee (KES)')
    .fill('100');
  await page
    .locator('#quote-form')
    .getByLabel('Transport payment policy')
    .selectOption('delivery');
  await page
    .locator('#quote-form')
    .getByLabel('Quotation notes')
    .fill('QA quote by arrangement');
  await page
    .locator('#quote-form')
    .getByRole('button', { name: 'Confirm transport quotation', exact: true })
    .click();
  await expect(page.locator('#order-detail')).toContainText('awaiting_deposit');
  await shop.getByRole('button', { name: 'View order', exact: true }).click();
  await expect(
    shop.getByRole('heading', { name: 'Pochi la Biashara payment' }),
  ).toBeVisible();
  await shop.getByLabel('M-Pesa transaction code').fill('E2E1234567');
  await shop.getByLabel('Amount paid (KES)').fill('975');
  await shop.getByLabel('Payer mobile number').fill('0712345678');
  await shop
    .getByLabel('Date and time of payment')
    .fill(new Date(Date.now() - 60000).toISOString().slice(0, 16));
  await shop
    .getByRole('button', { name: 'Submit payment evidence', exact: true })
    .click();
  await expect(shop.getByRole('status')).toContainText(
    'Payment submitted — awaiting Herb-All verification',
  );
  await page
    .getByRole('button', { name: 'Payment queue', exact: true })
    .click();
  const decision = page.locator('form[id^=decision-]');
  await decision
    .getByLabel('Decision', { exact: true })
    .selectOption('verified');
  await decision
    .getByLabel('Decision reason')
    .fill('Isolated QA account check');
  await decision
    .getByLabel('I checked the payment in the business account')
    .check();
  await decision.getByRole('button').click();
  await expect(
    page.getByText('No payments awaiting review.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open ' + reference, exact: true })
    .click();
  for (const action of ['prepare', 'dispatch']) {
    const form = page.locator('#order-action');
    await form.getByLabel('Action', { exact: true }).selectOption(action);
    await form
      .getByLabel('Notes / reason / dispatch details')
      .fill('QA ' + action);
    await form
      .getByRole('button', { name: 'Order operations', exact: true })
      .click();
    await expect(page.locator('#order-detail')).toContainText(
      action === 'prepare' ? 'preparing' : 'dispatched',
    );
  }
  await shop.getByRole('button', { name: 'View order', exact: true }).click();
  await expect(shop.locator('#order-content')).toContainText('dispatched');
  await axe(shop);
  await axe(page);
  const balance = await database().query(
    "SELECT stock,reserved FROM products WHERE sku='TEST-AVOCADO'",
  );
  expect(balance.rows[0]).toEqual({ stock: 0, reserved: 0 });
  await customer.close();
});
test('empty states, shop filtering, cart persistence/update/removal and responsive accessibility', async ({
  page,
}) => {
  await page.goto('/shop/');
  await expect(
    page.getByRole('heading', {
      name: 'The next growing collection is on its way.',
    }),
  ).toBeVisible();
  await fixtureProduct(admin, 'Guava seedlings', '80', 10);
  await fixtureProduct(admin, 'Avocado seedlings', '150', 5);
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of [
      '/shop/',
      '/cart/',
      '/checkout/',
      '/order/',
      '/admin/',
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await axe(page);
    }
  }
  await page.goto('/shop/');
  await page.getByLabel('Search shop').fill('Guava');
  await page.getByRole('button', { name: 'Find products' }).click();
  await expect(
    page.getByRole('heading', { name: 'Guava seedlings', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Avocado seedlings', exact: true }),
  ).toHaveCount(0);
  await page.getByLabel('Quantity for Guava seedlings').fill('2');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('status')).toContainText('Added');
  await page.goto('/cart/');
  await expect(page.getByText('KES 160.00', { exact: true })).toHaveCount(2);
  await page.getByLabel('Guava seedlings quantity').fill('3');
  await page.getByLabel('Guava seedlings quantity').press('Tab');
  await expect(page.getByRole('status')).toContainText('Cart updated');
  await page.reload();
  await expect(page.getByLabel('Guava seedlings quantity')).toHaveValue('3');
  await page.getByRole('button', { name: 'Remove Guava seedlings' }).click();
  await expect(
    page.getByRole('heading', { name: 'Your cart has room to grow.' }),
  ).toBeVisible();
});

test('super administrator creates staff, changes role and revokes existing sessions', async ({
  page,
  browser,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await login(page);
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  const email = 'staff-' + crypto.randomUUID() + '@example.test',
    password = crypto.randomUUID();
  const form = page.locator('#account-form');
  await form.getByLabel('Administrator email', { exact: true }).fill(email);
  await form.getByLabel('Role', { exact: true }).selectOption('inventory');
  await form
    .getByLabel('Administrator-chosen password (12+ characters)')
    .fill(password);
  await form
    .getByRole('button', {
      name: 'Create authorized administrator',
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel('Role for ' + email, { exact: true }),
  ).toHaveValue('inventory');
  const staff = await browser.newContext();
  const staffPage = await staff.newPage();
  await staffPage.goto('/admin/');
  await staffPage.getByLabel('Email', { exact: true }).fill(email);
  await staffPage.getByLabel('Password', { exact: true }).fill(password);
  await staffPage.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    staffPage.getByRole('button', { name: 'Products & stock', exact: true }),
  ).toBeVisible();
  await expect(
    staffPage.getByRole('button', { name: 'Payment queue', exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel('Role for ' + email, { exact: true })
    .selectOption('orders');
  const savedRole = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/admin/accounts/role') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Save role for ' + email, exact: true })
    .click();
  expect((await savedRole).status()).toBe(200);
  await expect(
    page.getByLabel('Role for ' + email, { exact: true }),
  ).toHaveValue('orders');
  expect((await staffPage.request.get('/api/auth/me')).status()).toBe(401);
  await axe(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await staff.close();
});

test('unconfigured preview and closed checkout display safe, usable messaging', async ({
  page,
}) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error:
          'Shop configuration is not available yet. Please enquire directly.',
      }),
    }),
  );
  await page.goto('/shop/');
  await expect(page.getByRole('status')).toContainText(
    'Shop configuration is not available yet',
  );
  await expect(
    page
      .locator('#shop-content')
      .getByRole('link', { name: 'Contact Herb-All' }),
  ).toBeVisible();
  await axe(page);
  await page.goto('/about/');
  await expect(
    page.getByText('David Muriu Warunge', { exact: true }).first(),
  ).toBeVisible();
  await page.unroute('**/api/**');
  const p = await fixtureProduct(admin);
  if (process.env.COMMERCE_CHECKOUT_ENABLED !== 'false')
    await page.route('**/api/public/settings', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          checkout_enabled: false,
          reservation_hours: 48,
          collection_enabled: false,
        }),
      }),
    );
  await page.goto('/shop/');
  await page.evaluate(
    (item) =>
      localStorage.setItem(
        'herb-all-cart',
        JSON.stringify([{ product_id: item, quantity: 1 }]),
      ),
    p.id,
  );
  await page.goto('/cart/');
  await expect(page.getByRole('status')).toContainText(
    'Checkout is not open yet',
  );
  await expect(page.locator('#checkout-link')).toBeHidden();
  await page.goto('/checkout/');
  await expect(page.getByRole('status')).toContainText(
    'Checkout is not open yet',
  );
  await expect(page.locator('#checkout-form button')).toBeDisabled();
  await axe(page);
  if (process.env.COMMERCE_CHECKOUT_ENABLED === 'false') {
    const blocked = await page.request.post('/api/orders', {
      headers: {
        Origin: 'http://127.0.0.1:4321',
        'Idempotency-Key': crypto.randomUUID().replaceAll('-', ''),
      },
      data: basket([{ product_id: p.id, quantity: 1 }]),
    });
    expect(blocked.status()).toBe(503);
  }
  expect(
    (await database().query('SELECT count(*) n FROM orders')).rows[0].n,
  ).toBe('0');
});

test('farm collection summary removes the delivery deposit', async ({
  page,
}) => {
  await database().query('UPDATE settings SET data=$1 WHERE id=1', [
    { collection_enabled: true },
  ]);
  const p = await fixtureProduct(admin);
  await page.goto('/shop/');
  await page.evaluate(
    (item) =>
      localStorage.setItem(
        'herb-all-cart',
        JSON.stringify([{ product_id: item, quantity: 1 }]),
      ),
    p.id,
  );
  await page.goto('/checkout/');
  await expect(page.locator('#checkout-summary')).toContainText(
    '50% merchandise deposit',
  );
  await page.getByLabel('Delivery method').selectOption('collection');
  await expect(page.locator('#checkout-summary')).toContainText(
    'no upfront payment',
  );
  await expect(page.locator('#checkout-summary')).not.toContainText(
    '50% merchandise deposit',
  );
  await expect(page.locator('#delivery-fields')).toBeHidden();
  await page.getByLabel('Delivery method').selectOption('delivery');
  await expect(page.locator('#checkout-summary')).toContainText(
    '50% merchandise deposit',
  );
  await expect(page.locator('#delivery-fields')).toBeVisible();
});
