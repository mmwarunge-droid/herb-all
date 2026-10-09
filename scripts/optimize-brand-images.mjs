import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const sources = JSON.parse(
  await readFile(new URL('brand-image-sources.json', import.meta.url), 'utf8'),
);
await mkdir(new URL('public/images/brand/', root), { recursive: true });
const manifest = {};
for (const item of sources) {
  const original = new URL(`assets/originals/${item.original}`, root);
  const bytes = await readFile(original);
  if (createHash('sha256').update(bytes).digest('hex') !== item.sha256)
    throw new Error(
      `Original changed: ${item.original}; review and update its provenance before generating derivatives.`,
    );
  const metadata = await sharp(bytes).metadata();
  const sizes = [];
  for (const width of [480, 800, 1200]) {
    const filename = `${item.slug}-${width}.webp`;
    const info = await sharp(bytes)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(new URL(`public/images/brand/${filename}`, root).pathname);
    sizes.push({
      src: `/images/brand/${filename}`,
      width: info.width,
      height: info.height,
      bytes: info.size,
    });
  }
  manifest[sizes.at(-1).src] = {
    original: item.original,
    width: sizes.at(-1).width,
    height: sizes.at(-1).height,
    variants: sizes,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
  };
}
await writeFile(
  new URL('src/config/brand-images.json', root),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `Generated three full-frame WebP sizes for ${sources.length} supplied images; originals unchanged.`,
);
