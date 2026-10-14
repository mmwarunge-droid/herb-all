import fs from 'node:fs/promises';
import prettier from 'prettier';
const sources = JSON.parse(
  await fs.readFile(
    new URL('temporary-image-sources.json', import.meta.url),
    'utf8',
  ),
);
const inventory = JSON.parse(
  await fs.readFile(
    new URL('../src/config/temporary-product-images.json', import.meta.url),
    'utf8',
  ),
);
const products = JSON.parse(
  await fs.readFile(
    new URL('../data/approved-seedlings.json', import.meta.url),
    'utf8',
  ),
).products;
const clean = (s) => String(s).replaceAll('|', '\\|').replaceAll('\n', ' ');
const sourceRows = Object.entries(sources)
  .map(
    ([id, s]) =>
      `| ${id} | [${clean(s.title)}](${s.sourcePageUrl}) / [image](${s.sourceImageUrl}) | ${clean(s.creator)} | [${s.license}](${s.licenseUrl}) | ${s.attributionRequired ? 'Yes' : 'No'} | ${s.checkedOn} | ${inventory.images[id].variants.map((v) => '`' + v.src + '`').join('<br>')} |`,
  )
  .join('\n');
const names = {
  ...Object.fromEntries(products.map((p) => [p.sku, p.name])),
  ...Object.fromEntries(
    Object.keys(inventory.mappings)
      .filter((k) => k.includes('/'))
      .map((k) => [k, k]),
  ),
};
const mappingRows = Object.entries(inventory.mappings)
  .map(
    ([key, id]) =>
      `| ${clean(names[key])} | \`${key}\` | ${id} | ${id === 'orchard' ? 'Generic garden: graft identity/photo pending' : id === 'owned-moringa' ? 'Existing Herb-All photograph' : 'Temporary representative photo; not exact cultivar/stock'} |`,
  )
  .join('\n');
const doc = `# Temporary product image inventory

Latest source check: ${Object.values(sources)
  .map((s) => s.checkedOn)
  .sort()
  .at(
    -1,
  )} (individual dates below). This is presentation metadata only: no database fields, publication, stock, price, checkout or payment settings are changed. All 63 imported SKUs have a mapping, plus the 12 existing public product/seedling profiles. Existing database-uploaded product photos take precedence; the supplied moringa seedling photo is retained. Apple-to-Loquat uses an explicitly generic supplied garden image until its graft combination is verified. Gooseberry means Cape gooseberry (Physalis peruviana), confirmed by the owner.

## Reuse and attribution

All 48 external photos come from Wikimedia Commons file pages with explicit CC0, public-domain, CC BY or CC BY-SA reuse terms. The table below links each source and license; required attribution is visible at [/image-credits/](/image-credits/) and linked from every representative-image caption. Public-domain/CC0 authors are also credited when known. Re-encoded/resized derivatives retain each image's source license; presentation cropping is disclosed. ShareAlike applies to those image derivatives, not the surrounding code. Wikimedia logos, uploader identity and file-page descriptions are not claims of endorsement.

No third-party hotlinks render in product pages. Local WebP variants are at 480, 800 and up to 1200px (no upscaling). Originals are cached outside the repository for optimization and are not shipped. Source SHA-256 hashes pin downloads in scripts/temporary-image-sources.json; update them only after reviewing replacement provenance. Species/plant or fruit/ingredient references are explicitly representative, not nursery stock, grafting evidence, promised fruit colours or cultivar identity. No exact cultivar match is claimed.

## Image sources and local derivatives

Intended use for every entry: temporary representative plant/fruit or ingredient photography on corresponding cards and detail pages. Changes: resized/re-encoded WebP, possible display crop.

| Image ID | Source page / original URL | Creator | License | Attribution required | Date checked | Local variants |
| --- | --- | --- | --- | --- | --- | --- |
${sourceRows}

## Product and profile mapping

| Product/profile | Mapping key | Image ID | Correspondence |
| --- | --- | --- | --- |
${mappingRows}

## Replacement workflow

1. Administrators: upload an authorized Herb-All product photo through Products & stock. Existing uploaded API media automatically wins over this temporary map; do not publish or change stock merely to replace a photo.
2. Developers: optimize owned photos in the existing image structure, update the applicable mapping/metadata in src/config/temporary-product-images.json (image, alt, dimensions, variants, credit/source/license and isTemporaryImage=false). For static profiles, a supplied /images/brand/ image in frontmatter takes precedence.
3. Remove the representative note only once actual product correspondence is confirmed. Preserve the old credits while any old licensed derivative remains in use; remove unreferenced assets and entries together when replacing them completely.
4. To regenerate external variants and documentation: run npm run images:temporary. Downloads require network access. Review source/checksum changes; never accept a changed source blindly.
5. Run check/build/test and browser image/fallback checks. Verify all src/srcset assets, alt text and credits, and ensure commerce launch gates remain unchanged.

New/unmapped products receive a botanical placeholder with their own name. A failed image hides the broken image and reveals that placeholder; it does not show another species as the product.
`;
await fs.writeFile(
  new URL('../docs/TEMPORARY_PRODUCT_IMAGES.md', import.meta.url),
  await prettier.format(doc, { parser: 'markdown' }),
);
