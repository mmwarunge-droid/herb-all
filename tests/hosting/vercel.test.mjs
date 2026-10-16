import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import commerce from '../../api/[...path].mjs';
import maintenance from '../../api/maintenance.mjs';
import { closeDatabase } from '../../server/db.mjs';
const keys = [
  'DATABASE_URL',
  'DATABASE_SSL',
  'APP_ENV',
  'PUBLIC_SITE_URL',
  'VERCEL_ENV',
  'CRON_SECRET',
];
const original = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
after(() => {
  for (const [k, v] of Object.entries(original))
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
});
function setup() {
  delete process.env.DATABASE_URL;
  process.env.DATABASE_SSL = 'true';
  process.env.APP_ENV = 'production';
  process.env.PUBLIC_SITE_URL = 'https://herb-all.example';
  process.env.VERCEL_ENV = 'production';
  process.env.CRON_SECRET =
    'isolated-hosting-test-key-not-production-0123456789';
}
const req = (path, options = {}) =>
  new Request('https://herb-all.example/api/' + path, options);
const privateResponse = (r) => {
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.equal(r.headers.get('x-robots-tag'), 'noindex');
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
};
test('Web request adapter preserves nested API paths and sanitized unconfigured responses', async () => {
  setup();
  for (const path of [
    'products',
    'public/settings',
    'auth/me',
    'admin/accounts',
  ]) {
    const r = await commerce.fetch(req(path));
    assert.equal(r.status, 503);
    privateResponse(r);
    assert.doesNotMatch(
      await r.text(),
      /stack|postgres:\/\/|DATABASE_URL|\/home\/ubuntu/,
    );
  }
});
test('Vercel Preview and Development cannot access an accidentally injected production database', async () => {
  setup();
  process.env.DATABASE_URL = 'invalid-private-database-sentinel';
  for (const env of ['preview', 'development']) {
    process.env.VERCEL_ENV = env;
    const r = await commerce.fetch(req('products'));
    assert.equal(r.status, 503);
    privateResponse(r);
    assert.equal(
      (await r.json()).error,
      'Commerce is not configured for this environment.',
    );
  }
});
test('production origin is mandatory before database admission', async () => {
  setup();
  delete process.env.PUBLIC_SITE_URL;
  process.env.DATABASE_URL = 'invalid-private-database-sentinel';
  const r = await commerce.fetch(req('products'));
  assert.equal(r.status, 503);
  assert.equal(
    (await r.json()).error,
    'The production site origin is not configured.',
  );
});
test('wrong origins and malformed JSON retain existing commerce gates', async () => {
  setup();
  const cross = await commerce.fetch(
    req('auth/login', {
      method: 'POST',
      headers: {
        Origin: 'https://other.example',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }),
  );
  assert.equal(cross.status, 403);
  const malformed = await commerce.fetch(
    req('auth/login', {
      method: 'POST',
      headers: {
        Origin: 'https://herb-all.example',
        'Content-Type': 'application/json',
      },
      body: '{',
    }),
  );
  assert.equal(malformed.status, 400);
  privateResponse(malformed);
});
test('maintenance rejects unsupported methods, absent/weak configuration and guessed tokens before DB work', async () => {
  setup();
  assert.equal(
    (await maintenance.fetch(req('maintenance', { method: 'POST' }))).status,
    405,
  );
  for (const authorization of [undefined, 'Bearer wrong', 'Bearer']) {
    const r = await maintenance.fetch(
      req('maintenance', { headers: authorization ? { authorization } : {} }),
    );
    assert.equal(r.status, 401);
    privateResponse(r);
  }
  process.env.CRON_SECRET = 'short';
  assert.equal((await maintenance.fetch(req('maintenance'))).status, 503);
});
test('valid cron auth never falsely acknowledges a missing database', async () => {
  setup();
  const r = await maintenance.fetch(
    req('maintenance', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }),
  );
  assert.equal(r.status, 503);
  privateResponse(r);
  assert.equal(
    (await r.json()).error,
    'Maintenance database is not configured.',
  );
});
test('cron cannot run in Preview even if production credentials are accidentally shared', async () => {
  setup();
  process.env.VERCEL_ENV = 'preview';
  process.env.DATABASE_URL = 'invalid-private-database-sentinel';
  const r = await maintenance.fetch(
    req('maintenance', {
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    }),
  );
  assert.equal(r.status, 503);
  assert.equal(
    (await r.json()).error,
    'Maintenance is disabled for this environment.',
  );
});

test(
  'isolated PostgreSQL adapters serve products and run authenticated maintenance',
  { skip: !process.env.HOSTING_TEST_DATABASE_URL },
  async () => {
    assert.match(process.env.HOSTING_TEST_DATABASE_URL, /herb_all_test$/);
    setup();
    delete process.env.VERCEL_ENV;
    process.env.APP_ENV = 'development';
    process.env.DATABASE_SSL = 'false';
    process.env.DATABASE_URL = process.env.HOSTING_TEST_DATABASE_URL;
    try {
      assert.equal((await commerce.fetch(req('products'))).status, 200);
      assert.equal((await commerce.fetch(req('public/settings'))).status, 200);
      const r = await maintenance.fetch(
        req('maintenance', {
          headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
        }),
      );
      assert.equal(r.status, 204);
      privateResponse(r);
    } finally {
      await closeDatabase();
    }
  },
);
