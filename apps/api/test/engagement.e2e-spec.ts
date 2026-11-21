import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDaysIso, todayIso } from '../src/common/dates.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';

describe('Abonari, notificari, noutati, pasi si trofee (e2e)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  const emails: string[] = [];
  const newsIds: string[] = [];
  const http = () => request(app.getHttpServer());

  async function account(role: 'user' | 'nutritionist' | 'admin' = 'user', name = 'Test') {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: 'parola-sigura-1', healthDataConsent: true })
      .expect(201);
    if (role !== 'user') {
      await owner.query('update users set role = $2 where id = $1', [res.body.user.id, role]);
    }
    const auth = `Bearer ${res.body.token}`;
    await http()
      .put('/api/me/profile')
      .set('Authorization', auth)
      .send({
        name,
        age: 30,
        sex: 'female',
        heightCm: 165,
        weightKg: 65,
        activityLevel: 'moderate',
        goal: 'maintain',
      })
      .expect(200);
    return { id: res.body.user.id as string, auth };
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
    await owner.query('delete from news where id = any($1)', [newsIds]);
    await owner.query('delete from users where email = any($1)', [emails]);
    await owner.end();
    await app.close();
  });

  it('abonarea: contoare, notificare unica si lenta „Urmariti”', async () => {
    const ana = await account('user', 'Ana');
    const ion = await account('nutritionist', 'Ion');

    // Sfatul echipei (fara fotografie) apare in comunitate.
    const tip = await http()
      .post('/api/posts/tip')
      .set('Authorization', ion.auth)
      .send({ title: 'Apa dimineata', caption: 'Un pahar de apa dupa trezire ajuta digestia.' })
      .expect(201);
    expect(tip.body).toMatchObject({ kind: 'tip', mediaId: null, title: 'Apa dimineata' });
    await http()
      .post('/api/posts/tip')
      .set('Authorization', ana.auth)
      .send({ title: 'Nu', caption: 'Utilizatorii obisnuiti nu pot publica sfaturi.' })
      .expect(403);

    // Lenta „Urmariti” este goala pana la abonare.
    const before = await http()
      .get('/api/feed?scope=following')
      .set('Authorization', ana.auth)
      .expect(200);
    expect(before.body.items.map((p: { id: string }) => p.id)).not.toContain(tip.body.id);

    for (let i = 0; i < 2; i++) {
      const res = await http()
        .put(`/api/users/${ion.id}/follow`)
        .set('Authorization', ana.auth)
        .send({ value: true })
        .expect(200);
      expect(res.body).toEqual({ following: true, followers: 1 });
    }
    await http()
      .put(`/api/users/${ana.id}/follow`)
      .set('Authorization', ana.auth)
      .send({ value: true })
      .expect(400);

    const following = await http()
      .get('/api/feed?scope=following')
      .set('Authorization', ana.auth)
      .expect(200);
    expect(following.body.items.map((p: { id: string }) => p.id)).toContain(tip.body.id);

    const profile = await http()
      .get(`/api/users/${ion.id}/profile`)
      .set('Authorization', ana.auth)
      .expect(200);
    expect(profile.body).toMatchObject({
      isFollowing: true,
      stats: { followers: 1, following: 0 },
    });
    const followers = await http()
      .get(`/api/users/${ion.id}/followers`)
      .set('Authorization', ana.auth)
      .expect(200);
    expect(followers.body.map((u: { id: string }) => u.id)).toEqual([ana.id]);

    // Aprecierea repetata (cu retragere intre ele) notifica o singura data.
    for (const value of [true, false, true]) {
      await http()
        .put(`/api/posts/${tip.body.id}/like`)
        .set('Authorization', ana.auth)
        .send({ value })
        .expect(200);
    }

    const list = await http()
      .get('/api/me/notifications')
      .set('Authorization', ion.auth)
      .expect(200);
    const community = list.body.items.filter((n: { section: string }) => n.section === 'community');
    expect(community.map((n: { kind: string }) => n.kind).sort()).toEqual([
      'new_follower',
      'post_liked',
    ]);
    expect(community.find((n: { kind: string }) => n.kind === 'post_liked').payload).toMatchObject({
      postId: tip.body.id,
      userId: ana.id,
      name: 'Ana',
    });
    expect(list.body.sections.community).toBe(2);

    // Citirea unei sectiuni nu le atinge pe celelalte.
    await http()
      .post('/api/me/notifications/read')
      .set('Authorization', ion.auth)
      .send({ section: 'community' })
      .expect(204);
    const after = await http()
      .get('/api/me/notifications')
      .set('Authorization', ion.auth)
      .expect(200);
    expect(after.body.sections.community).toBe(0);
    expect(after.body.sections.news).toBe(list.body.sections.news);

    // Dezabonarea.
    const off = await http()
      .put(`/api/users/${ion.id}/follow`)
      .set('Authorization', ana.auth)
      .send({ value: false })
      .expect(200);
    expect(off.body).toEqual({ following: false, followers: 0 });
  });

  it('noutatile: traduse, necitite pana la deschiderea sectiunii, publicate de administrator', async () => {
    const admin = await account('admin', 'Admin');
    const user = await account();
    const created = await http()
      .post('/api/admin/news')
      .set('Authorization', admin.auth)
      .send({
        kind: 'feature',
        title: 'Functie noua',
        body: 'Descrierea functiei noi din aplicatie.',
      })
      .expect(201);
    newsIds.push(created.body.id);
    await http()
      .post('/api/admin/news')
      .set('Authorization', user.auth)
      .send({ kind: 'feature', title: 'Nu', body: 'Utilizatorii nu publica noutati.' })
      .expect(403);

    const ru = await http()
      .get('/api/news?language=ru')
      .set('Authorization', user.auth)
      .expect(200);
    expect(ru.body[0]).toMatchObject({ id: created.body.id, unread: true });
    // Noutatile initiale exista in toate limbile.
    const seeded = ru.body.find((n: { kind: string }) => n.kind === 'challenge');
    expect(seeded.title).toContain('10 000');

    const counts = await http()
      .get('/api/me/notifications')
      .set('Authorization', user.auth)
      .expect(200);
    expect(counts.body.sections.news).toBeGreaterThanOrEqual(1);

    await http()
      .post('/api/me/notifications/read')
      .set('Authorization', user.auth)
      .send({ section: 'news' })
      .expect(204);
    const read = await http().get('/api/news').set('Authorization', user.auth).expect(200);
    expect(read.body.every((n: { unread: boolean }) => !n.unread)).toBe(true);
  });

  it('pasii: 3 zile la rand cu 10 000 de pasi aduc trofeul si notificarea', async () => {
    const user = await account();
    const other = await account();
    const today = todayIso();

    const first = await http()
      .put('/api/me/steps')
      .set('Authorization', user.auth)
      .send({ day: addDaysIso(today, -2), steps: 12000, source: 'manual' })
      .expect(200);
    expect(first.body.trophies).toEqual([]);
    await http()
      .put('/api/me/steps')
      .set('Authorization', user.auth)
      .send({ day: addDaysIso(today, -1), steps: 10000, source: 'device' })
      .expect(200);
    const third = await http()
      .put('/api/me/steps')
      .set('Authorization', user.auth)
      .send({ day: today, steps: 10500, source: 'manual' })
      .expect(200);
    expect(third.body.trophies).toEqual(['steps_10k_3']);

    const steps = await http().get('/api/me/steps').set('Authorization', user.auth).expect(200);
    expect(steps.body.map((d: { steps: number }) => d.steps)).toEqual([12000, 10000, 10500]);
    await http()
      .put('/api/me/steps')
      .set('Authorization', user.auth)
      .send({ day: addDaysIso(today, -30), steps: 5000, source: 'manual' })
      .expect(400);

    const mine = await http().get('/api/me/trophies').set('Authorization', user.auth).expect(200);
    expect(mine.body.find((t: { id: string }) => t.id === 'steps_10k_3')).toMatchObject({
      earned: true,
      progress: 3,
    });

    // Ceilalti vad trofeul obtinut, dar nu si progresul celorlalte.
    const seen = await http()
      .get(`/api/users/${user.id}/trophies`)
      .set('Authorization', other.auth)
      .expect(200);
    expect(seen.body.find((t: { id: string }) => t.id === 'steps_10k_3').earned).toBe(true);
    expect(seen.body.find((t: { id: string }) => t.id === 'workouts_10').progress).toBe(0);

    const notes = await http()
      .get('/api/me/notifications')
      .set('Authorization', user.auth)
      .expect(200);
    const trophy = notes.body.items.find((n: { kind: string }) => n.kind === 'trophy');
    expect(trophy).toMatchObject({ section: 'news', payload: { trophyId: 'steps_10k_3' } });
  });
});
