import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { spawnSync } from 'node:child_process';
import { database, transaction, row, closeDatabase } from '../../server/db.mjs';
import { id, token, hash, cents, finance } from '../../server/core.mjs';
import {
  products,
  cartQuote,
  placeOrder,
  adjustStock,
  expire,
  submitPayment,
  decidePayment,
  detail,
  orderAction,
  refund,
} from '../../server/commerce.mjs';
import { handler, estimateDistance } from '../../server/api.mjs';
import { reset, fixtureAdmin, fixtureProduct, basket } from './fixtures.mjs';
process.env.ORDER_TOKEN_SECRET = token();
process.env.PUBLIC_SITE_URL = 'http://127.0.0.1:4321';
process.env.APP_ENV = 'development';
beforeEach(async () => {
  process.env.COMMERCE_CHECKOUT_ENABLED = 'true';
  await reset();
});
after(closeDatabase);
const tx = (fn) => transaction(fn);
async function call(path, body, session = {}, method) {
  const response = await handler(
    new Request('http://127.0.0.1:4321/api/' + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        ...(body
          ? {
              'Content-Type': 'application/json',
              Origin: 'http://127.0.0.1:4321',
            }
          : {}),
        ...(session.cookie
          ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf }
          : {}),
        ...(body ? { 'Idempotency-Key': session.key || token() } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { ip: session.ip || 'test' },
  );
  return {
    status: response.status,
    data:
      response.headers.get('content-type') === 'image/webp'
        ? await response.arrayBuffer()
        : await response.json(),
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
async function login(a) {
  const r = await call('auth/login', { email: a.email, password: a.password });
  assert.equal(r.status, 200);
  return { cookie: r.cookie, csrf: r.data.csrf };
}
async function payable(a, p) {
  const placed = await tx((c) =>
    placeOrder(c, basket([{ product_id: p.id, quantity: 1 }]), token()),
  );
  await tx(async (c) => {
    await c.query('UPDATE settings SET data=$1 WHERE id=1', [
      {
        payment_enabled: true,
        payee: 'Isolated fixture',
        pochi_phone: '+254712345678',
        payment_instructions: 'Test only',
      },
    ]);
    let o = await row(c, 'SELECT * FROM orders WHERE reference=$1 FOR UPDATE', [
      placed.order.reference,
    ]);
    await orderAction(c, o, { action: 'confirm_stock' }, a);
    o = await row(c, 'SELECT * FROM orders WHERE id=$1', [o.id]);
    await orderAction(
      c,
      o,
      {
        action: 'quote',
        fee: '10',
        policy: 'upfront',
        reason: 'Fixture quote',
      },
      a,
    );
  });
  return placed;
}
const evidence = (reference = 'TEST123456', amount = '85') => ({
  reference,
  amount,
  phone: '0712345678',
  paid_at: new Date().toISOString(),
  message: 'Fixture only',
});
async function order(c, reference) {
  return row(c, 'SELECT * FROM orders WHERE reference=$1 FOR UPDATE', [
    reference,
  ]);
}
test('integer cents and documented half-cent deposit rounding', () => {
  assert.equal(cents('150.01'), 15001);
  assert.throws(() => cents('1.001'));
  assert.throws(() => cents('-1'));
  assert.throws(() => cents('1e2'));
  assert.equal(
    finance({
      subtotal_cents: 195000,
      adjustment_cents: 0,
      transport_cents: null,
      verified_cents: 0,
      refunded_cents: 0,
      transport_policy: 'upfront',
    }).deposit_cents,
    97500,
  );
  assert.equal(
    finance({
      subtotal_cents: 101,
      adjustment_cents: 0,
      transport_cents: 0,
      verified_cents: 0,
      refunded_cents: 0,
      transport_policy: 'upfront',
    }).deposit_cents,
    51,
  );
});
test('sample basket totals 1950 KES and server-priced deposit 975 KES', async () => {
  const a = await fixtureAdmin();
  const ps = await Promise.all([
    fixtureProduct(a, 'Avocado seedlings', '150'),
    fixtureProduct(a, 'Guava seedlings', '80'),
    fixtureProduct(a, 'Moringa seed packets', '200'),
  ]);
  const q = await tx((c) =>
    cartQuote(
      c,
      ps.map((p, i) => ({
        product_id: p.id,
        quantity: [5, 10, 2][i],
        price: 1,
      })),
    ),
  );
  assert.equal(q.subtotal_cents, 195000);
  assert.equal(q.deposit_cents, 97500);
  assert.equal(q.transport_cents, null);
});
test('database catalogue search/category/sort and live stock changes', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a, 'Guava', '80', 3);
  await fixtureProduct(a, 'Avocado', '150', 4);
  const result = await tx((c) =>
    products(c, { q: 'Guava', category: 'Test seedlings', sort: 'price_desc' }),
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].available, 3);
  await tx((c) =>
    adjustStock(c, { product_id: p.id, stock: 1, reason: 'Physical count' }, a),
  );
  assert.equal(
    (await tx((c) => products(c, { slug: p.slug }))).items[0].available,
    1,
  );
});
test('quantity, unavailable stock and browser price manipulation rejected', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a, 'A', '150', 2);
  for (const q of [0, -1, 1.5, 3, 10001])
    await assert.rejects(
      tx((c) => cartQuote(c, [{ product_id: p.id, quantity: q }])),
    );
  const o = await tx((c) =>
    placeOrder(
      c,
      {
        ...basket([{ product_id: p.id, quantity: 1 }]),
        subtotal_cents: 1,
        price: 1,
      },
      token(),
    ),
  );
  assert.equal(o.order.subtotal_cents, 15000);
  await assert.rejects(
    tx((c) =>
      adjustStock(c, { product_id: p.id, stock: 0, reason: 'Invalid' }, a),
    ),
  );
  await database().query('UPDATE products SET unavailable=true WHERE id=$1', [
    p.id,
  ]);
  await assert.rejects(
    tx((c) => cartQuote(c, [{ product_id: p.id, quantity: 1 }])),
  );
});
test('simultaneous customers cannot oversell the final item', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a, 'Last item', '150', 1);
  const results = await Promise.allSettled([
    tx((c) =>
      placeOrder(c, basket([{ product_id: p.id, quantity: 1 }]), token()),
    ),
    tx((c) =>
      placeOrder(c, basket([{ product_id: p.id, quantity: 1 }]), token()),
    ),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const inventory = await row(
    database(),
    'SELECT stock,reserved FROM products WHERE id=$1',
    [p.id],
  );
  assert.deepEqual(inventory, { stock: 1, reserved: 1 });
});
test('repeated concurrent checkout is idempotent and mismatched replay is rejected', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const key = token(),
    data = basket([{ product_id: p.id, quantity: 2 }]);
  const [a1, a2] = await Promise.all([
    tx((c) => placeOrder(c, data, key)),
    tx((c) => placeOrder(c, data, key)),
  ]);
  assert.equal(a1.order.reference, a2.order.reference);
  assert.equal(a1.tracking_token, a2.tracking_token);
  assert.equal(
    (await row(database(), 'SELECT reserved FROM products WHERE id=$1', [p.id]))
      .reserved,
    2,
  );
  await assert.rejects(
    tx((c) => placeOrder(c, { ...data, name: 'Different' }, key)),
  );
});
test('stock changes before checkout produce a useful failure without an order', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a, 'A', '150', 2);
  await tx((c) => cartQuote(c, [{ product_id: p.id, quantity: 2 }]));
  await tx((c) =>
    adjustStock(c, { product_id: p.id, stock: 1, reason: 'Count' }, a),
  );
  await assert.rejects(
    tx((c) =>
      placeOrder(c, basket([{ product_id: p.id, quantity: 2 }]), token()),
    ),
    /only 1 available/,
  );
  assert.equal((await row(database(), 'SELECT count(*) n FROM orders')).n, '0');
});
test('expiry and repeated cancellation release reservations exactly once', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await tx((c) =>
    placeOrder(c, basket([{ product_id: p.id, quantity: 2 }]), token()),
  );
  await database().query(
    "UPDATE orders SET reservation_expires_at=now()-interval '1 minute' WHERE reference=$1",
    [r.order.reference],
  );
  await tx(expire);
  await tx(expire);
  assert.equal(
    (await row(database(), 'SELECT reserved FROM products WHERE id=$1', [p.id]))
      .reserved,
    0,
  );
  const r2 = await tx((c) =>
    placeOrder(c, basket([{ product_id: p.id, quantity: 2 }]), token()),
  );
  for (let n = 0; n < 2; n++)
    await tx(async (c) =>
      orderAction(
        c,
        await order(c, r2.order.reference),
        { action: 'cancel', reason: 'Test' },
        a,
      ),
    );
  assert.equal(
    (await row(database(), 'SELECT reserved FROM products WHERE id=$1', [p.id]))
      .reserved,
    0,
  );
});
test('historical snapshots survive price, name and archive edits', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await tx((c) =>
    placeOrder(c, basket([{ product_id: p.id, quantity: 1 }]), token()),
  );
  await database().query(
    "UPDATE products SET name='Different',price_cents=1,archived=true WHERE id=$1",
    [p.id],
  );
  const old = await tx(async (c) =>
    detail(c, await order(c, r.order.reference)),
  );
  assert.equal(old.items[0].name, 'Avocado seedlings');
  assert.equal(old.items[0].unit_price_cents, 15000);
});
test('evidence remains pending, insufficient credit, duplicate verification and complete fulfilment', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await payable(a, p);
  await tx(async (c) =>
    submitPayment(
      c,
      await order(c, r.order.reference),
      evidence('TEST123456', '10'),
    ),
  );
  let o = await tx(async (c) =>
    detail(c, await order(c, r.order.reference), true),
  );
  assert.equal(o.paid_cents, 0);
  assert.equal(o.status, 'verification_pending');
  const decision = {
    payment_id: o.payments[0].id,
    decision: 'verified',
    verified_amount: '10',
    reason: 'Account checked',
    confirmed: true,
  };
  await Promise.all([
    tx((c) => decidePayment(c, decision, a)),
    tx((c) => decidePayment(c, decision, a)),
  ]);
  o = await tx(async (c) => detail(c, await order(c, r.order.reference)));
  assert.equal(o.paid_cents, 1000);
  assert.equal(o.status, 'awaiting_additional_payment');
  await assert.rejects(
    tx(async (c) =>
      orderAction(
        c,
        await order(c, r.order.reference),
        { action: 'dispatch', reason: 'Test' },
        a,
      ),
    ),
  );
  await tx(async (c) =>
    submitPayment(
      c,
      await order(c, r.order.reference),
      evidence('TEST654321', '150'),
    ),
  );
  const pp = await row(
    database(),
    "SELECT id FROM payments WHERE reference='TEST654321'",
  );
  await tx((c) =>
    decidePayment(
      c,
      { ...decision, payment_id: pp.id, verified_amount: '150' },
      a,
    ),
  );
  await tx(async (c) =>
    orderAction(c, await order(c, r.order.reference), { action: 'prepare' }, a),
  );
  await tx(async (c) =>
    orderAction(
      c,
      await order(c, r.order.reference),
      { action: 'dispatch', reason: 'Courier fixture' },
      a,
    ),
  );
  await tx(async (c) =>
    orderAction(c, await order(c, r.order.reference), { action: 'deliver' }, a),
  );
  const stock = await row(
    database(),
    'SELECT stock,reserved FROM products WHERE id=$1',
    [p.id],
  );
  assert.deepEqual(stock, { stock: 19, reserved: 0 });
  assert.equal(
    (
      await row(database(), 'SELECT status FROM orders WHERE reference=$1', [
        r.order.reference,
      ])
    ).status,
    'delivered',
  );
  assert.equal(
    (
      await row(
        database(),
        "SELECT count(*) n FROM audit_events WHERE action='payment verified'",
      )
    ).n,
    '2',
  );
});
test('duplicate payment reference cannot be credited to another order and rejection stays uncredited', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const x = await payable(a, p),
    y = await payable(a, p);
  await tx(async (c) =>
    submitPayment(c, await order(c, x.order.reference), evidence()),
  );
  await assert.rejects(
    tx(async (c) =>
      submitPayment(c, await order(c, y.order.reference), evidence()),
    ),
    /already in use/,
  );
  const pay = await row(database(), 'SELECT id FROM payments');
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: pay.id,
        decision: 'rejected',
        reason: 'Not found in account',
      },
      a,
    ),
  );
  assert.equal(
    (
      await row(
        database(),
        'SELECT verified_cents FROM orders WHERE reference=$1',
        [x.order.reference],
      )
    ).verified_cents,
    '0',
  );
  await assert.rejects(
    tx(async (c) =>
      orderAction(
        c,
        await order(c, x.order.reference),
        { action: 'quote', fee: '20', policy: 'delivery', reason: 'Changed' },
        a,
      ),
    ),
    /frozen/,
  );
});
test('paid cancellation and refund recording cannot double restock or over-refund', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await payable(a, p);
  await tx(async (c) =>
    submitPayment(c, await order(c, r.order.reference), evidence()),
  );
  const pay = await row(database(), 'SELECT id FROM payments');
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: pay.id,
        decision: 'verified',
        verified_amount: '85',
        reason: 'Checked',
        confirmed: true,
      },
      a,
    ),
  );
  await tx(async (c) =>
    orderAction(
      c,
      await order(c, r.order.reference),
      { action: 'cancel', reason: 'Customer request' },
      a,
    ),
  );
  await assert.rejects(
    tx(async (c) =>
      refund(
        c,
        await order(c, r.order.reference),
        { amount: '86', reason: 'Refund', confirmed: true },
        a,
      ),
    ),
  );
  await tx(async (c) =>
    refund(
      c,
      await order(c, r.order.reference),
      { amount: '85', reason: 'External refund REF123', confirmed: true },
      a,
    ),
  );
  await assert.rejects(
    tx(async (c) =>
      refund(
        c,
        await order(c, r.order.reference),
        { amount: '85', reason: 'Duplicate', confirmed: true },
        a,
      ),
    ),
  );
  assert.equal(
    (await row(database(), 'SELECT reserved FROM products WHERE id=$1', [p.id]))
      .reserved,
    0,
  );
});
test('authentication, CSRF, roles, customer privacy and hashed sessions', async () => {
  const inventory = await fixtureAdmin('inventory'),
    payments = await fixtureAdmin('payments'),
    orders = await fixtureAdmin('orders'),
    superAdmin = await fixtureAdmin();
  assert.equal((await call('admin/dashboard')).status, 401);
  const s = await login(inventory);
  assert.equal((await call('admin/orders', undefined, s)).status, 403);
  assert.equal(
    (
      await call(
        'admin/stock',
        { product_id: id(), stock: 1, reason: 'Test' },
        { cookie: s.cookie, csrf: 'bad' },
      )
    ).status,
    403,
  );
  assert.equal(
    (await call('admin/products', undefined, await login(payments))).status,
    403,
  );
  assert.equal(
    (await call('admin/payments', undefined, await login(orders))).status,
    403,
  );
  assert.equal((await call('admin/settings', undefined, s)).status, 403);
  const p = await fixtureProduct(superAdmin);
  const placed = await call(
    'orders',
    basket([{ product_id: p.id, quantity: 1 }]),
    { key: token() },
  );
  assert.equal(placed.status, 201);
  assert.equal(
    (
      await call('track', {
        reference: placed.data.order.reference,
        tracking_token: 'wrong',
      })
    ).status,
    404,
  );
  const authorized = await call('track', {
    reference: placed.data.order.reference,
    tracking_token: placed.data.tracking_token,
  });
  assert.equal(authorized.status, 200);
  assert.equal(authorized.data.id, undefined);
  const sessions = await database().query('SELECT token_hash FROM sessions');
  assert.ok(
    sessions.rows.every(
      (r) => r.token_hash.length === 64 && !s.cookie.includes(r.token_hash),
    ),
  );
});
test('cross-origin requests denied and authentication attempts rate limited after failures', async () => {
  const response = await handler(
    new Request('http://127.0.0.1:4321/api/orders', {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }),
  );
  assert.equal(response.status, 403);
  for (let n = 0; n < 12; n++)
    assert.equal(
      (
        await call(
          'auth/login',
          { email: 'missing@example.test', password: 'not-the-password' },
          { ip: 'bruteforce' },
        )
      ).status,
      401,
    );
  assert.equal(
    (
      await call(
        'auth/login',
        { email: 'missing@example.test', password: 'not-the-password' },
        { ip: 'bruteforce' },
      )
    ).status,
    429,
  );
});
test('image uploads normalize public images and private receipts cannot be accessed anonymously', async () => {
  const a = await fixtureAdmin();
  const s = await login(a);
  const p = await fixtureProduct(a);
  const png = await sharp({
    create: { width: 20, height: 20, channels: 3, background: '#00aa00' },
  })
    .png()
    .toBuffer();
  const uploaded = await call(
    'admin/image',
    { product_id: p.id, alt: 'Test plant', data: png.toString('base64') },
    s,
  );
  assert.equal(uploaded.status, 200);
  assert.equal((await call('media/' + uploaded.data.id)).status, 200);
  assert.equal(
    (
      await call(
        'admin/image',
        {
          product_id: p.id,
          alt: 'Bad',
          data: Buffer.from('<svg><script>alert(1)</script></svg>').toString(
            'base64',
          ),
        },
        s,
      )
    ).status,
    400,
  );
  const placed = await payable(a, p);
  const payment = await call('payment', {
    ...evidence(),
    order_reference: placed.order.reference,
    tracking_token: placed.tracking_token,
  });
  const attachment = await call('payment/attachment', {
    payment_id: payment.data.submitted_payment_id,
    order_reference: placed.order.reference,
    tracking_token: placed.tracking_token,
    data: png.toString('base64'),
  });
  assert.equal(attachment.status, 200);
  const media = await row(database(), 'SELECT attachment_id FROM payments');
  assert.equal((await call('media/' + media.attachment_id)).status, 401);
  assert.equal(
    (await call('media/' + media.attachment_id, undefined, s)).status,
    200,
  );
});
test('one-time recovery revokes old sessions and cannot be replayed', async () => {
  const a = await fixtureAdmin();
  const s = await login(a);
  const resetToken = token();
  await database().query(
    "INSERT INTO password_resets(token_hash,administrator_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
    [hash(resetToken), a.id],
  );
  const newPassword = token();
  assert.equal(
    (await call('auth/reset', { token: resetToken, password: newPassword }))
      .status,
    200,
  );
  assert.equal((await call('auth/me', undefined, s)).status, 401);
  assert.equal(
    (await call('auth/reset', { token: resetToken, password: newPassword }))
      .status,
    400,
  );
  assert.equal(
    (await call('auth/login', { email: a.email, password: newPassword }))
      .status,
    200,
  );
});
test('missing Maps or failed service keeps manual delivery fallback', async () => {
  delete process.env.GOOGLE_ROUTES_API_KEY;
  assert.deepEqual(await estimateDistance({ destination: {} }), {
    status: 'manual',
    distance_meters: null,
  });
  process.env.GOOGLE_ROUTES_API_KEY = 'isolated-test';
  process.env.FARM_LATITUDE = '-1';
  process.env.FARM_LONGITUDE = '36';
  const real = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Quota unavailable');
  };
  try {
    assert.equal(
      (await estimateDistance({ destination: { town: 'Test' } })).status,
      'unavailable',
    );
  } finally {
    globalThis.fetch = real;
    delete process.env.GOOGLE_ROUTES_API_KEY;
  }
});

test('clarification accepts corrected evidence but still requires independent verification', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await payable(a, p);
  await tx(async (c) =>
    submitPayment(
      c,
      await order(c, r.order.reference),
      evidence('FIX1234567', '10'),
    ),
  );
  const pay = await row(database(), 'SELECT id FROM payments');
  await tx((c) =>
    decidePayment(
      c,
      { payment_id: pay.id, decision: 'clarification', reason: 'Check amount' },
      a,
    ),
  );
  await tx(async (c) =>
    submitPayment(
      c,
      await order(c, r.order.reference),
      evidence('FIX1234567', '85'),
    ),
  );
  const corrected = await row(
    database(),
    'SELECT state,reported_cents FROM payments',
  );
  assert.equal(corrected.state, 'pending');
  assert.equal(corrected.reported_cents, '8500');
  assert.equal(
    (await row(database(), 'SELECT verified_cents FROM orders')).verified_cents,
    '0',
  );
  assert.equal(
    (
      await row(
        database(),
        "SELECT count(*) n FROM order_history WHERE event='Payment evidence corrected'",
      )
    ).n,
    '1',
  );
});
test('delivery-payment balance preserves dispatched status and inventory while verified', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await payable(a, p);
  await database().query(
    "UPDATE orders SET balance_policy='delivery' WHERE reference=$1",
    [r.order.reference],
  );
  await tx(async (c) =>
    submitPayment(c, await order(c, r.order.reference), evidence()),
  );
  let pay = await row(database(), 'SELECT id FROM payments');
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: pay.id,
        decision: 'verified',
        verified_amount: '85',
        reason: 'Checked',
        confirmed: true,
      },
      a,
    ),
  );
  await tx(async (c) =>
    orderAction(c, await order(c, r.order.reference), { action: 'prepare' }, a),
  );
  await tx(async (c) =>
    orderAction(
      c,
      await order(c, r.order.reference),
      { action: 'dispatch', reason: 'Dispatch fixture' },
      a,
    ),
  );
  await tx(async (c) =>
    submitPayment(
      c,
      await order(c, r.order.reference),
      evidence('BAL1234567', '75'),
    ),
  );
  assert.equal(
    (await row(database(), 'SELECT status FROM orders')).status,
    'dispatched',
  );
  pay = await row(
    database(),
    "SELECT id FROM payments WHERE reference='BAL1234567'",
  );
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: pay.id,
        decision: 'verified',
        verified_amount: '75',
        reason: 'Balance checked',
        confirmed: true,
      },
      a,
    ),
  );
  assert.equal(
    (await row(database(), 'SELECT status FROM orders')).status,
    'dispatched',
  );
  await tx(async (c) =>
    orderAction(c, await order(c, r.order.reference), { action: 'deliver' }, a),
  );
  assert.deepEqual(
    await row(database(), 'SELECT stock,reserved FROM products WHERE id=$1', [
      p.id,
    ]),
    { stock: 19, reserved: 0 },
  );
});

test('concurrent protected stock changes and refund retries are idempotent', async () => {
  const a = await fixtureAdmin();
  const session = await login(a),
    p = await fixtureProduct(a);
  const key = token(),
    stock = { product_id: p.id, stock: 22, reason: 'Counted physical stock' };
  const results = await Promise.all([
    call('admin/stock', stock, { ...session, key }),
    call('admin/stock', stock, { ...session, key }),
  ]);
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(
    (
      await row(
        database(),
        "SELECT count(*) n FROM inventory_movements WHERE reason='Counted physical stock'",
      )
    ).n,
    '1',
  );
  assert.equal(
    (await call('admin/stock', { ...stock, stock: 23 }, { ...session, key }))
      .status,
    409,
  );
  const r = await payable(a, p);
  await tx(async (c) =>
    submitPayment(c, await order(c, r.order.reference), evidence()),
  );
  const payment = await row(database(), 'SELECT id FROM payments');
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: payment.id,
        decision: 'verified',
        verified_amount: '85',
        reason: 'Checked',
        confirmed: true,
      },
      a,
    ),
  );
  await tx(async (c) =>
    orderAction(
      c,
      await order(c, r.order.reference),
      { action: 'cancel', reason: 'Cancel fixture' },
      a,
    ),
  );
  const refundData = {
    reference: r.order.reference,
    amount: '20',
    reason: 'External partial refund REF-ONE',
    confirmed: true,
  };
  const refundKey = token();
  for (let n = 0; n < 2; n++)
    assert.equal(
      (await call('admin/refund', refundData, { ...session, key: refundKey }))
        .status,
      200,
    );
  assert.equal(
    (await row(database(), 'SELECT refunded_cents FROM orders')).refunded_cents,
    '2000',
  );
});
test('notification failure retains order and retry outbox without disclosing internal notes', async () => {
  const { deliverNotifications } =
    await import('../../server/notifications.mjs');
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await tx((c) =>
    placeOrder(c, basket([{ product_id: p.id, quantity: 1 }]), token()),
  );
  await tx(async (c) =>
    orderAction(
      c,
      await order(c, r.order.reference),
      { action: 'note', reason: 'Private operational note' },
      a,
    ),
  );
  assert.equal(
    (await row(database(), 'SELECT count(*) n FROM notification_outbox')).n,
    '1',
  );
  process.env.RESEND_API_KEY = 'test-only';
  process.env.NOTIFICATION_FROM = 'qa@example.test';
  process.env.ADMIN_NOTIFICATION_EMAIL = 'admin@example.test';
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response('{}', { status: 503 });
  try {
    await deliverNotifications();
    assert.equal(
      (await row(database(), 'SELECT count(*) n FROM orders')).n,
      '1',
    );
    const entry = await row(
      database(),
      'SELECT sent_at,attempts FROM notification_outbox',
    );
    assert.equal(entry.sent_at, null);
    assert.equal(entry.attempts, 1);
    await database().query(
      'UPDATE notification_outbox SET next_attempt_at=now()',
    );
    globalThis.fetch = async (_url, options) => {
      assert.ok(options.headers['Idempotency-Key'].startsWith('herb-all-'));
      return new Response('{}', { status: 200 });
    };
    await deliverNotifications();
    assert.ok(
      (await row(database(), 'SELECT sent_at FROM notification_outbox'))
        .sent_at,
    );
  } finally {
    globalThis.fetch = real;
    delete process.env.RESEND_API_KEY;
    delete process.env.NOTIFICATION_FROM;
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
  }
});

test('delivery charges are not requested upfront and overpayments are separately refundable', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await payable(a, p);
  await database().query(
    "UPDATE orders SET transport_policy='delivery' WHERE reference=$1",
    [r.order.reference],
  );
  let o = await tx(async (c) => detail(c, await order(c, r.order.reference)));
  assert.equal(o.current_due_cents, 7500);
  await tx(async (c) =>
    submitPayment(
      c,
      await order(c, r.order.reference),
      evidence('OVR1234567', '200'),
    ),
  );
  const pay = await row(database(), 'SELECT id FROM payments');
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: pay.id,
        decision: 'verified',
        verified_amount: '200',
        reason: 'Actual full amount independently received',
        confirmed: true,
      },
      a,
    ),
  );
  o = await tx(async (c) => detail(c, await order(c, r.order.reference)));
  assert.equal(o.overpayment_cents, 4000);
  assert.equal(o.current_due_cents, 0);
  await tx(async (c) =>
    refund(
      c,
      await order(c, r.order.reference),
      { amount: '40', reason: 'External surplus refund', confirmed: true },
      a,
    ),
  );
  o = await tx(async (c) => detail(c, await order(c, r.order.reference)));
  assert.equal(o.status, 'deposit_confirmed');
  assert.equal(o.overpayment_cents, 0);
  assert.equal(o.paid_cents, 16000);
});

test('cached mutations still require current permissions, and role changes revoke sessions', async () => {
  const a = await fixtureAdmin(),
    other = await fixtureAdmin('inventory');
  const s = await login(a),
    otherSession = await login(other);
  const key = token();
  const body = {
    collection_enabled: false,
    reservation_hours: 48,
    transport_policy: 'upfront',
    balance_policy: 'before_dispatch',
    payment_enabled: false,
  };
  assert.equal((await call('admin/settings', body, { ...s, key })).status, 200);
  await database().query(
    "UPDATE administrators SET role='inventory' WHERE id=$1",
    [a.id],
  );
  assert.equal((await call('admin/settings', body, { ...s, key })).status, 403);
  await database().query("UPDATE administrators SET role='super' WHERE id=$1", [
    a.id,
  ]);
  assert.equal(
    (await call('admin/accounts/role', { id: other.id, role: 'orders' }, s))
      .status,
    200,
  );
  assert.equal((await call('auth/me', undefined, otherSession)).status, 401);
  assert.equal(
    (await call('admin/accounts/role', { id: a.id, role: 'inventory' }, s))
      .status,
    400,
  );
  const newSession = await login(other);
  assert.equal(
    (await call('admin/products', undefined, newSession)).status,
    403,
  );
  assert.equal((await call('admin/orders', undefined, newSession)).status, 200);
});

test('cancelled payment evidence can be reconciled and refunded without reopening stock', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const r = await payable(a, p);
  const pay = await tx(async (c) =>
    submitPayment(c, await order(c, r.order.reference), evidence()),
  );
  await tx(async (c) =>
    orderAction(
      c,
      await order(c, r.order.reference),
      { action: 'cancel', reason: 'Customer cancelled while evidence pending' },
      a,
    ),
  );
  const stock = await row(
    database(),
    'SELECT stock,reserved FROM products WHERE id=$1',
    [p.id],
  );
  await tx((c) =>
    decidePayment(
      c,
      {
        payment_id: pay.submitted_payment_id,
        decision: 'verified',
        verified_amount: '85',
        confirmed: true,
        reason: 'Actual funds confirmed after cancellation',
      },
      a,
    ),
  );
  let o = await tx(async (c) => detail(c, await order(c, r.order.reference)));
  assert.equal(o.status, 'refund_pending');
  assert.equal(o.current_due_cents, 0);
  assert.equal(o.refund_due_cents, 8500);
  await tx(async (c) =>
    refund(
      c,
      await order(c, r.order.reference),
      {
        amount: '85',
        confirmed: true,
        reason: 'External completed refund REF-CANCELLED',
      },
      a,
    ),
  );
  o = await tx(async (c) => detail(c, await order(c, r.order.reference)));
  assert.equal(o.status, 'refunded');
  assert.equal(o.refund_due_cents, 0);
  assert.deepEqual(
    await row(database(), 'SELECT stock,reserved FROM products WHERE id=$1', [
      p.id,
    ]),
    stock,
  );
  assert.equal(stock.reserved, 0);
});

test('checkout launch gate fails closed without reserving stock and permits administration', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a);
  const session = await login(a);
  for (const value of [undefined, 'false', 'TRUE']) {
    if (value === undefined) delete process.env.COMMERCE_CHECKOUT_ENABLED;
    else process.env.COMMERCE_CHECKOUT_ENABLED = value;
    assert.equal((await call('public/settings')).data.checkout_enabled, false);
    assert.equal(
      (await call('orders', basket([{ product_id: p.id, quantity: 1 }])))
        .status,
      503,
    );
  }
  assert.equal((await row(database(), 'SELECT count(*) n FROM orders')).n, '0');
  assert.equal(
    (await row(database(), 'SELECT reserved FROM products WHERE id=$1', [p.id]))
      .reserved,
    0,
  );
  assert.equal((await call('admin/products', undefined, session)).status, 200);
  process.env.COMMERCE_CHECKOUT_ENABLED = 'true';
  const secret = process.env.ORDER_TOKEN_SECRET;
  try {
    process.env.ORDER_TOKEN_SECRET = '';
    assert.equal((await call('public/settings')).data.checkout_enabled, false);
    assert.equal(
      (await call('orders', basket([{ product_id: p.id, quantity: 1 }])))
        .status,
      503,
    );
  } finally {
    process.env.ORDER_TOKEN_SECRET = secret;
  }
  assert.equal(
    (await call('orders', basket([{ product_id: p.id, quantity: 1 }]))).status,
    201,
  );
});

test('all financial, inventory, image, fulfillment and account writes enforce role and CSRF', async () => {
  const matrix = {
    inventory: [
      'admin/order',
      'admin/distance',
      'admin/payments/decision',
      'admin/refund',
      'admin/accounts',
      'admin/accounts/role',
      'admin/settings',
    ],
    orders: [
      'admin/products',
      'admin/stock',
      'admin/image',
      'admin/payments/decision',
      'admin/refund',
      'admin/accounts',
      'admin/accounts/role',
      'admin/settings',
    ],
    payments: [
      'admin/products',
      'admin/stock',
      'admin/image',
      'admin/order',
      'admin/distance',
      'admin/accounts',
      'admin/accounts/role',
      'admin/settings',
    ],
  };
  for (const [role, paths] of Object.entries(matrix)) {
    const session = await login(await fixtureAdmin(role));
    for (const path of paths)
      assert.equal(
        (await call(path, {}, session)).status,
        403,
        role + ':' + path,
      );
  }
  const superSession = await login(await fixtureAdmin());
  for (const path of [
    'admin/products',
    'admin/stock',
    'admin/image',
    'admin/order',
    'admin/distance',
    'admin/payments/decision',
    'admin/refund',
    'admin/accounts',
    'admin/accounts/role',
    'admin/settings',
  ]) {
    assert.equal(
      (await call(path, {}, { ...superSession, csrf: 'wrong' })).status,
      403,
      path,
    );
    assert.equal((await call(path, {})).status, 401, path);
  }
});

test('payment enablement requires complete details and literal verified confirmation', async () => {
  const session = await login(await fixtureAdmin());
  const settings = {
    collection_enabled: false,
    reservation_hours: 48,
    transport_policy: 'upfront',
    balance_policy: 'before_dispatch',
    payment_enabled: true,
    payee: 'Isolated QA payee',
    pochi_phone: '+254712345678',
    payment_instructions: 'QA only',
    confirmed: true,
  };
  for (const fields of [
    { payee: '' },
    { pochi_phone: '' },
    { payment_instructions: '' },
    { confirmed: 'false' },
    { confirmed: false },
  ])
    assert.equal(
      (await call('admin/settings', { ...settings, ...fields }, session))
        .status,
      400,
    );
  assert.equal(
    (await row(database(), 'SELECT data FROM settings')).data.payment_enabled,
    undefined,
  );
  assert.equal((await call('admin/settings', settings, session)).status, 200);
});

test('failed multi-item checkout rolls back all reservations and creates no order', async () => {
  const a = await fixtureAdmin();
  const p = await fixtureProduct(a, 'Available QA plant', '150', 2);
  const missing = await fixtureProduct(a, 'Unavailable QA plant', '80', 0);
  assert.equal(
    (
      await call(
        'orders',
        basket([
          { product_id: p.id, quantity: 1 },
          { product_id: missing.id, quantity: 1 },
        ]),
      )
    ).status,
    409,
  );
  assert.equal((await row(database(), 'SELECT count(*) n FROM orders')).n, '0');
  assert.equal(
    (await row(database(), 'SELECT sum(reserved) n FROM products')).n,
    '0',
  );
});

test('unconfigured database and private tracking errors never expose secrets or traces', async () => {
  const databaseUrl = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    const response = await handler(
      new Request('http://127.0.0.1:4321/api/products'),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.deepEqual(await response.json(), {
      error:
        'Shop configuration is not available yet. Please enquire directly.',
    });
  } finally {
    process.env.DATABASE_URL = databaseUrl;
  }
});

test('migration failures do not print private connection values', () => {
  const r = spawnSync(process.execPath, ['server/migrate.mjs'], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: 'invalid-QA-private-url-sentinel' },
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Migration failed/);
  assert.doesNotMatch(r.stderr + r.stdout, /sentinel|stack|ERR_INVALID_URL/);
});
