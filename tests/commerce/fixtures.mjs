import { database, transaction } from '../../server/db.mjs';
import { id, passwordHash, token } from '../../server/core.mjs';
import { saveProduct, adjustStock } from '../../server/commerce.mjs';
export async function reset() {
  if (!/herb_all_test$/.test(process.env.DATABASE_URL || ''))
    throw new Error('Tests require an isolated herb_all_test database.');
  await database().query(
    'TRUNCATE administrators,categories,products,media,orders,rate_limits,audit_events,notification_outbox RESTART IDENTITY CASCADE',
  );
  await database().query("UPDATE settings SET data='{}' WHERE id=1");
}
export async function fixtureAdmin(role = 'super') {
  const password = token();
  const admin = { id: id(), email: id() + '@example.test', role, password };
  await database().query(
    'INSERT INTO administrators(id,email,password_hash,role) VALUES($1,$2,$3,$4)',
    [admin.id, admin.email, await passwordHash(password), role],
  );
  return admin;
}
export async function fixtureProduct(
  admin,
  name = 'Avocado seedlings',
  price = '150',
  stock = 20,
) {
  return transaction(async (c) => {
    const p = await saveProduct(
      c,
      {
        name,
        slug: name.toLowerCase().replaceAll(' ', '-') + '-' + id().slice(0, 6),
        sku: id(),
        category: 'Test seedlings',
        unit: 'seedling',
        price,
        published: true,
        min_quantity: 1,
        max_quantity: 100,
      },
      admin,
    );
    await adjustStock(
      c,
      { product_id: p.id, stock, reason: 'Isolated test fixture' },
      admin,
    );
    return p;
  });
}
export function basket(items) {
  return {
    items,
    name: 'Test Customer',
    phone: '0712345678',
    email: '',
    delivery_method: 'delivery',
    county: 'Test county',
    town: 'Test town',
    estate: 'Test estate',
    address: 'Test landmark',
  };
}
