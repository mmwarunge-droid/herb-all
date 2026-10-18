import { readFileSync, readdirSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';
const walk = (p) =>
  readdirSync(p).flatMap((n) =>
    statSync(`${p}/${n}`).isDirectory() ? walk(`${p}/${n}`) : [`${p}/${n}`],
  );
const files = walk('dist');
const forbidden =
  /postgres(?:ql)?:\/\/|\bDATABASE_URL\b|\bORDER_TOKEN_SECRET\b|\bpassword_hash\b|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk_live_|rk_live_)[A-Za-z0-9]+/;
for (const f of files.filter((f) =>
  /\.(?:html|js|json|xml|txt|css|map)$/.test(f),
)) {
  const text = readFileSync(f, 'utf8');
  assert.ok(!forbidden.test(text), `Sensitive configuration pattern in ${f}`);
  assert.ok(
    !text.includes('herb-all.netlify.app'),
    `Legacy production origin in ${f}`,
  );
}
for (const route of ['checkout', 'cart', 'order', 'admin']) {
  const html = readFileSync(`dist/${route}/index.html`, 'utf8');
  assert.match(html, /temporarily unavailable/);
  assert.ok(
    !/<form\b|type="password"|Pochi|50%/.test(html),
    `Transactional UI present: ${route}`,
  );
}
const shop = readFileSync('dist/shop/index.html', 'utf8');
assert.match(shop, /not live inventory/);
assert.ok(!shop.includes('Loading the current collection'));
assert.ok(!shop.includes('Add to cart'));
assert.ok(!readFileSync('dist/terms/index.html', 'utf8').includes('Pochi'));
const worker = readFileSync('cloudflare/worker.mjs', 'utf8');
assert.ok(
  !/import\s|fetch\(/.test(worker.replace('fetch()', 'handler()')),
  'Worker must not import backend modules or make network calls',
);
console.log(
  `Static safety scan passed: ${files.length} files; no secret patterns or Netlify origin; commerce forms absent.`,
);

const expectedOrigin = process.env.PUBLIC_SITE_URL;
assert.ok(
  expectedOrigin && expectedOrigin.startsWith('https://'),
  'An explicit HTTPS origin is required',
);
for (const f of [
  'sitemap.xml',
  'sitemap-index.xml',
  'sitemap-0.xml',
  'robots.txt',
  'rss.xml',
]) {
  const text = readFileSync('dist/' + f, 'utf8');
  assert.ok(text.includes(expectedOrigin), `Wrong SEO origin: ${f}`);
  if (expectedOrigin !== 'https://herb-all.example')
    assert.ok(!text.includes('herb-all.example'), `Example origin: ${f}`);
}
for (const f of files.filter((f) => f.endsWith('.html'))) {
  const text = readFileSync(f, 'utf8');
  assert.ok(
    text.includes('rel="canonical" href="' + expectedOrigin + '/'),
    `Wrong canonical: ${f}`,
  );
}
console.log(
  'Canonical, sitemap, robots and RSS origins verified:',
  expectedOrigin,
);
