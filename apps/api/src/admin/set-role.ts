import pg from 'pg';
import { dbConfig } from '../config.js';

/**
 * Stabileste rolul unui cont existent din linia de comanda (de exemplu primul administrator):
 *   npm run user:role --workspace=apps/api -- ana@exemplu.md admin
 * Ulterior, rolurile se gestioneaza din panoul administratorului.
 */
const [email, role] = process.argv.slice(2);
const ROLES = ['user', 'nutritionist', 'admin'];

if (!email || !ROLES.includes(role)) {
  console.error('Utilizare: npm run user:role -- <email> <user|nutritionist|admin>');
  process.exit(1);
}

const client = new pg.Client(dbConfig().owner);
await client.connect();
try {
  const { rows } = await client.query<{ id: string }>(
    'update users set role = $2 where email = $1 returning id',
    [email.trim().toLowerCase(), role],
  );
  if (!rows[0]) {
    console.error(`Nu exista un cont cu e-mailul ${email}.`);
    process.exitCode = 1;
  } else {
    if (role === 'nutritionist') {
      await client.query('begin');
      await client.query(`select set_config('app.user_id', $1, true)`, [rows[0].id]);
      await client.query(
        `insert into nutritionist_profiles (user_id, display_name) values ($1, $2)
         on conflict do nothing`,
        [rows[0].id, email.split('@')[0].slice(0, 80).padEnd(2, '_')],
      );
      await client.query('commit');
    }
    await client.query(
      `insert into admin_log (admin_id, action, target_user_id, details)
       values (null, 'role_changed', $1, $2)`,
      [rows[0].id, JSON.stringify({ to: role, source: 'cli' })],
    );
    console.log(`Rolul contului ${email} este acum „${role}”.`);
  }
} finally {
  await client.end();
}
