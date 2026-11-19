import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import { APP_DB_ROLE, dbConfig } from '../config.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname, '../../migrations');

/**
 * Creeaza rolul aplicatiei (daca lipseste) si aplica, in ordine, migrarile SQL noi.
 * Fiecare migrare ruleaza intr-o tranzactie separata.
 */
export async function migrate(log: (msg: string) => void = console.log): Promise<void> {
  const { owner, app } = dbConfig();
  const client = new pg.Client(owner);
  await client.connect();
  try {
    await client.query(
      `do $$ begin
         if not exists (select from pg_roles where rolname = '${APP_DB_ROLE}') then
           create role ${APP_DB_ROLE} login;
         end if;
       end $$`,
    );
    const { rows } = await client.query<{ q: string }>(
      `select format('alter role %I with login nosuperuser nobypassrls password %L', $1::text, $2::text) as q`,
      [APP_DB_ROLE, app.password],
    );
    await client.query(rows[0].q);

    await client.query(
      `create table if not exists schema_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    );
    const applied = new Set(
      (await client.query<{ name: string }>('select name from schema_migrations')).rows.map(
        (r) => r.name,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(resolve(MIGRATIONS_DIR, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (name) values ($1)', [file]);
        await client.query('commit');
        log(`Migrare aplicata: ${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

// Rulare directa: npm run db:migrate
if (process.argv[1] && import.meta.filename === resolve(process.argv[1])) {
  migrate()
    .then(() => console.log('Baza de date este la zi.'))
    .catch((error: unknown) => {
      console.error(error);
      process.exit(1);
    });
}
