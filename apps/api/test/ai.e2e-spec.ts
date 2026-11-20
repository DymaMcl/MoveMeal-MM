import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AI_DAILY_LIMITS } from '../src/ai/ai-usage.service.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { todayIso } from '../src/common/dates.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';
import { DEFAULT_CHAT_MODEL, DEFAULT_VISION_MODEL } from '../src/ai/gemini.service.js';
import { sanitizeItems } from '../src/food-photo/food-photo.service.js';

const PASSWORD = 'parola-sigura-1';
/** Cea mai mica imagine JPEG valida nu este necesara: serverul de test nu o decodeaza. */
const IMAGE = Buffer.from('imagine-de-test').toString('base64');

interface GeminiCall {
  path: string;
  key: string | undefined;
  body: {
    systemInstruction: { parts: { text: string }[] };
    contents: { role: string; parts: { text?: string; inlineData?: { mimeType: string } }[] }[];
    generationConfig: { responseMimeType: string };
  };
}

/** Raspunsurile serverului Gemini simulat (fara cheie reala si fara costuri). */
function geminiReply(text: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] }, finishReason: 'STOP' }],
  };
}

describe('Asistentul AI si fotografierea mesei (e2e, Gemini simulat)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  let gemini: Server;
  const calls: GeminiCall[] = [];
  let nextStatus = 200;
  /** Modelul simulat ca supraincarcat (503). */
  let busyModel = '';
  /** Modelul simulat ca foarte lent (raspunde dupa 9 s). */
  let slowModel = '';
  const emails: string[] = [];
  const http = () => request(app.getHttpServer());

  async function account(name?: string) {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: PASSWORD, healthDataConsent: true })
      .expect(201);
    const auth = `Bearer ${res.body.token}`;
    if (name) {
      await http()
        .put('/api/me/profile')
        .set('Authorization', auth)
        .send({
          name,
          age: 28,
          sex: 'male',
          heightCm: 180,
          weightKg: 82,
          activityLevel: 'moderate',
          goal: 'maintain',
        })
        .expect(200);
    }
    return { id: res.body.user.id as string, email, auth };
  }

  beforeAll(async () => {
    await migrate(() => undefined);
    owner = new pg.Client(dbConfig().owner);
    await owner.connect();

    gemini = createServer((req: IncomingMessage, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const body = JSON.parse(raw) as GeminiCall['body'];
        calls.push({ path: req.url ?? '', key: req.headers['x-goog-api-key'] as string, body });
        res.setHeader('Content-Type', 'application/json');
        const busy = busyModel !== '' && (req.url ?? '').includes(`/models/${busyModel}:`);
        if (nextStatus !== 200 || busy) {
          res.statusCode = busy ? 503 : nextStatus;
          res.end(JSON.stringify({ error: { message: 'simulat' } }));
          return;
        }
        const isPhoto = body.contents.some((c) => c.parts.some((p) => p.inlineData));
        const isItem = (body.contents[0]?.parts[0]?.text ?? '').startsWith('Food:');
        const delay =
          slowModel !== '' && (req.url ?? '').includes(`/models/${slowModel}:`) ? 9_000 : 0;
        if (isItem) {
          const text = body.contents[0].parts[0].text ?? '';
          res.end(
            JSON.stringify(
              geminiReply(
                text.includes('piatra')
                  ? {
                      name: '',
                      isFood: false,
                      kcalPer100: 0,
                      proteinPer100: 0,
                      carbsPer100: 0,
                      fatPer100: 0,
                      catalogId: '',
                    }
                  : {
                      name: 'Piure de cartofi',
                      isFood: true,
                      kcalPer100: 106,
                      proteinPer100: 2,
                      carbsPer100: 15,
                      fatPer100: 4.2,
                      catalogId: '',
                    },
              ),
            ),
          );
          return;
        }
        setTimeout(
          () =>
            res.end(
              JSON.stringify(
                isPhoto
                  ? geminiReply({
                      isFood: true,
                      dish: 'Orez cu pui si banana',
                      items: [
                        // Banana din catalog: valorile se potrivesc, se folosesc cele din catalog.
                        {
                          name: 'Banana',
                          grams: 120,
                          kcalPer100: 90,
                          proteinPer100: 1,
                          carbsPer100: 23,
                          fatPer100: 0.3,
                          catalogId: 'banana',
                          confidence: 0.9,
                        },
                        // Orez fiert: estimarea (130 kcal) difera de orezul crud din catalog (360 kcal).
                        {
                          name: 'Orez fiert',
                          grams: 180,
                          kcalPer100: 130,
                          proteinPer100: 2.7,
                          carbsPer100: 28,
                          fatPer100: 0.3,
                          catalogId: 'rice',
                          confidence: 0.8,
                        },
                        {
                          name: 'Piept de pui la gratar',
                          grams: 9000,
                          kcalPer100: 165,
                          proteinPer100: 31,
                          carbsPer100: 0,
                          fatPer100: 3.6,
                          catalogId: '',
                          confidence: 0.7,
                        },
                      ],
                    })
                  : geminiReply({ reply: 'Ai mancat bine azi. Mai bea apa!', action: 'home' }),
              ),
            ),
          delay,
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
    await owner.query('delete from users where email = any($1)', [emails]);
    await owner.end();
    await app.close();
    await new Promise((resolve) => gemini.close(resolve));
  });

  beforeEach(() => {
    calls.length = 0;
    nextStatus = 200;
    busyModel = '';
    slowModel = '';
  });

  it('raspunde cu Gemini folosind datele zilei, fara e-mail, si numara cererile', async () => {
    const user = await account('Andrei');
    const status = await http().get('/api/me/ai').set('Authorization', user.auth).expect(200);
    expect(status.body).toEqual({ available: true, remaining: AI_DAILY_LIMITS });

    const res = await http()
      .post('/api/me/assistant/chat')
      .set('Authorization', user.auth)
      .send({
        language: 'ro',
        messages: [
          { role: 'user', text: 'Salut' },
          { role: 'assistant', text: 'Salut! Cu ce te ajut?' },
          { role: 'user', text: 'Cate calorii mai am azi?' },
        ],
      })
      .expect(200);
    expect(res.body).toEqual({ reply: 'Ai mancat bine azi. Mai bea apa!', action: 'home' });

    expect(calls).toHaveLength(1);
    expect(calls[0].key).toBe('cheie-de-test');
    expect(calls[0].path).toContain(':generateContent');
    expect(calls[0].body.generationConfig.responseMimeType).toBe('application/json');
    expect(calls[0].body.contents.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    const system = calls[0].body.systemInstruction.parts[0].text;
    expect(system).toContain('Andrei');
    expect(system).toContain('Romanian');
    expect(system).not.toContain(user.email);

    const after = await http().get('/api/me/ai').set('Authorization', user.auth).expect(200);
    expect(after.body.remaining.chat).toBe(AI_DAILY_LIMITS.chat - 1);
  });

  it('valideaza conversatia si nu consuma limita cand Gemini da eroare', async () => {
    const user = await account('Ana');
    await http()
      .post('/api/me/assistant/chat')
      .set('Authorization', user.auth)
      .send({ language: 'ro', messages: [{ role: 'assistant', text: 'Salut' }] })
      .expect(400);
    await http()
      .post('/api/me/assistant/chat')
      .set('Authorization', user.auth)
      .send({ language: 'ro', messages: [{ role: 'user', text: 'x'.repeat(1001) }] })
      .expect(400);
    await http().post('/api/me/assistant/chat').send({}).expect(401);

    nextStatus = 429;
    const busy = await http()
      .post('/api/me/assistant/chat')
      .set('Authorization', user.auth)
      .send({ language: 'ro', messages: [{ role: 'user', text: 'Ce sa mananc?' }] })
      .expect(503);
    expect(busy.body.code).toBe('ai_busy');
    const status = await http().get('/api/me/ai').set('Authorization', user.auth).expect(200);
    expect(status.body.remaining.chat).toBe(AI_DAILY_LIMITS.chat);
  });

  it('respecta limita zilnica de cereri', async () => {
    const user = await account('Mihai');
    await owner.query(
      `insert into ai_usage (user_id, kind) select $1, 'chat' from generate_series(1, $2)`,
      [user.id, AI_DAILY_LIMITS.chat],
    );
    const res = await http()
      .post('/api/me/assistant/chat')
      .set('Authorization', user.auth)
      .send({ language: 'en', messages: [{ role: 'user', text: 'Hello' }] })
      .expect(429);
    expect(res.body.code).toBe('ai_limit');
    expect(calls).toHaveLength(0);
  });

  it('recunoaste alimentele din fotografie si le adauga in jurnal o singura data', async () => {
    const user = await account('Elena');
    const day = todayIso();
    const analysis = await http()
      .post('/api/me/food-photo')
      .set('Authorization', user.auth)
      .send({ image: IMAGE, mimeType: 'image/jpeg', language: 'ro' })
      .expect(200);
    expect(calls[0].body.contents[0].parts[0].inlineData?.mimeType).toBe('image/jpeg');

    const items = analysis.body.items as {
      name: string;
      grams: number;
      foodId: string | null;
      per100: { kcal: number };
      nutrients: { kcal: number };
    }[];
    expect(analysis.body.isFood).toBe(true);
    expect(items).toHaveLength(3);
    expect(items[0].foodId).toBe('banana');
    expect(items[1].foodId).toBeNull();
    expect(items[1].per100.kcal).toBe(130);
    expect(items[1].nutrients.kcal).toBe(234);
    expect(items[2].grams).toBe(2000);

    // Utilizatorul corecteaza gramajul orezului si renunta la pui.
    const logged = await http()
      .post(`/api/me/food-photo/${analysis.body.id}/log`)
      .set('Authorization', user.auth)
      .send({
        day,
        meal: 'lunch',
        items: [
          { index: 0, grams: 120 },
          { index: 1, grams: 150 },
        ],
      })
      .expect(201);
    expect(logged.body.map((e: { source: string }) => e.source)).toEqual(['food', 'photo']);
    expect(logged.body[1]).toMatchObject({ name: 'Orez fiert', amount: 150, kcal: 195 });

    const log = await http()
      .get(`/api/me/food-log?day=${day}`)
      .set('Authorization', user.auth)
      .expect(200);
    expect(log.body).toHaveLength(2);

    await http()
      .post(`/api/me/food-photo/${analysis.body.id}/log`)
      .set('Authorization', user.auth)
      .send({ day, meal: 'lunch', items: [{ index: 2, grams: 100 }] })
      .expect(409);

    // Analiza altui utilizator nu poate fi folosita (RLS).
    const other = await account();
    await http()
      .post(`/api/me/food-photo/${analysis.body.id}/log`)
      .set('Authorization', other.auth)
      .send({ day, meal: 'lunch', items: [{ index: 0, grams: 100 }] })
      .expect(404);
  });

  it('repeta cererea si trece la modelul de rezerva cand modelul principal este ocupat', async () => {
    const user = await account('Victor');
    busyModel = DEFAULT_VISION_MODEL;
    const analysis = await http()
      .post('/api/me/food-photo')
      .set('Authorization', user.auth)
      .send({ image: IMAGE, mimeType: 'image/jpeg', language: 'ro' })
      .expect(200);
    expect(analysis.body.items).toHaveLength(3);
    expect(calls.map((c) => c.path.split('/models/')[1])).toEqual([
      `${DEFAULT_VISION_MODEL}:generateContent`,
      `${DEFAULT_VISION_MODEL}:generateContent`,
      `${DEFAULT_CHAT_MODEL}:generateContent`,
    ]);
    const { rows } = await owner.query('select model from food_photos where id = $1', [
      analysis.body.id,
    ]);
    expect(rows[0].model).toBe(DEFAULT_CHAT_MODEL);
  });

  it('porneste in paralel modelul de rezerva cand modelul principal intarzie', async () => {
    const user = await account('Radu');
    slowModel = DEFAULT_VISION_MODEL;
    const started = Date.now();
    const analysis = await http()
      .post('/api/me/food-photo')
      .set('Authorization', user.auth)
      .send({ image: IMAGE, mimeType: 'image/jpeg', language: 'ro', hint: 'orez cu pui' })
      .expect(200);
    // Raspunde modelul de rezerva, pornit dupa 7 s, fara sa astepte modelul lent (9 s).
    expect(Date.now() - started).toBeLessThan(8_800);
    const { rows } = await owner.query('select model from food_photos where id = $1', [
      analysis.body.id,
    ]);
    expect(rows[0].model).toBe(DEFAULT_CHAT_MODEL);
    // Descrierea utilizatorului si nivelul de gandire ajung la model.
    const photoCall = calls.find((c) => c.path.includes(`/models/${DEFAULT_CHAT_MODEL}:`))!;
    expect(JSON.stringify(photoCall.body.contents)).toContain('orez cu pui');
    expect(JSON.stringify(photoCall.body.generationConfig)).toContain('thinkingLevel');
  }, 20_000);

  it('corecteaza si adauga alimente inainte de salvare', async () => {
    const user = await account('Irina');
    const analysis = await http()
      .post('/api/me/food-photo')
      .set('Authorization', user.auth)
      .send({ image: IMAGE, mimeType: 'image/jpeg', language: 'ro' })
      .expect(200);
    const id = analysis.body.id as string;

    // Inlocuire din catalog: valorile verificate din catalog.
    const fromCatalog = await http()
      .post(`/api/me/food-photo/${id}/items`)
      .set('Authorization', user.auth)
      .send({ index: 0, foodId: 'apple', language: 'ro' })
      .expect(200);
    expect(fromCatalog.body.items[0]).toMatchObject({ foodId: 'apple', grams: 120 });

    // Denumire scrisa de utilizator: valorile la 100 g le estimeaza modelul.
    const named = await http()
      .post(`/api/me/food-photo/${id}/items`)
      .set('Authorization', user.auth)
      .send({ index: 1, name: 'piure de cartofi', language: 'ro' })
      .expect(200);
    expect(named.body.items[1]).toMatchObject({
      name: 'Piure de cartofi',
      grams: 180,
      foodId: null,
    });
    expect(named.body.items[1].per100.kcal).toBe(106);

    const added = await http()
      .post(`/api/me/food-photo/${id}/items`)
      .set('Authorization', user.auth)
      .send({ foodId: 'cucumber', grams: 80, language: 'ro' })
      .expect(200);
    expect(added.body.items).toHaveLength(4);

    await http()
      .post(`/api/me/food-photo/${id}/items`)
      .set('Authorization', user.auth)
      .send({ index: 2, name: 'o piatra', language: 'ro' })
      .expect(422);
    await http()
      .post(`/api/me/food-photo/${id}/items`)
      .set('Authorization', user.auth)
      .send({ index: 2, foodId: 'apple', name: 'mar', language: 'ro' })
      .expect(400);

    const day = todayIso();
    const logged = await http()
      .post(`/api/me/food-photo/${id}/log`)
      .set('Authorization', user.auth)
      .send({
        day,
        meal: 'lunch',
        items: [
          { index: 1, grams: 200 },
          { index: 3, grams: 80 },
        ],
      })
      .expect(201);
    expect(logged.body[0]).toMatchObject({ source: 'photo', name: 'Piure de cartofi', kcal: 212 });
    expect(logged.body[1]).toMatchObject({ source: 'food', refId: 'cucumber' });
    // Dupa salvare analiza nu mai poate fi modificata.
    await http()
      .post(`/api/me/food-photo/${id}/items`)
      .set('Authorization', user.auth)
      .send({ index: 0, foodId: 'banana', language: 'ro' })
      .expect(409);
  });

  it('refuza imaginile invalide', async () => {
    const user = await account();
    await http()
      .post('/api/me/food-photo')
      .set('Authorization', user.auth)
      .send({ image: 'nu este base64!', mimeType: 'image/jpeg', language: 'ro' })
      .expect(400);
    await http()
      .post('/api/me/food-photo')
      .set('Authorization', user.auth)
      .send({ image: IMAGE, mimeType: 'application/pdf', language: 'ro' })
      .expect(400);
    expect(calls).toHaveLength(0);
  });

  it('valideaza raspunsul modelului', () => {
    expect(sanitizeItems('text')).toEqual([]);
    const [item] = sanitizeItems([
      { name: ' Ciorba ', grams: -5, kcalPer100: 50 },
      { name: 'Salata', grams: 200, kcalPer100: 5000, proteinPer100: -3, catalogId: 'necunoscut' },
    ]);
    expect(item).toMatchObject({
      name: 'Salata',
      grams: 200,
      per100: { kcal: 900, protein: 0, carbs: 0, fat: 0 },
      foodId: null,
      confidence: 0,
    });
  });
});
