import { readFile } from 'node:fs/promises';
import { row } from './db.mjs';
import { fail } from './core.mjs';
import { saveProduct } from './commerce.mjs';

// Explicit operator action only; never run from migrations or application startup.
export async function importApprovedCatalogue(c, email) {
  const admin = await row(
    c,
    'SELECT * FROM administrators WHERE email=$1 FOR UPDATE',
    [String(email).toLowerCase()],
  );
  if (!admin || admin.role !== 'super' || !admin.active)
    fail('An active Super administrator is required.', 403);
  await c.query('SELECT pg_advisory_xact_lock(81324003)');
  const catalogue = JSON.parse(
    await readFile(
      new URL('../data/approved-seedlings.json', import.meta.url),
      'utf8',
    ),
  );
  let created = 0,
    skipped = 0;
  for (const product of catalogue.products) {
    if (await row(c, 'SELECT id FROM products WHERE sku=$1', [product.sku])) {
      skipped++;
      continue;
    }
    await saveProduct(
      c,
      { ...product, published: false, unavailable: true },
      admin,
    );
    created++;
  }
  return { created, skipped };
}
