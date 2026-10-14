import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../dist/', import.meta.url).pathname;
const walk = (dir) =>
  readdirSync(dir).flatMap((n) =>
    statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)],
  );
const pages = walk(root).filter((f) => f.endsWith('.html'));
test('built metadata, headings, image alt text, JSON-LD and internal links', () => {
  const titles = new Set();
  const canonicals = new Set();
  assert.ok(pages.length > 30);
  for (const file of pages) {
    const html = readFileSync(file, 'utf8');
    const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
    assert.ok(title, file);
    assert.ok(!titles.has(title), `duplicate title ${title}`);
    titles.add(title);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, file);
    assert.match(html, /<meta name="description" content="[^"]+"/);
    assert.match(html, /<meta property="og:image"/);
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(canonical, file);
    assert.ok(!canonicals.has(canonical));
    canonicals.add(canonical);
    for (const match of html.matchAll(
      /(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g,
    )) {
      const path = match[1];
      assert.ok(
        existsSync(join(root, path)) ||
          existsSync(join(root, path, 'index.html')),
        `${file}: missing ${path}`,
      );
    }
    for (const match of html.matchAll(/<img\b[^>]*>/g))
      assert.match(match[0], /alt="[^"]+"/);
    for (const match of html.matchAll(
      /<script[^>]+type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs,
    )) {
      const data = JSON.parse(match[1]);
      assert.ok(data['@type']);
      assert.ok(!data.aggregateRating);
    }
    if (
      !file.endsWith('404.html') &&
      !file.endsWith('contact/thanks/index.html') &&
      !['admin', 'cart', 'checkout', 'order'].some((route) =>
        file.endsWith(route + '/index.html'),
      )
    )
      assert.ok(!html.includes('content="noindex"'));
  }
});
test('crawl assets, RSS, detail routes and no irrelevant template routes', () => {
  assert.match(readFileSync(join(root, 'robots.txt'), 'utf8'), /Allow: \//);
  assert.match(readFileSync(join(root, 'robots.txt'), 'utf8'), /sitemap\.xml/);
  assert.match(
    readFileSync(join(root, 'sitemap-index.xml'), 'utf8'),
    /sitemap-0\.xml/,
  );
  const sitemap = readFileSync(join(root, 'sitemap-0.xml'), 'utf8');
  assert.ok(!sitemap.includes('/404'));
  assert.match(readFileSync(join(root, 'rss.xml'), 'utf8'), /<item>/);
  for (const [kind, slug] of [
    ['products', 'moringa-tea'],
    ['seedlings', 'avocado'],
    ['learn', 'beginners-guide-to-moringa'],
  ])
    assert.ok(existsSync(join(root, kind, slug, 'index.html')));
  assert.ok(!existsSync(join(root, 'en')));
  assert.ok(!existsSync(join(root, 'api')));
});

test('supplied images preserve originals and ship only responsive derivatives', async () => {
  const { createHash } = await import('node:crypto');
  const sources = JSON.parse(
    readFileSync(
      new URL('../scripts/brand-image-sources.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(sources.length, 8);
  for (const source of sources) {
    const original = readFileSync(
      new URL('../assets/originals/' + source.original, import.meta.url),
    );
    assert.equal(
      createHash('sha256').update(original).digest('hex'),
      source.sha256,
    );
    for (const width of [480, 800, 1200])
      assert.ok(
        existsSync(join(root, 'images/brand', `${source.slug}-${width}.webp`)),
      );
  }
  assert.ok(!existsSync(join(root, 'assets/originals')));
  const gardens = readFileSync(join(root, 'gardens/index.html'), 'utf8');
  assert.match(gardens, /wheatgrass-1200.webp/);
  assert.match(gardens, /topic=Garden\+visit/);
});

test('all approved products have licensed or clearly generic local image mappings', () => {
  const inventory = JSON.parse(
    readFileSync(
      new URL('../src/config/temporary-product-images.json', import.meta.url),
    ),
  );
  const sources = JSON.parse(
    readFileSync(
      new URL('../scripts/temporary-image-sources.json', import.meta.url),
    ),
  );
  const catalogue = JSON.parse(
    readFileSync(new URL('../data/approved-seedlings.json', import.meta.url)),
  );
  for (const p of catalogue.products)
    assert.ok(inventory.images[inventory.mappings[p.sku]], p.sku);
  const referenced = new Set(
    Object.values(inventory.images).flatMap((image) =>
      image.variants.map((v) => v.src),
    ),
  );
  for (const file of readdirSync(
    new URL('../public/images/products/temporary/', import.meta.url),
  )) {
    assert.ok(
      referenced.has('/images/products/temporary/' + file),
      'Uncredited/unmapped asset ' + file,
    );
  }
  for (const [id, image] of Object.entries(inventory.images)) {
    assert.ok(existsSync(join(root, image.image)), id);
    assert.ok(image.imageAlt.length > 10, id);
    for (const v of image.variants) {
      assert.ok(existsSync(join(root, v.src)), v.src);
      assert.ok(v.width <= 1200);
    }
    if (sources[id]) {
      assert.match(
        sources[id].sourcePageUrl,
        /^https:\/\/commons\.wikimedia\.org\//,
      );
      assert.match(sources[id].license, /^(CC0|Public domain|CC BY)/);
      assert.match(sources[id].sha256, /^[a-f0-9]{64}$/);
      assert.ok(sources[id].creator);
      assert.ok(
        readFileSync(join(root, 'image-credits/index.html'), 'utf8').includes(
          `id="${id}"`,
        ),
      );
    }
  }
});
