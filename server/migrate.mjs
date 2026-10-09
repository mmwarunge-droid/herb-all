import { readFile, readdir } from 'node:fs/promises';
import { transaction, closeDatabase } from './db.mjs';
import { hash } from './core.mjs';
try {
  const applied = await transaction(async (c) => {
    const names = [];
    await c.query('SELECT pg_advisory_xact_lock(81324001)');
    await c.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const name of (
      await readdir(new URL('../migrations/', import.meta.url))
    )
      .filter((n) => n.endsWith('.sql'))
      .sort()) {
      const sql = await readFile(
        new URL('../migrations/' + name, import.meta.url),
        'utf8',
      );
      const old = (
        await c.query('SELECT checksum FROM schema_migrations WHERE name=$1', [
          name,
        ])
      ).rows[0];
      if (old) {
        if (old.checksum !== hash(sql))
          throw new Error('Applied migration checksum changed: ' + name);
        continue;
      }
      await c.query(sql);
      await c.query(
        'INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)',
        [name, hash(sql)],
      );
      names.push(name);
    }
    return names;
  });
  for (const name of applied) console.log('Applied', name);
} catch {
  console.error(
    'Migration failed. Check private configuration, database access and migration checksums. Inspect migration records before retrying.',
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
