import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const sources = JSON.parse(
  await fs.readFile(
    new URL('scripts/temporary-image-sources.json', root),
    'utf8',
  ),
);
const manifest = JSON.parse(
  await fs.readFile(
    new URL('src/config/temporary-product-images.json', root),
    'utf8',
  ),
);
const cache = path.join(os.tmpdir(), 'herb-all-licensed-source-images');
await fs.mkdir(cache, { recursive: true });
const out = new URL('public/images/products/temporary/', root);
await fs.mkdir(out, { recursive: true });
async function optimize(id, source) {
  let buffer;
  const file = path.join(cache, id + '.source');
  try {
    buffer = await fs.readFile(file);
  } catch {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(source.downloadUrl || source.sourceImageUrl, {
          signal: AbortSignal.timeout(30000),
          headers: {
            'User-Agent':
              'HerbAll-ImageAudit/1.0 (https://herb-all.netlify.app/contact/)',
          },
        });
        if (!r.ok) throw Error('Download status ' + r.status);
        buffer = Buffer.from(await r.arrayBuffer());
        if (buffer.length > 20000000) throw Error('Source too large');
        await fs.writeFile(file, buffer);
        break;
      } catch (e) {
        if (attempt === 2) throw e;
      }
    }
  }
  const checksum = createHash('sha256').update(buffer).digest('hex');
  if (source.sha256 && source.sha256 !== checksum)
    throw Error(
      'Source changed; review license/identity before updating ' + id,
    );
  source.sha256 = checksum;
  const meta = await sharp(buffer).metadata();
  const widths = [480, 800, 1200].filter((w) => w < meta.width);
  widths.push(Math.min(1200, meta.width));
  const variants = [];
  for (const name of await fs.readdir(out)) {
    if (name.startsWith(id + '-') && name.endsWith('.webp'))
      await fs.unlink(new URL(name, out));
  }
  for (const width of [...new Set(widths)]) {
    const name = `${id}-${width}.webp`;
    const r = await sharp(buffer)
      .rotate()
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 76, effort: 5 })
      .toFile(fileURLToPath(new URL(name, out)));
    variants.push({
      src: '/images/products/temporary/' + name,
      width: r.width,
      height: r.height,
      bytes: r.size,
    });
  }
  const largest = variants.at(-1);
  manifest.images[id] = {
    image: largest.src,
    imageAlt: `Representative ${source.label.toLowerCase()} photograph; not current Herb-All stock or an exact cultivar.`,
    width: largest.width,
    height: largest.height,
    variants,
    imageCredit: source.creator,
    imageSourceUrl: source.sourcePageUrl,
    imageLicense: source.license,
    licenseUrl: source.licenseUrl,
    isTemporaryImage: true,
    label: source.label,
  };
  console.log(id + ': ' + variants.reduce((s, v) => s + v.bytes, 0) + ' bytes');
}
const entries = Object.entries(sources);
for (let n = 0; n < entries.length; n += 3)
  await Promise.all(entries.slice(n, n + 3).map(([id, s]) => optimize(id, s)));
const brand = JSON.parse(
  await fs.readFile(new URL('src/config/brand-images.json', root), 'utf8'),
);
for (const [id, src, label] of [
  [
    'owned-moringa',
    '/images/brand/moringa-seedlings-1200.webp',
    'Moringa seedlings',
  ],
  [
    'orchard',
    '/images/brand/garden-plants-1200.webp',
    'Generic garden planting',
  ],
]) {
  const b = brand[src];
  manifest.images[id] = {
    image: src,
    imageAlt:
      id === 'orchard'
        ? 'Generic garden plants — graft combination not depicted.'
        : 'Moringa seedlings photographed by Herb-All.',
    width: b.width,
    height: b.height,
    variants: b.variants,
    imageCredit: 'Herb-All',
    imageSourceUrl: '/gardens/',
    imageLicense: 'Herb-All supplied photograph',
    licenseUrl: '/image-credits/',
    isTemporaryImage: id === 'orchard',
    label,
  };
}
await fs.writeFile(
  new URL('scripts/temporary-image-sources.json', root),
  JSON.stringify(sources, null, 2) + '\n',
);
await fs.writeFile(
  new URL('src/config/temporary-product-images.json', root),
  JSON.stringify(manifest, null, 2) + '\n',
);
