import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { dbConfig } from '../src/config.js';
import { MAX_FAILED_LOGINS } from '../src/auth/auth.service.js';
import { migrate } from '../src/database/migrate.js';

const PASSWORD = 'parola-sigura-1';
const newEmail = () => `test-${randomUUID()}@movemeal.test`;
const profile = {
  name: 'Ana',
  age: 28,
  sex: 'female',
  heightCm: 165,
  weightKg: 68,
  activityLevel: 'moderate',
  goal: 'lose',
  targetWeightKg: 62,
  weeks: 12,
};

describe('Conturi si profil (e2e)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  const createdEmails: string[] = [];

  async function register(email = newEmail()) {
    createdEmails.push(email);
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, healthDataConsent: true })
      .expect(201);
    return { email, token: res.body.token as string, id: res.body.user.id as string };
  }

  beforeAll(async () => {
    await migrate(() => undefined);
    owner = new pg.Client(dbConfig().owner);
    await owner.connect();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await owner.query('delete from users where email = any($1)', [createdEmails]);
    await owner.end();
    await app.close();
  });

  it('inregistreaza un cont si salveaza acordul', async () => {
    const { token } = await register();
    const me = await request(app.getHttpServer())
      .get('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body.healthDataConsent).toBe(true);
  });

  it('refuza inregistrarea fara acord si e-mailul duplicat', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: newEmail(), password: PASSWORD, healthDataConsent: false })
      .expect(400);
    const { email } = await register();
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: email.toUpperCase(), password: PASSWORD, healthDataConsent: true })
      .expect(409);
  });

  it('nu pastreaza parola in clar', async () => {
    const { email } = await register();
    const { rows } = await owner.query('select password_hash from users where email = $1', [email]);
    expect(rows[0].password_hash).toMatch(/^scrypt\$/);
    expect(rows[0].password_hash).not.toContain(PASSWORD);
  });

  it('autentifica, iar dupa iesire tokenul nu mai este valid', async () => {
    const { email } = await register();
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const auth = `Bearer ${login.body.token}`;
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Authorization', auth)
      .expect(204);
    await request(app.getHttpServer()).get('/api/me').set('Authorization', auth).expect(401);
  });

  it(`blocheaza contul dupa ${MAX_FAILED_LOGINS} incercari gresite`, async () => {
    const { email } = await register();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'parola-gresita' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(423);
  });

  it('cere autentificare pentru profil', async () => {
    await request(app.getHttpServer()).get('/api/me/profile').expect(401);
    await request(app.getHttpServer())
      .get('/api/me/profile')
      .set('Authorization', 'Bearer token-inventat')
      .expect(401);
  });

  it('salveaza profilul si returneaza planul caloric', async () => {
    const { token } = await register();
    const auth = `Bearer ${token}`;
    await request(app.getHttpServer())
      .get('/api/me/profile')
      .set('Authorization', auth)
      .expect(404);
    const saved = await request(app.getHttpServer())
      .put('/api/me/profile')
      .set('Authorization', auth)
      .send(profile)
      .expect(200);
    expect(saved.body.profile).toMatchObject({ name: 'Ana', weightKg: 68, targetWeightKg: 62 });
    expect(saved.body.plan.targetCalories).toBeGreaterThan(1200);

    const changed = await request(app.getHttpServer())
      .put('/api/me/profile')
      .set('Authorization', auth)
      .send({ ...profile, goal: 'maintain', targetWeightKg: undefined, weeks: undefined })
      .expect(200);
    expect(changed.body.profile.goal).toBe('maintain');
    expect(changed.body.profile.targetWeightKg).toBeUndefined();
  });

  it('fiecare utilizator vede doar profilul propriu (prin server)', async () => {
    const a = await register();
    const b = await register();
    await request(app.getHttpServer())
      .put('/api/me/profile')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ ...profile, name: 'Utilizator A' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get('/api/me/profile')
      .set('Authorization', `Bearer ${b.token}`)
      .expect(404);
    expect(JSON.stringify(res.body)).not.toContain('Utilizator A');
  });

  it('Row Level Security blocheaza accesul direct in baza de date', async () => {
    const a = await register();
    const b = await register();
    for (const u of [a, b]) {
      await request(app.getHttpServer())
        .put('/api/me/profile')
        .set('Authorization', `Bearer ${u.token}`)
        .send(profile)
        .expect(200);
    }

    const client = new pg.Client(dbConfig().app);
    await client.connect();
    try {
      // Fara utilizator curent: niciun rand.
      expect((await client.query('select user_id from profiles')).rowCount).toBe(0);

      await client.query('begin');
      await client.query(`select set_config('app.user_id', $1, true)`, [a.id]);
      const visible = await client.query<{ user_id: string }>('select user_id from profiles');
      expect(visible.rows.map((r) => r.user_id)).toEqual([a.id]);

      // Modificarea profilului altcuiva nu afecteaza niciun rand.
      const update = await client.query(`update profiles set name = 'Spart' where user_id = $1`, [
        b.id,
      ]);
      expect(update.rowCount).toBe(0);

      // Inserarea unui rand in numele altcuiva este respinsa.
      await expect(
        client.query(`insert into consents (user_id, kind) values ($1, 'health_data')`, [b.id]),
      ).rejects.toThrow(/row-level security/);
      await client.query('rollback');

      // Rolul aplicatiei nu are acces la tabelele de autentificare.
      await expect(client.query('select * from users')).rejects.toThrow(/permission denied/);
    } finally {
      await client.end();
    }
  });
});
