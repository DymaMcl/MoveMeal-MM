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

const PASSWORD = 'parola-sigura-1';
const ALL_WEEK = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  start: '08:00',
  end: '20:00',
}));

describe('Roluri, programari la nutritionist si administrare (e2e)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  const emails: string[] = [];
  const http = () => request(app.getHttpServer());

  interface Account {
    id: string;
    email: string;
    auth: string;
  }

  async function account(
    role: 'user' | 'nutritionist' | 'admin' = 'user',
    name?: string,
  ): Promise<Account> {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, healthDataConsent: true })
      .expect(201);
    const auth = `Bearer ${res.body.token}`;
    if (role !== 'user') {
      await owner.query('update users set role = $2 where id = $1', [res.body.user.id, role]);
    }
    if (name) {
      await http()
        .put('/api/me/profile')
        .set('Authorization', auth)
        .send({
          name,
          age: 30,
          sex: 'female',
          heightCm: 165,
          weightKg: 70,
          activityLevel: 'moderate',
          goal: 'maintain',
        })
        .expect(200);
    }
    return { id: res.body.user.id, email, auth };
  }

  async function nutritionist() {
    const n = await account('nutritionist');
    await http().get('/api/nutritionist/profile').set('Authorization', n.auth).expect(200);
    await http()
      .put('/api/nutritionist/schedule/hours')
      .set('Authorization', n.auth)
      .send({ hours: ALL_WEEK })
      .expect(200);
    return n;
  }

  async function firstSlot(user: Account, nutritionistId: string, index = 0) {
    const res = await http()
      .get(`/api/nutritionists/${nutritionistId}/slots`)
      .set('Authorization', user.auth)
      .expect(200);
    expect(res.body.length).toBeGreaterThan(index);
    return res.body[index].startsAt as string;
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

  it('verifica rolul pe server pentru panourile nutritionistului si administratorului', async () => {
    const user = await account();
    await http().get('/api/nutritionist/appointments').set('Authorization', user.auth).expect(403);
    await http().get('/api/admin/stats').set('Authorization', user.auth).expect(403);
    const n = await account('nutritionist');
    await http().get('/api/admin/users').set('Authorization', n.auth).expect(403);
    const me = await http().get('/api/me').set('Authorization', n.auth).expect(200);
    expect(me.body.role).toBe('nutritionist');
  });

  it('programeaza prima consultatie gratuita, o confirma si notifica ambele parti', async () => {
    const n = await nutritionist();
    await http()
      .put('/api/nutritionist/profile')
      .set('Authorization', n.auth)
      .send({
        displayName: 'Dr. Maria Test',
        title: 'Nutritionist licentiat',
        bio: 'Bio',
        qualifications: 'Licenta in nutritie',
        experienceYears: 5,
        services: 'Consultatie initiala',
        priceMdl: 400,
        slotMinutes: 45,
      })
      .expect(200);
    const user = await account('user', 'Ion');

    const list = await http().get('/api/nutritionists').set('Authorization', user.auth).expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toContain(n.id);

    const offer = await http()
      .get('/api/me/consultation-offer')
      .set('Authorization', user.auth)
      .expect(200);
    expect(offer.body.eligible).toBe(true);

    const startsAt = await firstSlot(user, n.id);
    const booked = await http()
      .post('/api/me/appointments')
      .set('Authorization', user.auth)
      .send({ nutritionistId: n.id, startsAt, note: 'Vreau sa slabesc', shareData: false })
      .expect(201);
    expect(booked.body).toMatchObject({ status: 'requested', free: true, clientName: 'Ion' });

    // Intervalul ocupat nu mai apare liber, iar a doua programare activa este refuzata.
    const after = await http()
      .get(`/api/nutritionists/${n.id}/slots`)
      .set('Authorization', user.auth)
      .expect(200);
    expect(after.body.map((s: { startsAt: string }) => s.startsAt)).not.toContain(startsAt);
    await http()
      .post('/api/me/appointments')
      .set('Authorization', user.auth)
      .send({ nutritionistId: n.id, startsAt: after.body[0].startsAt })
      .expect(409);

    const offerUsed = await http()
      .get('/api/me/consultation-offer')
      .set('Authorization', user.auth)
      .expect(200);
    expect(offerUsed.body).toMatchObject({ used: true, eligible: false });

    const inbox = await http()
      .get('/api/me/notifications')
      .set('Authorization', n.auth)
      .expect(200);
    expect(inbox.body.items[0].kind).toBe('appointment_requested');

    const panel = await http()
      .get('/api/nutritionist/appointments')
      .set('Authorization', n.auth)
      .expect(200);
    expect(panel.body).toHaveLength(1);
    expect(panel.body[0].userNote).toBe('Vreau sa slabesc');

    await http()
      .post(`/api/nutritionist/appointments/${booked.body.id}/confirm`)
      .set('Authorization', n.auth)
      .send({ note: 'Te astept' })
      .expect(201);
    const mine = await http()
      .get('/api/me/appointments')
      .set('Authorization', user.auth)
      .expect(200);
    expect(mine.body[0]).toMatchObject({ status: 'confirmed', nutritionistName: 'Dr. Maria Test' });
    const userInbox = await http()
      .get('/api/me/notifications')
      .set('Authorization', user.auth)
      .expect(200);
    expect(userInbox.body.items[0].kind).toBe('appointment_confirmed');
    expect(userInbox.body.unread).toBe(1);

    // Reprogramare de catre nutritionist, apoi anulare de catre utilizator.
    const slots = await http()
      .get('/api/nutritionist/slots')
      .set('Authorization', n.auth)
      .expect(200);
    const moved = await http()
      .post(`/api/nutritionist/appointments/${booked.body.id}/reschedule`)
      .set('Authorization', n.auth)
      .send({ startsAt: slots.body[2].startsAt })
      .expect(201);
    expect(moved.body.startsAt).toBe(slots.body[2].startsAt);
    await http()
      .post(`/api/me/appointments/${booked.body.id}/cancel`)
      .set('Authorization', user.auth)
      .expect(201);
    const offerBack = await http()
      .get('/api/me/consultation-offer')
      .set('Authorization', user.auth)
      .expect(200);
    expect(offerBack.body.eligible).toBe(true);
  });

  it('nutritionistul vede si ajusteaza planul doar cu acordul clientului', async () => {
    const n = await nutritionist();
    await http()
      .put('/api/me/profile')
      .set('Authorization', n.auth)
      .send({
        name: 'Maria',
        age: 35,
        sex: 'female',
        heightCm: 170,
        weightKg: 60,
        activityLevel: 'light',
        goal: 'maintain',
      })
      .expect(200);
    const client = await account('user', 'Elena');
    await http()
      .put('/api/me/nutrition/preferences')
      .set('Authorization', client.auth)
      .send({
        diet: 'omnivore',
        allergens: [],
        excludedFoods: [],
        preferredFoods: [],
        budget: 'balanced',
        mealsPerDay: 4,
      })
      .expect(200);
    const stranger = await account('user', 'Vasile');

    await http()
      .get(`/api/nutritionist/clients/${client.id}`)
      .set('Authorization', n.auth)
      .expect(404);

    await http()
      .put(`/api/me/nutritionist-access/${n.id}`)
      .set('Authorization', client.auth)
      .send({ granted: true })
      .expect(200);

    const clients = await http()
      .get('/api/nutritionist/clients')
      .set('Authorization', n.auth)
      .expect(200);
    expect(clients.body.map((c: { id: string }) => c.id)).toEqual([client.id]);

    const detail = await http()
      .get(`/api/nutritionist/clients/${client.id}`)
      .set('Authorization', n.auth)
      .expect(200);
    expect(detail.body.profile.name).toBe('Elena');
    expect(detail.body.mealPlan).toBeTruthy();

    // Datele altui utilizator, fara acord, raman inaccesibile.
    await http()
      .get(`/api/nutritionist/clients/${stranger.id}`)
      .set('Authorization', n.auth)
      .expect(404);
    // Propriul profil al nutritionistului nu se amesteca cu al clientilor.
    const own = await http().get('/api/me/profile').set('Authorization', n.auth).expect(200);
    expect(own.body.profile.name).toBe('Maria');

    await http()
      .put(`/api/nutritionist/clients/${client.id}/adjustment`)
      .set('Authorization', n.auth)
      .send({ calorieTarget: 1000, note: 'prea putin' })
      .expect(400);
    await http()
      .put(`/api/nutritionist/clients/${client.id}/adjustment`)
      .set('Authorization', n.auth)
      .send({ calorieTarget: 1850, note: 'Mai multe legume la cina.' })
      .expect(200);

    const profile = await http()
      .get('/api/me/profile')
      .set('Authorization', client.auth)
      .expect(200);
    expect(profile.body).toMatchObject({
      adjusted: true,
      adjustedBy: 'nutritionist',
      nutritionistNote: 'Mai multe legume la cina.',
    });
    expect(profile.body.plan.targetCalories).toBe(1850);
    const program = await http()
      .get('/api/me/nutrition')
      .set('Authorization', client.auth)
      .expect(200);
    expect(program.body.adjustedByNutritionistAt).toBeTruthy();
    expect(program.body.plan.targetKcal).toBe(1850);

    await http()
      .put(`/api/me/nutritionist-access/${n.id}`)
      .set('Authorization', client.auth)
      .send({ granted: false })
      .expect(200);
    await http()
      .get(`/api/nutritionist/clients/${client.id}`)
      .set('Authorization', n.auth)
      .expect(404);
    await http()
      .put(`/api/nutritionist/clients/${client.id}/adjustment`)
      .set('Authorization', n.auth)
      .send({ calorieTarget: 2000, note: '' })
      .expect(404);
  });

  it('administratorul schimba roluri, blocheaza conturi si modifica parametrii', async () => {
    const admin = await account('admin');
    const target = await account();

    const users = await http()
      .get(`/api/admin/users?q=${encodeURIComponent(target.email)}`)
      .set('Authorization', admin.auth)
      .expect(200);
    expect(users.body.items).toHaveLength(1);

    await http()
      .put(`/api/admin/users/${admin.id}/role`)
      .set('Authorization', admin.auth)
      .send({ role: 'user' })
      .expect(400);
    await http()
      .put(`/api/admin/users/${target.id}/role`)
      .set('Authorization', admin.auth)
      .send({ role: 'nutritionist' })
      .expect(200);
    const list = await http()
      .get('/api/nutritionists')
      .set('Authorization', admin.auth)
      .expect(200);
    expect(list.body.map((x: { id: string }) => x.id)).toContain(target.id);

    await http()
      .post(`/api/admin/users/${target.id}/block`)
      .set('Authorization', admin.auth)
      .send({ reason: 'Incalcarea regulilor' })
      .expect(201);
    await http().get('/api/me').set('Authorization', target.auth).expect(401);
    const login = await http()
      .post('/api/auth/login')
      .send({ email: target.email, password: PASSWORD })
      .expect(403);
    expect(login.body).toMatchObject({ code: 'account_blocked', reason: 'Incalcarea regulilor' });
    const hidden = await http()
      .get('/api/nutritionists')
      .set('Authorization', admin.auth)
      .expect(200);
    expect(hidden.body.map((x: { id: string }) => x.id)).not.toContain(target.id);

    await http()
      .post(`/api/admin/users/${target.id}/unblock`)
      .set('Authorization', admin.auth)
      .expect(201);
    await http()
      .post('/api/auth/login')
      .send({ email: target.email, password: PASSWORD })
      .expect(200);

    const log = await http().get('/api/admin/log').set('Authorization', admin.auth).expect(200);
    const actions = log.body
      .filter((l: { targetEmail: string }) => l.targetEmail === target.email)
      .map((l: { action: string }) => l.action);
    expect(actions).toEqual(['account_unblocked', 'account_blocked', 'role_changed']);

    const stats = await http().get('/api/admin/stats').set('Authorization', admin.auth).expect(200);
    expect(stats.body.users.total).toBeGreaterThan(0);

    const before = await http()
      .get('/api/admin/settings')
      .set('Authorization', admin.auth)
      .expect(200);
    try {
      await http()
        .put('/api/admin/settings')
        .set('Authorization', admin.auth)
        .send({ freeConsultationDays: 0 })
        .expect(200);
      const user = await account();
      const offer = await http()
        .get('/api/me/consultation-offer')
        .set('Authorization', user.auth)
        .expect(200);
      expect(offer.body.eligible).toBe(false);
    } finally {
      await http()
        .put('/api/admin/settings')
        .set('Authorization', admin.auth)
        .send(before.body)
        .expect(200);
    }
  });
});
