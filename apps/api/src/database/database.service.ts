import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';
import { dbConfig } from '../config.js';

// Valorile numeric/decimal sunt returnate ca numere (precizia de 1 zecimala este suficienta).
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (value) => Number(value));

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  /** Conexiuni cu rolul proprietar – doar pentru autentificare (users, sessions). */
  readonly auth: pg.Pool;
  /** Conexiuni cu rolul aplicatiei – datele personale, protejate prin Row Level Security. */
  private readonly app: pg.Pool;

  constructor() {
    const config = dbConfig();
    this.auth = new pg.Pool({ ...config.owner, max: 5 });
    this.app = new pg.Pool({ ...config.app, max: 10 });
  }

  /**
   * Executa operatiile in contextul utilizatorului dat: baza de date returneaza
   * si accepta doar randurile acestuia (politicile RLS folosesc app.user_id).
   */
  async asUser<T>(userId: string, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.app.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('app.user_id', $1, true)`, [userId]);
      const result = await work(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.auth.end(), this.app.end()]);
  }
}
