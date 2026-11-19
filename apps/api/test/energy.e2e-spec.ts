import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /api/energy/plan calculeaza planul', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/energy/plan')
      .send({
        age: 22,
        sex: 'male',
        heightCm: 180,
        weightKg: 90,
        activityLevel: 'light',
        goal: 'lose',
        targetWeightKg: 80,
        weeks: 12,
      })
      .expect(200);
    expect(res.body.goalCheck.status).toBe('ok');
    expect(res.body.plan.targetCalories).toBeGreaterThan(1500);
  });

  it('POST /api/energy/plan respinge datele invalide', async () => {
    await request(app.getHttpServer())
      .post('/api/energy/plan')
      .send({ age: 5, sex: 'x', heightCm: 180, weightKg: 90, activityLevel: 'light', goal: 'lose' })
      .expect(400);
  });

  it('POST /api/energy/plan cere greutatea-tinta la slabire', async () => {
    await request(app.getHttpServer())
      .post('/api/energy/plan')
      .send({
        age: 22,
        sex: 'male',
        heightCm: 180,
        weightKg: 90,
        activityLevel: 'light',
        goal: 'lose',
      })
      .expect(400);
  });
});
