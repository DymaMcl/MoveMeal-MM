import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { todayIso } from '../src/common/dates.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';
import { DEFAULT_SETTINGS } from '../src/settings/settings.service.js';

const PASSWORD = 'parola-sigura-1';
/** Un fisier care incepe ca un JPEG (serverul verifica primii octeti, nu decodeaza imaginea). */
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]).toString(
  'base64',
);

function geminiReply(text: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] }, finishReason: 'STOP' }],
  };
}

/** Titlu unic, ca anuntul de test sa poata fi sters de la toti destinatarii. */
const ANNOUNCEMENT = `Test automat ${randomUUID().slice(0, 8)}`;

describe('Comunitatea, blogul si administrarea (e2e, Gemini simulat)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  let gemini: Server;
  let geminiDown = false;
  const emails: string[] = [];
  const http = () => request(app.getHttpServer());

  async function account(name: string, extra: Record<string, unknown> = {}) {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, healthDataConsent: true })
      .expect(201);
    const auth = `Bearer ${res.body.token}`;
    await http()
      .put('/api/me/profile')
      .set('Authorization', auth)
      .send({
        name,
        age: 30,
        sex: 'female',
        heightCm: 168,
        weightKg: 80,
        activityLevel: 'moderate',
        goal: 'maintain',
        ...extra,
      })
      .expect(200);
    return { id: res.body.user.id as string, email, auth };
  }

  async function withRole(name: string, role: 'admin' | 'nutritionist') {
    const user = await account(name);
    await owner.query('update users set role = $2 where id = $1', [user.id, role]);
    if (role === 'nutritionist') {
      await owner.query(
        `insert into nutritionist_profiles (user_id, display_name, title) values ($1, $2, 'Dietetician')`,
        [user.id, `Dr. ${name}`],
      );
    }
    return user;
  }

  const post = (auth: string, body: Record<string, unknown>) =>
    http()
      .post('/api/posts')
      .set('Authorization', auth)
      .send({ image: JPEG, mimeType: 'image/jpeg', kind: 'meal', visibility: 'public', ...body });

  beforeAll(async () => {
    await migrate(() => undefined);
    owner = new pg.Client(dbConfig().owner);
    await owner.connect();
    await owner.query(`update system_settings set value = $2 where key = $1`, [
      'community_premoderation',
      'false',
    ]);

    // Moderatorul simulat decide dupa cuvintele din descriere.
    gemini = createServer((req: IncomingMessage, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        if (geminiDown) {
          res.statusCode = 503;
          res.end(JSON.stringify({ error: { message: 'simulat' } }));
          return;
        }
        const body = JSON.parse(raw) as {
          contents: { parts: { text?: string }[] }[];
        };
        const caption = body.contents[0].parts.map((p) => p.text ?? '').join(' ');
        res.end(
          JSON.stringify(
            geminiReply({
              description: 'o farfurie',
              adult: caption.includes('nud'),
              violence: false,
              hate: false,
              drugs: false,
              selfHarm: false,
              offensiveText: false,
              relevant: !caption.includes('masina'),
              suggestedKind: 'meal',
            }),
          ),
        );
      });
    });
    await new Promise<void>((resolve) => gemini.listen(0, '127.0.0.1', resolve));
    process.env.GEMINI_API_KEY = 'cheie-de-test';
    process.env.GEMINI_BASE_URL = `http://127.0.0.1:${(gemini.address() as AddressInfo).port}/v1beta`;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    // Anuntul de test ajunge la toate conturile (si la cele reale): se sterge de peste tot.
    await owner.query(
      `delete from notifications where kind = 'announcement' and payload->>'title' = $1`,
      [ANNOUNCEMENT],
    );
    await owner.query(`delete from admin_log where details->>'title' = $1`, [ANNOUNCEMENT]);
    // Parametrii modificati in teste revin la valorile implicite.
    await owner.query(
      `update system_settings set value = case key
         when 'posts_daily' then $1::jsonb when 'community_enabled' then 'true'::jsonb
         else value end`,
      [JSON.stringify(DEFAULT_SETTINGS.postsDaily)],
    );
    await owner.query(
      'delete from blog_posts where author_id in (select id from users where email = any($1))',
      [emails],
    );
    // Evenimentele de moderare raman altfel in statistici (user_id devine null la stergere).
    await owner.query(
      'delete from moderation_events where user_id in (select id from users where email = any($1))',
      [emails],
    );
    await owner.query('delete from users where email = any($1)', [emails]);
    await owner.end();
    await app.close();
    await new Promise((resolve) => gemini.close(resolve));
  });

  beforeEach(() => {
    geminiDown = false;
  });

  it('postarea publica apare in lenta, cea privata doar in albumul autorului', async () => {
    const ana = await account('Ana Pop');
    const ion = await account('Ion Rusu');

    const pub = await post(ana.auth, { caption: 'Salata de dimineata' }).expect(201);
    expect(pub.body).toMatchObject({
      status: 'published',
      visibility: 'public',
      author: { id: ana.id, name: 'Ana Pop', role: 'user' },
      isMine: true,
    });
    const priv = await post(ana.auth, {
      caption: 'doar pentru mine',
      visibility: 'private',
    }).expect(201);

    const feed = await http().get('/api/feed').set('Authorization', ion.auth).expect(200);
    const ids = feed.body.items.map((p: { id: string }) => p.id);
    expect(ids).toContain(pub.body.id);
    expect(ids).not.toContain(priv.body.id);

    // Postarea privata si fotografia ei nu sunt accesibile altcuiva (politica RLS).
    await http().get(`/api/posts/${priv.body.id}`).set('Authorization', ion.auth).expect(404);
    await http().get(`/api/media/${priv.body.mediaId}`).set('Authorization', ion.auth).expect(404);
    const image = await http()
      .get(`/api/media/${pub.body.mediaId}`)
      .set('Authorization', ion.auth)
      .expect(200);
    expect(image.headers['content-type']).toBe('image/jpeg');
    expect(Buffer.from(image.body).toString('base64')).toBe(JPEG);

    const own = await http()
      .get(`/api/users/${ana.id}/posts`)
      .set('Authorization', ana.auth)
      .expect(200);
    expect(own.body.items).toHaveLength(2);
    const seen = await http()
      .get(`/api/users/${ana.id}/posts`)
      .set('Authorization', ion.auth)
      .expect(200);
    expect(seen.body.items.map((p: { id: string }) => p.id)).toEqual([pub.body.id]);

    // Aprecieri si salvari: contoare si lista „Salvate”.
    const liked = await http()
      .put(`/api/posts/${pub.body.id}/like`)
      .set('Authorization', ion.auth)
      .send({ value: true })
      .expect(200);
    expect(liked.body).toMatchObject({ value: true, likeCount: 1 });
    await http()
      .put(`/api/posts/${pub.body.id}/like`)
      .set('Authorization', ion.auth)
      .send({ value: true })
      .expect(200);
    await http()
      .put(`/api/posts/${pub.body.id}/save`)
      .set('Authorization', ion.auth)
      .send({ value: true })
      .expect(200);
    const saved = await http().get('/api/me/saved').set('Authorization', ion.auth).expect(200);
    expect(saved.body.posts.map((p: { id: string }) => p.id)).toEqual([pub.body.id]);
    expect(saved.body.posts[0]).toMatchObject({ likedByMe: true, savedByMe: true, likeCount: 1 });
    await http()
      .put(`/api/posts/${priv.body.id}/like`)
      .set('Authorization', ion.auth)
      .send({ value: true })
      .expect(404);

    // Devine privata: dispare din lenta si din salvatele lui Ion.
    await http()
      .patch(`/api/posts/${pub.body.id}`)
      .set('Authorization', ana.auth)
      .send({ visibility: 'private' })
      .expect(200);
    const after = await http().get('/api/me/saved').set('Authorization', ion.auth).expect(200);
    expect(after.body.posts).toHaveLength(0);

    await http().delete(`/api/posts/${priv.body.id}`).set('Authorization', ion.auth).expect(404);
    await http().delete(`/api/posts/${priv.body.id}`).set('Authorization', ana.auth).expect(204);
  });

  it('verificarea AI respinge continutul pentru adulti si ce nu tine de alimentatie sau sport', async () => {
    const user = await account('Mara');
    const adult = await post(user.auth, { caption: 'poza nud' }).expect(422);
    expect(adult.body).toMatchObject({ code: 'content_rejected', reason: 'adult' });
    // Nici in albumul privat.
    await post(user.auth, { caption: 'poza nud', visibility: 'private' }).expect(422);

    const car = await post(user.auth, { caption: 'masina mea noua' }).expect(422);
    expect(car.body.reason).toBe('not_relevant');
    // In albumul privat se poate pastra.
    const kept = await post(user.auth, {
      caption: 'masina mea noua',
      visibility: 'private',
    }).expect(201);
    // Si nu poate fi mutata apoi in lenta.
    await http()
      .patch(`/api/posts/${kept.body.id}`)
      .set('Authorization', user.auth)
      .send({ visibility: 'public' })
      .expect(422);

    const { rows } = await owner.query<{ verdict: string; reason: string | null }>(
      `select verdict, reason from moderation_events where user_id = $1 order by id`,
      [user.id],
    );
    expect(rows.map((r) => r.reason)).toEqual(['adult', 'adult', 'not_relevant', null]);

    await http()
      .post('/api/posts')
      .set('Authorization', user.auth)
      .send({
        image: Buffer.from('nu este imagine, doar text lung '.repeat(5)).toString('base64'),
        mimeType: 'image/jpeg',
        kind: 'meal',
        visibility: 'public',
      })
      .expect(400);
  });

  it('fara verificare AI, postarea publica asteapta aprobarea administratorului', async () => {
    const admin = await withRole('Admin Test', 'admin');
    const user = await account('Dan');
    const viewer = await account('Eva');
    geminiDown = true;
    const pending = await post(user.auth, { caption: 'alergare de seara', kind: 'running' }).expect(
      201,
    );
    expect(pending.body.status).toBe('pending');
    geminiDown = false;
    let feed = await http().get('/api/feed').set('Authorization', viewer.auth).expect(200);
    expect(feed.body.items.map((p: { id: string }) => p.id)).not.toContain(pending.body.id);

    // Doar administratorul vede fotografia care asteapta verificarea.
    await http()
      .get(`/api/media/${pending.body.mediaId}`)
      .set('Authorization', viewer.auth)
      .expect(404);
    await http()
      .get(`/api/media/${pending.body.mediaId}`)
      .set('Authorization', admin.auth)
      .expect(200);
    await http().get('/api/admin/moderation').set('Authorization', user.auth).expect(403);
    const queue = await http()
      .get('/api/admin/moderation?filter=pending')
      .set('Authorization', admin.auth)
      .expect(200);
    expect(queue.body.items.map((p: { id: string }) => p.id)).toContain(pending.body.id);

    await http()
      .post(`/api/admin/posts/${pending.body.id}/approve`)
      .set('Authorization', admin.auth)
      .expect(204);
    feed = await http().get('/api/feed').set('Authorization', viewer.auth).expect(200);
    expect(feed.body.items.map((p: { id: string }) => p.id)).toContain(pending.body.id);
    const notes = await http()
      .get('/api/me/notifications')
      .set('Authorization', user.auth)
      .expect(200);
    expect(notes.body.items[0].kind).toBe('post_approved');
  });

  it('raportarile ascund postarea, iar administratorul o elimina cu motiv', async () => {
    const admin = await withRole('Admin Doi', 'admin');
    const author = await account('Gelu');
    const target = await post(author.auth, { caption: 'antrenament', kind: 'workout' }).expect(201);
    await http()
      .post(`/api/posts/${target.body.id}/report`)
      .set('Authorization', author.auth)
      .send({ reason: 'spam' })
      .expect(400);
    for (let i = 0; i < 3; i++) {
      const reporter = await account(`Reporter ${i}`);
      await http()
        .post(`/api/posts/${target.body.id}/report`)
        .set('Authorization', reporter.auth)
        .send({ reason: 'spam', note: 'reclama' })
        .expect(204);
    }
    const hidden = await http()
      .get(`/api/posts/${target.body.id}`)
      .set('Authorization', author.auth)
      .expect(200);
    expect(hidden.body.status).toBe('pending');

    const queue = await http()
      .get('/api/admin/moderation?filter=reported')
      .set('Authorization', admin.auth)
      .expect(200);
    const item = queue.body.items.find((p: { id: string }) => p.id === target.body.id);
    expect(item.reports).toHaveLength(3);
    expect(item.author.email).toBe(author.email);

    await http()
      .post(`/api/admin/posts/${target.body.id}/remove`)
      .set('Authorization', admin.auth)
      .send({ reason: 'Reclama comerciala' })
      .expect(204);
    const removed = await http()
      .get(`/api/posts/${target.body.id}`)
      .set('Authorization', author.auth)
      .expect(200);
    expect(removed.body).toMatchObject({ status: 'removed', removedReason: 'Reclama comerciala' });
    await http()
      .patch(`/api/posts/${target.body.id}`)
      .set('Authorization', author.auth)
      .send({ caption: 'alt text' })
      .expect(403);
    const notes = await http()
      .get('/api/me/notifications')
      .set('Authorization', author.auth)
      .expect(200);
    expect(notes.body.items[0]).toMatchObject({
      kind: 'post_removed',
      payload: { reason: 'Reclama comerciala' },
    });
    const log = await http()
      .get('/api/admin/log?action=post_removed')
      .set('Authorization', admin.auth)
      .expect(200);
    expect(log.body[0].targetEmail).toBe(author.email);
  });

  it('profilul arata progresul spre obiectiv, daca utilizatorul permite', async () => {
    const user = await account('Lia', { goal: 'lose', targetWeightKg: 70, weeks: 20 });
    const viewer = await account('Nicu');
    await http()
      .put('/api/me/measurements')
      .set('Authorization', user.auth)
      .send({ day: todayIso(), weightKg: 77.5 })
      .expect(204);
    const me = await http().get('/api/me/social').set('Authorization', user.auth).expect(200);
    // 80 kg -> 70 kg; acum 77,5 kg = 25%.
    expect(me.body.progress).toMatchObject({
      goal: 'lose',
      kind: 'weight',
      pct: 25,
      currentKg: 77.5,
    });
    expect(me.body.profile).toMatchObject({ displayName: 'Lia', isMe: true });

    const seen = await http()
      .get(`/api/users/${user.id}/profile`)
      .set('Authorization', viewer.auth)
      .expect(200);
    expect(seen.body).toMatchObject({ isMe: false, progress: { pct: 25, kind: 'weight' } });

    await http()
      .put('/api/me/social')
      .set('Authorization', user.auth)
      .send({ displayName: 'Lia M.', bio: 'Alerg in fiecare dimineata', showProgress: false })
      .expect(200);
    const hidden = await http()
      .get(`/api/users/${user.id}/profile`)
      .set('Authorization', viewer.auth)
      .expect(200);
    expect(hidden.body).toMatchObject({ displayName: 'Lia M.', progress: null });

    const avatar = await http()
      .put('/api/me/social/avatar')
      .set('Authorization', user.auth)
      .send({ image: JPEG, mimeType: 'image/jpeg' })
      .expect(200);
    await http()
      .get(`/api/media/${avatar.body.avatarId}`)
      .set('Authorization', viewer.auth)
      .expect(200);
  });

  it('blogul: doar nutritionistii si administratorii scriu, cititorii sunt numarati o data', async () => {
    const nutritionist = await withRole('Elena', 'nutritionist');
    const admin = await withRole('Admin Blog', 'admin');
    const reader = await account('Cititor');
    const other = await account('Alt cititor');
    const article = {
      title: 'Cate proteine iti trebuie pe zi',
      summary: 'Ghid simplu pentru incepatori.',
      body: '## Proteinele\nProteinele ajuta la refacerea muschilor dupa antrenament.\n- oua\n- peste',
      category: 'nutrition',
      status: 'draft',
    };
    await http().post('/api/blog').set('Authorization', reader.auth).send(article).expect(403);
    const draft = await http()
      .post('/api/blog')
      .set('Authorization', nutritionist.auth)
      .send({ ...article, coverImage: JPEG, coverMimeType: 'image/jpeg' })
      .expect(201);
    expect(draft.body).toMatchObject({
      status: 'draft',
      author: { name: 'Dr. Elena', title: 'Dietetician', role: 'nutritionist' },
      readMinutes: 1,
    });
    await http().get(`/api/blog/${draft.body.id}`).set('Authorization', reader.auth).expect(404);
    // Coperta ciornei nu este publica.
    await http()
      .get(`/api/media/${draft.body.coverId}`)
      .set('Authorization', reader.auth)
      .expect(404);

    await http()
      .put(`/api/blog/${draft.body.id}`)
      .set('Authorization', nutritionist.auth)
      .send({ ...article, status: 'published' })
      .expect(200);
    await http()
      .put(`/api/blog/${draft.body.id}`)
      .set('Authorization', reader.auth)
      .send({ ...article, status: 'published' })
      .expect(403);

    const list = await http().get('/api/blog').set('Authorization', reader.auth).expect(200);
    expect(list.body.items.map((a: { id: string }) => a.id)).toContain(draft.body.id);
    expect(list.body.items[0].body).toBeUndefined();

    // Vizualizarile: o data per utilizator, fara autor.
    await http()
      .get(`/api/blog/${draft.body.id}`)
      .set('Authorization', nutritionist.auth)
      .expect(200);
    await http().get(`/api/blog/${draft.body.id}`).set('Authorization', reader.auth).expect(200);
    await http().get(`/api/blog/${draft.body.id}`).set('Authorization', reader.auth).expect(200);
    const opened = await http()
      .get(`/api/blog/${draft.body.id}`)
      .set('Authorization', other.auth)
      .expect(200);
    expect(opened.body.viewCount).toBe(2);
    expect(opened.body.body).toContain('Proteinele');

    await http()
      .put(`/api/blog/${draft.body.id}/like`)
      .set('Authorization', reader.auth)
      .send({ value: true })
      .expect(200);
    await http()
      .put(`/api/blog/${draft.body.id}/save`)
      .set('Authorization', reader.auth)
      .send({ value: true })
      .expect(200);
    const saved = await http().get('/api/me/saved').set('Authorization', reader.auth).expect(200);
    expect(saved.body.articles[0]).toMatchObject({
      id: draft.body.id,
      likeCount: 1,
      likedByMe: true,
    });

    const search = await http()
      .get('/api/blog?q=proteine&category=nutrition')
      .set('Authorization', reader.auth)
      .expect(200);
    expect(search.body.items).toHaveLength(1);

    // Administratorul fixeaza articolul, apoi il arhiveaza.
    await http()
      .put(`/api/admin/articles/${draft.body.id}`)
      .set('Authorization', admin.auth)
      .send({ pinned: true })
      .expect(204);
    const pinned = await http().get('/api/blog').set('Authorization', reader.auth).expect(200);
    expect(pinned.body.pinned.map((a: { id: string }) => a.id)).toContain(draft.body.id);
    expect(pinned.body.items.map((a: { id: string }) => a.id)).not.toContain(draft.body.id);
    await http()
      .put(`/api/admin/articles/${draft.body.id}`)
      .set('Authorization', admin.auth)
      .send({ status: 'archived' })
      .expect(204);
    await http().get(`/api/blog/${draft.body.id}`).set('Authorization', reader.auth).expect(404);
    const authored = await http()
      .get('/api/blog/authored')
      .set('Authorization', nutritionist.auth)
      .expect(200);
    expect(authored.body.items[0]).toMatchObject({ id: draft.body.id, status: 'archived' });
  });

  it('administratorul: statistici, fisa contului, anunturi si parametri', async () => {
    const admin = await withRole('Admin Trei', 'admin');
    const user = await account('Petru');
    const stats = await http().get('/api/admin/stats').set('Authorization', admin.auth).expect(200);
    expect(stats.body.series).toHaveLength(14);
    expect(stats.body).toHaveProperty('content.pending');
    expect(stats.body).toHaveProperty('ai.photoWeek');
    expect(stats.body).toHaveProperty('moderation.reasons');

    const search = await http()
      .get(`/api/admin/users?q=${user.email.slice(5, 20)}`)
      .set('Authorization', admin.auth)
      .expect(200);
    expect(search.body.items[0]).toMatchObject({ id: user.id, displayName: null });
    const detail = await http()
      .get(`/api/admin/users/${user.id}`)
      .set('Authorization', admin.auth)
      .expect(200);
    expect(detail.body.activity.activeSessions).toBe(1);

    const closed = await http()
      .post(`/api/admin/users/${user.id}/logout`)
      .set('Authorization', admin.auth)
      .expect(201);
    expect(closed.body.closed).toBe(1);
    await http().get('/api/me').set('Authorization', user.auth).expect(401);

    const sent = await http()
      .post('/api/admin/announcements')
      .set('Authorization', admin.auth)
      .send({ title: ANNOUNCEMENT, body: 'Anunt trimis de testele automate.', audience: 'all' })
      .expect(201);
    expect(sent.body.recipients).toBeGreaterThan(1);
    const notes = await http()
      .get('/api/me/notifications')
      .set('Authorization', admin.auth)
      .expect(200);
    expect(notes.body.items[0]).toMatchObject({
      kind: 'announcement',
      payload: { title: ANNOUNCEMENT },
    });

    // Limita zilnica de postari si dezactivarea comunitatii.
    const author = await account('Sanda');
    const settings = await http()
      .put('/api/admin/settings')
      .set('Authorization', admin.auth)
      .send({ postsDaily: 1, communityEnabled: false })
      .expect(200);
    expect(settings.body).toMatchObject({ postsDaily: 1, communityEnabled: false });
    await post(author.auth, { caption: 'supa de legume' }).expect(403);
    await post(author.auth, { caption: 'supa de legume', visibility: 'private' }).expect(201);
    await post(author.auth, { caption: 'alta supa', visibility: 'private' }).expect(429);
    await http()
      .put('/api/admin/settings')
      .set('Authorization', admin.auth)
      .send({ postsDaily: DEFAULT_SETTINGS.postsDaily, communityEnabled: true })
      .expect(200);
    const log = await http()
      .get('/api/admin/log?action=settings_changed')
      .set('Authorization', admin.auth)
      .expect(200);
    expect(log.body[0].details).toHaveProperty('postsDaily');
  });
});
