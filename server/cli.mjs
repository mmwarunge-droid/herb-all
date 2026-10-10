import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { transaction, row, closeDatabase } from './db.mjs';
import { id, token, hash, passwordHash, text, fail } from './core.mjs';
import { audit, expire } from './commerce.mjs';
import { importApprovedCatalogue } from './catalogue.mjs';
const [command, emailArg] = process.argv.slice(2);
try {
  if (command === 'catalogue:import') {
    const email = text(emailArg, 'administrator email', 254).toLowerCase();
    const result = await transaction((c) => importApprovedCatalogue(c, email));
    console.log(
      `Catalogue: ${result.created} drafts created; ${result.skipped} existing SKUs preserved. Stock remains unconfirmed; review in /admin/.`,
    );
  } else if (command === 'admin:create') {
    const rl = createInterface({ input: stdin, output: stdout });
    const email = text(
      emailArg || (await rl.question('Administrator email: ')),
      'email',
      254,
    ).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Check email.');
    rl.close();
    // Read password silently from the controlling terminal, never from arguments or logs.
    if (!stdin.isTTY) fail('Run provisioning in an interactive terminal.');
    stdout.write('New password (12+ characters): ');
    stdin.setRawMode(true);
    let password = '';
    await new Promise((resolve, reject) => {
      stdin.resume();
      const listener = (chunk) => {
        for (const ch of chunk.toString()) {
          if (ch === '\u0003') {
            stdin.off('data', listener);
            stdin.setRawMode(false);
            reject(new Error('Cancelled'));
            return;
          }
          if (ch === '\r' || ch === '\n') {
            stdin.off('data', listener);
            stdin.setRawMode(false);
            stdin.pause();
            stdout.write('\n');
            resolve();
            return;
          }
          if (ch === '\u007f') password = password.slice(0, -1);
          else password += ch;
        }
      };
      stdin.on('data', listener);
    });
    const digest = await passwordHash(password);
    password = '';
    await transaction(async (c) => {
      await c.query('SELECT pg_advisory_xact_lock(81324002)');
      if ((await row(c, 'SELECT count(*) n FROM administrators')).n !== '0')
        fail(
          'Initial administrator already exists; use the protected Accounts screen.',
        );
      const a = { id: id() };
      await c.query(
        "INSERT INTO administrators(id,email,password_hash,role) VALUES($1,$2,$3,'super')",
        [a.id, email, digest],
      );
      await audit(c, a, 'initial administrator provisioned', a.id);
    });
    console.log('Initial administrator created. Sign in at /admin/.');
  } else if (command === 'admin:recover') {
    const value = token();
    await transaction(async (c) => {
      const a = await row(
        c,
        'SELECT id FROM administrators WHERE email=$1 AND active',
        [text(emailArg, 'email', 254).toLowerCase()],
      );
      if (!a) fail('Active administrator not found.');
      await c.query(
        'UPDATE password_resets SET used_at=now() WHERE administrator_id=$1 AND used_at IS NULL',
        [a.id],
      );
      await c.query(
        "INSERT INTO password_resets(token_hash,administrator_id,expires_at) VALUES($1,$2,now()+interval '30 minutes')",
        [hash(value), a.id],
      );
      await audit(c, a, 'recovery issued', a.id);
    });
    console.log(
      'Private one-time recovery token (30-minute validity; deliver through a trusted channel):\n' +
        value,
    );
  } else if (command === 'reservations:expire') {
    console.log('Reviewed reservations:', await transaction(expire));
  } else
    fail(
      'Commands: admin:create [email], admin:recover <email>, catalogue:import <super-email>, reservations:expire',
    );
} catch (e) {
  console.error(
    e.status ? e.message : 'Operation failed. Check private configuration.',
  );
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
