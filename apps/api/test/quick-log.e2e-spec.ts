import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomInt, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDaysIso, todayIso } from '../src/common/dates.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';
import { parseOffProduct } from '../src/quick-log/open-food-facts.js';

const IMAGE = Buffer.from('eticheta-de-test').toString('base64');

function geminiReply(text: unknown) {
  return {
    candidates: [{ content: { parts: [{ text: JSON.stringify(text) }] }, finishReason: 'STOP' }],
  };
}

/** Coduri de bare unice pentru fiecare rulare (produsele din Open Food Facts sunt comune). */
const code = () => String(randomInt(10 ** 12, 10 ** 13 - 1));

describe('Adaugarea rapida in jurnal (e2e, Open Food Facts si Gemini simulate)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  let off: Server;
  let gemini: Server;
  const emails: string[] = [];
  const offCalls: string[] = [];
  let offDown = false;
  const barcodes = { found: code(), incomplete: code(), missing: code() };
  const http = () => request(app.getHttpServer());
  const today = todayIso();
  const yesterday = addDaysIso(today, -1);

  async function account() {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: 'parola-sigura-1', healthDataConsent: true })
      .expect(201);
    return `Bearer ${res.body.token}`;
  }

  beforeAll(async () => {
    await migrate(() => undefined);
    owner = new pg.Client(dbConfig().owner);
    await owner.connect();

    off = createServer((req: IncomingMessage, res) => {
      const url = req.url ?? '';
      offCalls.push(url);
      res.setHeader('Content-Type', 'application/json');
      if (offDown) {
        res.statusCode = 502;
        res.end('{}');
        return;
      }
      if (url.includes(barcodes.found)) {
        res.end(
          JSON.stringify({
            status: 1,
            product: {
              product_name: 'Iaurt natural 2,5%',
              brands: 'Lactis, Grup',
              serving_quantity: 150,
              image_front_small_url: 'https://images.openfoodfacts.org/x.jpg',
              nutriments: {
                'energy-kcal_100g': 62,
                proteins_100g: 3.6,
                carbohydrates_100g: 4.8,
                fat_100g: 2.5,
              },
            },
          }),
        );
      } else if (url.includes(barcodes.incomplete)) {
        res.end(
          JSON.stringify({ status: 1, product: { product_name: 'Biscuiti', nutriments: {} } }),
        );
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ status: 0 }));
      }
    });
    await new Promise<void>((resolve) => off.listen(0, '127.0.0.1', resolve));
    process.env.OFF_BASE_URL = `http://127.0.0.1:${(off.address() as AddressInfo).port}`;

    gemini = createServer((req: IncomingMessage, res) => {
      let raw = '';
      req.on('data', (chunk) => (raw += chunk));
      req.on('end', () => {
        const body = JSON.parse(raw) as {
          contents: { parts: { text?: string; inlineData?: unknown }[] }[];
        };
        res.setHeader('Content-Type', 'application/json');
        const isImage = body.contents[0].parts.some((p) => p.inlineData);
        const text = body.contents[0].parts.find((p) => p.text)?.text ?? '';
        if (isImage) {
          // Eticheta: valorile la 100 g.
          res.end(
            JSON.stringify(
              geminiReply({
                isLabel: true,
                name: 'Chefir 1%',
                brand: 'JLC',
                kcalPer100: 40,
                proteinPer100: 3,
                carbsPer100: 4,
                fatPer100: 1,
                servingGrams: 0,
              }),
            ),
          );
          return;
        }
        res.end(
          JSON.stringify(
            geminiReply(
              text.includes('masina')
                ? { isFood: false, dish: '', items: [] }
                : {
                    isFood: true,
                    dish: 'Mic dejun cu oua',
                    items: [
                      {
                        name: 'Oua fierte',
                        grams: 100,
                        kcalPer100: 155,
                        proteinPer100: 13,
                        carbsPer100: 1.1,
                        fatPer100: 11,
                        catalogId: '',
                        confidence: 0.8,
                      },
                      {
                        name: 'Paine',
                        grams: 30,
                        kcalPer100: 250,
                        proteinPer100: 9,
                        carbsPer100: 49,
                        fatPer100: 3,
                        catalogId: '',
                        confidence: 0.6,
                      },
                    ],
                  },
            ),
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
    await owner.query('delete from users where email = any($1)', [emails]);
    await owner.query('delete from products where barcode = any($1)', [Object.values(barcodes)]);
    await owner.end();
    await app.close();
    await new Promise((resolve) => off.close(resolve));
    await new Promise((resolve) => gemini.close(resolve));
  });

  it('interpreteaza raspunsul Open Food Facts (kJ, valori imposibile, imagini straine)', () => {
    const fromKj = parseOffProduct('12345678', {
      status: 1,
      product: {
        product_name: 'Suc',
        image_front_small_url: 'https://evil.example/x.jpg',
        nutriments: { energy_100g: 184, proteins_100g: 0, carbohydrates_100g: 10, fat_100g: 0 },
      },
    });
    expect(fromKj.kind).toBe('found');
    if (fromKj.kind === 'found') {
      expect(fromKj.product.per100.kcal).toBe(44);
      expect(fromKj.product.imageUrl).toBeNull();
    }
    const impossible = parseOffProduct('12345678', {
      status: 1,
      product: {
        product_name: 'X',
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 80,
          carbohydrates_100g: 80,
          fat_100g: 0,
        },
      },
    });
    expect(impossible.kind).toBe('incomplete');
    expect(parseOffProduct('12345678', { status: 0 }).kind).toBe('missing');
  });

  it('gaseste produsul dupa codul de bare, il pastreaza local si il adauga in jurnal', async () => {
    const auth = await account();
    const first = await http()
      .get(`/api/products/barcode/${barcodes.found}`)
      .set('Authorization', auth)
      .expect(200);
    expect(first.body).toMatchObject({
      name: 'Iaurt natural 2,5%',
      brand: 'Lactis',
      per100: { kcal: 62, protein: 3.6 },
      servingG: 150,
      source: 'off',
    });

    // A doua scanare (chiar de alt utilizator) foloseste copia locala.
    const callsBefore = offCalls.length;
    const other = await account();
    await http()
      .get(`/api/products/barcode/${barcodes.found}`)
      .set('Authorization', other)
      .expect(200);
    expect(offCalls.length).toBe(callsBefore);

    const entry = await http()
      .post('/api/me/food-log/product')
      .set('Authorization', auth)
      .send({ day: today, meal: 'breakfast', productId: first.body.id, grams: 150 })
      .expect(201);
    expect(entry.body).toMatchObject({
      source: 'product',
      name: 'Iaurt natural 2,5% · Lactis',
      amount: 150,
      kcal: 93,
    });

    const lists = await http().get('/api/me/products').set('Authorization', auth).expect(200);
    expect(lists.body.recent.map((p: { id: string }) => p.id)).toEqual([first.body.id]);
    expect(lists.body.mine).toEqual([]);
  });

  it('raspunde clar pentru produsele negasite, incomplete sau cand serviciul nu raspunde', async () => {
    const auth = await account();
    const missing = await http()
      .get(`/api/products/barcode/${barcodes.missing}`)
      .set('Authorization', auth)
      .expect(404);
    expect(missing.body.code).toBe('product_not_found');

    const incomplete = await http()
      .get(`/api/products/barcode/${barcodes.incomplete}`)
      .set('Authorization', auth)
      .expect(404);
    expect(incomplete.body).toMatchObject({ code: 'product_incomplete', name: 'Biscuiti' });

    offDown = true;
    try {
      const down = await http()
        .get(`/api/products/barcode/${code()}`)
        .set('Authorization', auth)
        .expect(503);
      expect(down.body.code).toBe('products_unavailable');
    } finally {
      offDown = false;
    }
    await http().get('/api/products/barcode/abc').set('Authorization', auth).expect(400);
  });

  it('produsele proprii sunt vizibile doar autorului si au prioritate la scanare', async () => {
    const auth = await account();
    const other = await account();
    const created = await http()
      .post('/api/me/products')
      .set('Authorization', auth)
      .send({
        barcode: barcodes.missing,
        name: 'Placinta cu branza',
        brand: 'Brutaria de langa casa',
        kcal: 280,
        protein: 9,
        carbs: 30,
        fat: 14,
        servingG: 120,
      })
      .expect(201);
    expect(created.body.source).toBe('user');

    const scanned = await http()
      .get(`/api/products/barcode/${barcodes.missing}`)
      .set('Authorization', auth)
      .expect(200);
    expect(scanned.body.id).toBe(created.body.id);

    // Celalalt utilizator nu vede produsul si nu il poate folosi in jurnal.
    await http()
      .get(`/api/products/barcode/${barcodes.missing}`)
      .set('Authorization', other)
      .expect(404);
    await http()
      .post('/api/me/food-log/product')
      .set('Authorization', other)
      .send({ day: today, meal: 'lunch', productId: created.body.id, grams: 100 })
      .expect(404);
    await http()
      .delete(`/api/me/products/${created.body.id}`)
      .set('Authorization', other)
      .expect(404);

    // Acelasi cod de bare actualizeaza produsul, nu creeaza unul nou.
    await http()
      .post('/api/me/products')
      .set('Authorization', auth)
      .send({
        barcode: barcodes.missing,
        name: 'Placinta',
        kcal: 270,
        protein: 9,
        carbs: 30,
        fat: 13,
      })
      .expect(201);
    const lists = await http().get('/api/me/products').set('Authorization', auth).expect(200);
    expect(lists.body.mine).toHaveLength(1);
    expect(lists.body.mine[0]).toMatchObject({ name: 'Placinta', per100: { kcal: 270 } });

    await http()
      .post('/api/me/products')
      .set('Authorization', auth)
      .send({ name: 'Imposibil', kcal: 400, protein: 60, carbs: 50, fat: 10 })
      .expect(400);

    await http()
      .delete(`/api/me/products/${created.body.id}`)
      .set('Authorization', auth)
      .expect(204);
  });

  it('citeste eticheta nutritionala cu AI fara sa salveze produsul', async () => {
    const auth = await account();
    const res = await http()
      .post('/api/me/products/label')
      .set('Authorization', auth)
      .send({ image: IMAGE, mimeType: 'image/jpeg', language: 'ro' })
      .expect(200);
    expect(res.body).toEqual({
      name: 'Chefir 1%',
      brand: 'JLC',
      per100: { kcal: 40, protein: 3, carbs: 4, fat: 1 },
      servingG: null,
    });
    const lists = await http().get('/api/me/products').set('Authorization', auth).expect(200);
    expect(lists.body.mine).toEqual([]);
  });

  it('adauga calorii direct si verifica macronutrientii', async () => {
    const auth = await account();
    const res = await http()
      .post('/api/me/food-log/quick')
      .set('Authorization', auth)
      .send({
        day: today,
        meal: 'dinner',
        name: 'Pizza la restaurant',
        kcal: 850,
        protein: 35,
        fat: 30,
      })
      .expect(201);
    expect(res.body).toMatchObject({
      source: 'quick',
      name: 'Pizza la restaurant',
      kcal: 850,
      protein: 35,
      carbs: 0,
      fat: 30,
    });
    const bad = await http()
      .post('/api/me/food-log/quick')
      .set('Authorization', auth)
      .send({ day: today, meal: 'dinner', kcal: 100, protein: 50 })
      .expect(400);
    expect(bad.body.code).toBe('macros_exceed');
    await http()
      .post('/api/me/food-log/quick')
      .set('Authorization', auth)
      .send({ day: addDaysIso(today, -20), meal: 'dinner', kcal: 100 })
      .expect(400);
  });

  it('copiaza o masa sau ziua de ieri', async () => {
    const auth = await account();
    for (const [meal, foodId, amount] of [
      ['breakfast', 'oats', 60],
      ['breakfast', 'banana', 120],
      ['lunch', 'rice', 80],
    ] as const) {
      await http()
        .post('/api/me/food-log')
        .set('Authorization', auth)
        .send({ day: yesterday, meal, source: 'food', refId: foodId, amount })
        .expect(201);
    }

    const meal = await http()
      .post('/api/me/food-log/copy')
      .set('Authorization', auth)
      .send({ fromDay: yesterday, toDay: today, fromMeal: 'breakfast', toMeal: 'snack' })
      .expect(201);
    expect(meal.body).toHaveLength(2);
    expect(
      meal.body.every((e: { meal: string; day: string }) => e.meal === 'snack' && e.day === today),
    ).toBe(true);

    const day = await http()
      .post('/api/me/food-log/copy')
      .set('Authorization', auth)
      .send({ fromDay: yesterday, toDay: today })
      .expect(201);
    expect(day.body.map((e: { meal: string }) => e.meal).sort()).toEqual([
      'breakfast',
      'breakfast',
      'lunch',
    ]);

    const log = await http()
      .get(`/api/me/food-log?day=${today}`)
      .set('Authorization', auth)
      .expect(200);
    expect(log.body).toHaveLength(5);

    const empty = await http()
      .post('/api/me/food-log/copy')
      .set('Authorization', auth)
      .send({ fromDay: addDaysIso(today, -3), toDay: today })
      .expect(422);
    expect(empty.body.code).toBe('nothing_to_copy');
    await http()
      .post('/api/me/food-log/copy')
      .set('Authorization', auth)
      .send({ fromDay: today, toDay: today, fromMeal: 'lunch' })
      .expect(400);
  });

  it('salveaza o masa si o adauga apoi dintr-o atingere', async () => {
    const auth = await account();
    const other = await account();
    const ids: string[] = [];
    for (const [foodId, amount] of [
      ['oats', 60],
      ['banana', 120],
    ] as const) {
      const res = await http()
        .post('/api/me/food-log')
        .set('Authorization', auth)
        .send({ day: today, meal: 'breakfast', source: 'food', refId: foodId, amount })
        .expect(201);
      ids.push(res.body.id);
    }

    // Inregistrarile altui utilizator nu pot fi salvate.
    await http()
      .post('/api/me/saved-meals')
      .set('Authorization', other)
      .send({ name: 'Furat', entryIds: ids })
      .expect(404);

    const saved = await http()
      .post('/api/me/saved-meals')
      .set('Authorization', auth)
      .send({ name: 'Micul dejun obisnuit', entryIds: ids })
      .expect(201);
    expect(saved.body.items).toHaveLength(2);
    expect(saved.body.total.kcal).toBeGreaterThan(300);

    const logged = await http()
      .post(`/api/me/saved-meals/${saved.body.id}/log`)
      .set('Authorization', auth)
      .send({ day: yesterday, meal: 'breakfast' })
      .expect(201);
    expect(logged.body).toHaveLength(2);
    expect(logged.body[0]).toMatchObject({ day: yesterday, meal: 'breakfast', source: 'food' });

    await http()
      .patch(`/api/me/saved-meals/${saved.body.id}`)
      .set('Authorization', auth)
      .send({ name: 'Ovaz cu banana' })
      .expect(204);
    const list = await http().get('/api/me/saved-meals').set('Authorization', auth).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({ name: 'Ovaz cu banana', uses: 1 });

    await http()
      .post(`/api/me/saved-meals/${saved.body.id}/log`)
      .set('Authorization', other)
      .send({ day: today, meal: 'breakfast' })
      .expect(404);
    await http()
      .delete(`/api/me/saved-meals/${saved.body.id}`)
      .set('Authorization', auth)
      .expect(204);
  });

  it('analizeaza masa descrisa in cuvinte si o salveaza la fel ca o fotografie', async () => {
    const auth = await account();
    const analysis = await http()
      .post('/api/me/food-photo/text')
      .set('Authorization', auth)
      .send({ text: 'doua oua fierte si o felie de paine', language: 'ro' })
      .expect(200);
    expect(analysis.body).toMatchObject({ dish: 'Mic dejun cu oua', isFood: true });
    expect(analysis.body.items).toHaveLength(2);

    const logged = await http()
      .post(`/api/me/food-photo/${analysis.body.id}/log`)
      .set('Authorization', auth)
      .send({
        day: today,
        meal: 'breakfast',
        items: [
          { index: 0, grams: 100 },
          { index: 1, grams: 30 },
        ],
      })
      .expect(201);
    expect(logged.body).toHaveLength(2);
    expect(logged.body[0]).toMatchObject({ name: 'Oua fierte', kcal: 155 });

    const notFood = await http()
      .post('/api/me/food-photo/text')
      .set('Authorization', auth)
      .send({ text: 'am spalat masina', language: 'ro' })
      .expect(422);
    expect(notFood.body.code).toBe('not_food');

    // Cererea fara aliment nu consuma din limita zilnica.
    const { rows } = await owner.query<{ n: number }>(
      `select count(*)::int as n from ai_usage u join users x on x.id = u.user_id
       where x.email = $1 and u.kind = 'chat'`,
      [emails.at(-1)],
    );
    expect(rows[0].n).toBe(1);
  });
});
