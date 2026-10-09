import pg from 'pg';
let pool;
export function database() {
  if (!process.env.DATABASE_URL)
    throw Object.assign(
      new Error(
        'Shop configuration is not available yet. Please enquire directly.',
      ),
      { status: 503 },
    );
  const local = ['127.0.0.1', 'localhost'].includes(
    new URL(process.env.DATABASE_URL).hostname,
  );
  if (
    !local &&
    process.env.APP_ENV !== 'development' &&
    process.env.DATABASE_SSL !== 'true'
  )
    throw Object.assign(
      new Error('Secure database connectivity is not configured.'),
      { status: 503 },
    );
  if (
    !local &&
    ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) =>
      new URL(process.env.DATABASE_URL).searchParams.has(key),
    )
  )
    throw Object.assign(
      new Error(
        'Configure TLS with DATABASE_SSL instead of connection URL SSL flags.',
      ),
      { status: 503 },
    );
  return (pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : undefined,
  }));
}
export async function transaction(fn) {
  const c = await database().connect();
  try {
    await c.query('BEGIN');
    await c.query("SET LOCAL statement_timeout='10s'");
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
export const row = async (c, q, v = []) => (await c.query(q, v)).rows[0];
