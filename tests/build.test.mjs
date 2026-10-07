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
      !file.endsWith('contact/thanks/index.html')
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
