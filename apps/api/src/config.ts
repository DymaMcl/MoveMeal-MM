import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Incarca fisierul .env din radacina proiectului (daca exista) o singura data. */
let loaded = false;
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  for (const candidate of [resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Lipseste variabila de mediu ${name} (vezi .env.example)`);
  return value;
}

/** Rolul cu care ruleaza aplicatia; nu este proprietarul tabelelor, deci respecta RLS. */
export const APP_DB_ROLE = 'movemeal_app';

export function dbConfig() {
  loadEnv();
  const host = process.env.DB_HOST ?? 'localhost';
  const port = Number(process.env.DB_PORT ?? 5432);
  const database = process.env.POSTGRES_DB ?? 'movemeal';
  return {
    owner: {
      host,
      port,
      database,
      user: process.env.POSTGRES_USER ?? 'movemeal',
      password: required('POSTGRES_PASSWORD'),
    },
    app: {
      host,
      port,
      database,
      user: APP_DB_ROLE,
      password: required('APP_DB_PASSWORD'),
    },
  };
}
