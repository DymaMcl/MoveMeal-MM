import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';

const preferences = {
  location: 'home',
  level: 'moderate',
  days: [0, 2, 4],
  equipment: ['dumbbells'],
  sports: [],
  limitations: ['knees'],
  focus: ['arms'],
};

describe('Program de antrenament (e2e)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  const emails: string[] = [];

  async function userWithProfile(withProfile = true) {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'parola-sigura-1', healthDataConsent: true })
      .expect(201);
    const auth = `Bearer ${res.body.token}`;
    if (withProfile) {
      await request(app.getHttpServer())
        .put('/api/me/profile')
        .set('Authorization', auth)
        .send({
          name: 'Ion',
          age: 30,
          sex: 'male',
          heightCm: 178,
          weightKg: 80,
          activityLevel: 'light',
          goal: 'muscle',
        })
        .expect(200);
    }
    return { auth, id: res.body.user.id as string };
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
    await owner.query('delete from users where email = any($1)', [emails]);
    await owner.end();
    await app.close();
  });

  it('genereaza si salveaza programul pe baza preferintelor si a obiectivului', async () => {
    const { auth } = await userWithProfile();
    await request(app.getHttpServer())
      .get('/api/me/workout')
      .set('Authorization', auth)
      .expect(404);

    const saved = await request(app.getHttpServer())
      .put('/api/me/workout')
      .set('Authorization', auth)
      .send(preferences)
      .expect(200);
    expect(saved.body.plan.sessions).toHaveLength(3);
    // Obiectivul „masa musculara” din profil: 8-12 repetari la exercitiile compuse.
    expect(saved.body.plan.sessions[0].exercises[0].target).toBe('8-12');

    const loaded = await request(app.getHttpServer())
      .get('/api/me/workout')
      .set('Authorization', auth)
      .expect(200);
    expect(loaded.body.plan).toEqual(saved.body.plan);
    expect(loaded.body.preferences.limitations).toEqual(['knees']);
  });

  it('cere profilul completat inainte de program', async () => {
    const { auth } = await userWithProfile(false);
    await request(app.getHttpServer())
      .put('/api/me/workout')
      .set('Authorization', auth)
      .send(preferences)
      .expect(404);
  });

  it('respinge preferintele invalide', async () => {
    const { auth } = await userWithProfile();
    const send = (body: object) =>
      request(app.getHttpServer()).put('/api/me/workout').set('Authorization', auth).send(body);
    await send({ ...preferences, level: 'light', days: [0, 1, 2, 3, 4] }).expect(400);
    await send({ ...preferences, equipment: ['laser'] }).expect(400);
    await send({ ...preferences, focus: ['arms', 'legs', 'back'] }).expect(400);
    await send({ ...preferences, days: [0, 0, 2] }).expect(400);
  });

  it('marcheaza exercitiile efectuate si le poate anula', async () => {
    const { auth } = await userWithProfile();
    const put = (body: object) =>
      request(app.getHttpServer()).put('/api/me/workout/log').set('Authorization', auth).send(body);
    await put({ day: '2026-11-16', exerciseId: 'push_up', done: true }).expect(204);
    await put({ day: '2026-11-16', exerciseId: 'push_up', done: true }).expect(204);
    await put({ day: '2026-11-18', exerciseId: 'plank', done: true }).expect(204);
    await put({ day: '2026-11-18', exerciseId: 'necunoscut', done: true }).expect(400);

    const week = await request(app.getHttpServer())
      .get('/api/me/workout/log?from=2026-11-16&to=2026-11-22')
      .set('Authorization', auth)
      .expect(200);
    expect(week.body).toEqual([
      { day: '2026-11-16', exerciseId: 'push_up' },
      { day: '2026-11-18', exerciseId: 'plank' },
    ]);

    await put({ day: '2026-11-16', exerciseId: 'push_up', done: false }).expect(204);
    const after = await request(app.getHttpServer())
      .get('/api/me/workout/log?from=2026-11-16&to=2026-11-22')
      .set('Authorization', auth)
      .expect(200);
    expect(after.body).toEqual([{ day: '2026-11-18', exerciseId: 'plank' }]);
  });

  it('jurnalul si programul unui utilizator nu sunt vizibile altuia', async () => {
    const a = await userWithProfile();
    const b = await userWithProfile();
    await request(app.getHttpServer())
      .put('/api/me/workout')
      .set('Authorization', a.auth)
      .send(preferences)
      .expect(200);
    await request(app.getHttpServer())
      .put('/api/me/workout/log')
      .set('Authorization', a.auth)
      .send({ day: '2026-11-20', exerciseId: 'plank', done: true })
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/me/workout')
      .set('Authorization', b.auth)
      .expect(404);
    const logs = await request(app.getHttpServer())
      .get('/api/me/workout/log?from=2026-11-01&to=2026-11-30')
      .set('Authorization', b.auth)
      .expect(200);
    expect(logs.body).toEqual([]);

    const client = new pg.Client(dbConfig().app);
    await client.connect();
    try {
      await client.query('begin');
      await client.query(`select set_config('app.user_id', $1, true)`, [b.id]);
      expect((await client.query('select * from workout_programs')).rowCount).toBe(0);
      expect((await client.query('select * from workout_logs')).rowCount).toBe(0);
      await client.query('rollback');
    } finally {
      await client.end();
    }
  });
});
