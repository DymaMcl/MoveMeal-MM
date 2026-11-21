import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { todayIso } from '../src/common/dates.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';

describe('Abordarea slabirii, activitati si post intermitent (e2e)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  const emails: string[] = [];
  const http = () => request(app.getHttpServer());

  const loseProfile = {
    name: 'Test',
    age: 30,
    sex: 'male',
    heightCm: 180,
    weightKg: 80,
    activityLevel: 'moderate',
    goal: 'lose',
    targetWeightKg: 75,
    weeks: 10,
  };

  async function account(profile: Record<string, unknown> = loseProfile) {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: 'parola-sigura-1', healthDataConsent: true })
      .expect(201);
    const auth = `Bearer ${res.body.token}`;
    const saved = await http().put('/api/me/profile').set('Authorization', auth).send(profile);
    expect(saved.status).toBe(200);
    return { auth, saved: saved.body };
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

  it('salveaza abordarea slabirii si imparte deficitul intre alimentatie si exercitii', async () => {
    const diet = await account({ ...loseProfile, lossApproach: 'diet' });
    const mixed = await account({ ...loseProfile, lossApproach: 'mixed' });
    const exercise = await account({ ...loseProfile, lossApproach: 'exercise' });

    expect(diet.saved.profile.lossApproach).toBe('diet');
    expect(diet.saved.plan.exerciseKcal).toBe(0);
    expect(mixed.saved.plan.exerciseKcal).toBeGreaterThan(0);
    expect(exercise.saved.plan.exerciseKcal).toBeGreaterThan(mixed.saved.plan.exerciseKcal);
    // Cu cat mai mult vine din miscare, cu atat se poate manca mai mult.
    expect(exercise.saved.plan.targetCalories).toBeGreaterThan(mixed.saved.plan.targetCalories);
    expect(mixed.saved.plan.targetCalories).toBeGreaterThan(diet.saved.plan.targetCalories);

    // La alt obiectiv abordarea nu se pastreaza.
    const res = await http()
      .put('/api/me/profile')
      .set('Authorization', exercise.auth)
      .send({ ...loseProfile, goal: 'maintain', lossApproach: 'exercise' })
      .expect(200);
    expect(res.body.profile.lossApproach).toBeUndefined();
    expect(res.body.plan.exerciseKcal).toBe(0);
  });

  it('schimba doar abordarea, pastrand tinta stabilita de nutritionist', async () => {
    const { auth, saved } = await account({ ...loseProfile, lossApproach: 'diet' });
    const changed = await http()
      .put('/api/me/profile/loss-approach')
      .set('Authorization', auth)
      .send({ lossApproach: 'exercise' })
      .expect(200);
    expect(changed.body.profile.lossApproach).toBe('exercise');
    expect(changed.body.plan.exerciseKcal).toBeGreaterThan(0);
    expect(changed.body.plan.targetCalories).toBeGreaterThan(saved.plan.targetCalories);

    await owner.query(
      `update profiles set calorie_target = 1900, calorie_target_by = 'nutritionist'
       where user_id = (select id from users where email = $1)`,
      [emails.at(-1)],
    );
    const kept = await http()
      .put('/api/me/profile/loss-approach')
      .set('Authorization', auth)
      .send({ lossApproach: 'mixed' })
      .expect(200);
    expect(kept.body.plan.targetCalories).toBe(1900);
    expect(kept.body.adjustedBy).toBe('nutritionist');

    const other = await account({ ...loseProfile, goal: 'maintain' });
    await http()
      .put('/api/me/profile/loss-approach')
      .set('Authorization', other.auth)
      .send({ lossApproach: 'mixed' })
      .expect(400);
  });

  it('respinge o abordare necunoscuta', async () => {
    const { auth } = await account();
    await http()
      .put('/api/me/profile')
      .set('Authorization', auth)
      .send({ ...loseProfile, lossApproach: 'pills' })
      .expect(400);
  });

  it('inregistreaza activitati si calculeaza arderea zilei', async () => {
    const { auth } = await account({ ...loseProfile, lossApproach: 'mixed' });
    const day = todayIso();
    const added = await http()
      .post('/api/me/activity')
      .set('Authorization', auth)
      .send({ day, activityId: 'running', minutes: 30 })
      .expect(201);
    // (8.3 - 1) * 80 kg * 0.5 h = 292 kcal nete
    expect(added.body.entry.kcal).toBe(292);

    await http()
      .post('/api/me/activity')
      .set('Authorization', auth)
      .send({ day, activityId: 'cycling', minutes: 40, kcal: 350 })
      .expect(201);
    await http()
      .put('/api/me/steps')
      .set('Authorization', auth)
      .send({ day, steps: 9000, source: 'manual' })
      .expect(200);

    const summary = await http().get('/api/me/activity').set('Authorization', auth).expect(200);
    expect(summary.body.items).toHaveLength(2);
    expect(summary.body.stepsKcal).toBe(160);
    expect(summary.body.totalKcal).toBe(292 + 350 + 160);
    expect(summary.body.goalKcal).toBeGreaterThan(0);
    expect(summary.body.lossApproach).toBe('mixed');
    expect(summary.body.week).toHaveLength(7);
    expect(summary.body.week[6]).toEqual({ day, kcal: 802 });

    await http()
      .delete(`/api/me/activity/${added.body.entry.id}`)
      .set('Authorization', auth)
      .expect(204);
    const after = await http().get('/api/me/activity').set('Authorization', auth).expect(200);
    expect(after.body.totalKcal).toBe(350 + 160);
  });

  it('respinge activitatile necunoscute sau prea vechi', async () => {
    const { auth } = await account();
    await http()
      .post('/api/me/activity')
      .set('Authorization', auth)
      .send({ day: todayIso(), activityId: 'teleport', minutes: 30 })
      .expect(400);
    await http()
      .post('/api/me/activity')
      .set('Authorization', auth)
      .send({ day: '2020-01-01', activityId: 'walking', minutes: 30 })
      .expect(400);
  });

  it('porneste si opreste un post, cu un singur post activ', async () => {
    const { auth } = await account();
    const startedAt = new Date(Date.now() - 17 * 3_600_000).toISOString();
    const started = await http()
      .post('/api/me/fasting/start')
      .set('Authorization', auth)
      .send({ planId: '16_8', startedAt })
      .expect(201);
    expect(started.body.plannedHours).toBe(16);

    await http()
      .post('/api/me/fasting/start')
      .set('Authorization', auth)
      .send({ planId: '14_10' })
      .expect(409);

    const state = await http().get('/api/me/fasting').set('Authorization', auth).expect(200);
    expect(state.body.active.id).toBe(started.body.id);
    expect(state.body.block).toBeNull();

    const stopped = await http()
      .post('/api/me/fasting/stop')
      .set('Authorization', auth)
      .expect(200);
    expect(stopped.body.session.completed).toBe(true);

    const after = await http().get('/api/me/fasting').set('Authorization', auth).expect(200);
    expect(after.body.active).toBeNull();
    expect(after.body.stats.completed).toBe(1);
    expect(after.body.stats.longestHours).toBeGreaterThanOrEqual(17);
    await http().post('/api/me/fasting/stop').set('Authorization', auth).expect(404);
  });

  it('nu permite postul minorilor', async () => {
    const { auth } = await account({ ...loseProfile, age: 16 });
    const state = await http().get('/api/me/fasting').set('Authorization', auth).expect(200);
    expect(state.body.block).toBe('minor');
    await http()
      .post('/api/me/fasting/start')
      .set('Authorization', auth)
      .send({ planId: '12_12' })
      .expect(422);
  });
});
