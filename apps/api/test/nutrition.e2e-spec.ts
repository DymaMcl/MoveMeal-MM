import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRecipe, recipeAllergens } from '@movemeal/shared';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { addDaysIso, todayIso, weekdayOfIso } from '../src/common/dates.js';
import { dbConfig } from '../src/config.js';
import { migrate } from '../src/database/migrate.js';

const preferences = {
  diet: 'vegetarian',
  allergens: ['nuts'],
  excludedFoods: ['mushrooms'],
  preferredFoods: [],
  budget: 'balanced',
  mealsPerDay: 4,
};

describe('Plan alimentar, jurnal si progres (e2e)', () => {
  let app: INestApplication<App>;
  let owner: pg.Client;
  const emails: string[] = [];
  const http = () => request(app.getHttpServer());

  async function user(goal = 'lose') {
    const email = `test-${randomUUID()}@movemeal.test`;
    emails.push(email);
    const res = await http()
      .post('/api/auth/register')
      .send({ email, password: 'parola-sigura-1', healthDataConsent: true })
      .expect(201);
    const auth = `Bearer ${res.body.token}`;
    await http()
      .put('/api/me/profile')
      .set('Authorization', auth)
      .send({
        name: 'Ana',
        age: 30,
        sex: 'male',
        heightCm: 180,
        weightKg: 80,
        activityLevel: 'moderate',
        goal,
        ...(goal === 'lose' ? { targetWeightKg: 74, weeks: 16 } : {}),
      })
      .expect(200);
    return auth;
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

  it('genereaza planul fara alergeni si alimente excluse', async () => {
    const auth = await user();
    await http().get('/api/me/nutrition').set('Authorization', auth).expect(404);
    const res = await http()
      .put('/api/me/nutrition/preferences')
      .set('Authorization', auth)
      .send(preferences)
      .expect(200);
    const plan = res.body.plan;
    expect(plan.days).toHaveLength(7);
    for (const meal of plan.days.flatMap((d: { meals: { recipeId: string }[] }) => d.meals)) {
      const recipe = getRecipe(meal.recipeId)!;
      expect(recipeAllergens(recipe)).not.toContain('nuts');
      expect(recipe.ingredients.map((i) => i.foodId)).not.toContain('mushrooms');
    }
  });

  it('indica restrictia care blocheaza planul', async () => {
    const auth = await user();
    const res = await http()
      .put('/api/me/nutrition/preferences')
      .set('Authorization', auth)
      .send({
        ...preferences,
        diet: 'vegan',
        allergens: ['soy', 'gluten', 'nuts', 'peanuts', 'sesame'],
        mealsPerDay: 5,
      })
      .expect(422);
    expect(res.body.blockedBy).toBeTruthy();
  });

  it('inlocuieste o masa cu o alternativa si regenereaza o zi', async () => {
    const auth = await user();
    const first = await http()
      .put('/api/me/nutrition/preferences')
      .set('Authorization', auth)
      .send(preferences)
      .expect(200);
    const alternatives = await http()
      .get('/api/me/nutrition/alternatives?weekday=1&slot=lunch')
      .set('Authorization', auth)
      .expect(200);
    expect(alternatives.body.length).toBeGreaterThanOrEqual(3);

    const chosen = alternatives.body[0].recipeId;
    const replaced = await http()
      .put('/api/me/nutrition/meal')
      .set('Authorization', auth)
      .send({ weekday: 1, slot: 'lunch', recipeId: chosen })
      .expect(200);
    const lunch = replaced.body.plan.days[1].meals.find(
      (m: { slot: string }) => m.slot === 'lunch',
    );
    expect(lunch.recipeId).toBe(chosen);

    // O reteta incompatibila (cu carne, pentru un vegetarian) este refuzata.
    await http()
      .put('/api/me/nutrition/meal')
      .set('Authorization', auth)
      .send({ weekday: 1, slot: 'lunch', recipeId: 'chicken_rice_broccoli' })
      .expect(400);

    const regenerated = await http()
      .post('/api/me/nutrition/regenerate')
      .set('Authorization', auth)
      .send({ weekday: 3 })
      .expect(200);
    expect(regenerated.body.plan.days[0]).toEqual(first.body.plan.days[0]);

    const list = await http()
      .get('/api/me/nutrition/shopping-list')
      .set('Authorization', auth)
      .expect(200);
    expect(Object.keys(list.body).length).toBeGreaterThan(3);
  });

  it('jurnalul calculeaza valorile pe server si marcheaza mesele „mancate”', async () => {
    const auth = await user();
    await http()
      .put('/api/me/nutrition/preferences')
      .set('Authorization', auth)
      .send(preferences)
      .expect(200);
    const today = todayIso();

    const entry = await http()
      .post('/api/me/food-log')
      .set('Authorization', auth)
      .send({ day: today, meal: 'snack', source: 'food', refId: 'banana', amount: 120 })
      .expect(201);
    expect(entry.body.kcal).toBe(107); // 120 g x 89 kcal/100 g = 106,8 → 107

    const eaten = await http()
      .post('/api/me/food-log/planned')
      .set('Authorization', auth)
      .send({ day: today, slot: 'breakfast' })
      .expect(201);
    expect(eaten.body.source).toBe('recipe');
    await http()
      .post('/api/me/food-log/planned')
      .set('Authorization', auth)
      .send({ day: today, slot: 'breakfast' })
      .expect(409);

    const day = await http()
      .get(`/api/me/food-log?day=${today}`)
      .set('Authorization', auth)
      .expect(200);
    expect(day.body).toHaveLength(2);

    const recent = await http()
      .get('/api/me/food-log/recent-foods')
      .set('Authorization', auth)
      .expect(200);
    expect(recent.body).toEqual(['banana']);

    await http().delete(`/api/me/food-log/${entry.body.id}`).set('Authorization', auth).expect(204);

    // Nu se pot adauga inregistrari mai vechi de 14 zile sau din viitor.
    for (const d of [addDaysIso(today, -14), addDaysIso(today, 1)]) {
      await http()
        .post('/api/me/food-log')
        .set('Authorization', auth)
        .send({ day: d, meal: 'snack', source: 'food', refId: 'apple', amount: 100 })
        .expect(400);
    }
  });

  it('greutatea si apa: o valoare pe zi, care poate fi corectata', async () => {
    const auth = await user();
    const today = todayIso();
    await http()
      .put('/api/me/measurements')
      .set('Authorization', auth)
      .send({ day: today, weightKg: 80.4 })
      .expect(204);
    await http()
      .put('/api/me/measurements')
      .set('Authorization', auth)
      .send({ day: today, weightKg: 80.1 })
      .expect(204);
    const list = await http()
      .get('/api/me/measurements?weeks=4')
      .set('Authorization', auth)
      .expect(200);
    expect(list.body).toEqual([{ day: today, weightKg: 80.1, waistCm: null, average7: 80.1 }]);

    await http()
      .put('/api/me/water')
      .set('Authorization', auth)
      .send({ day: today, ml: 750 })
      .expect(204);
    const water = await http()
      .get(`/api/me/water?day=${today}`)
      .set('Authorization', auth)
      .expect(200);
    expect(water.body.ml).toBe(750);
  });

  it('progres: date insuficiente, apoi propunere de ajustare si acceptare', async () => {
    const auth = await user('lose');
    const insufficient = await http()
      .get('/api/me/progress')
      .set('Authorization', auth)
      .expect(200);
    expect(insufficient.body.analysis.status).toBe('insufficient_data');

    // 14 zile cu greutatea aproape constanta (slabire prea lenta) si jurnal complet.
    const today = todayIso();
    for (let i = 13; i >= 0; i--) {
      const day = addDaysIso(today, -i);
      await http()
        .put('/api/me/measurements')
        .set('Authorization', auth)
        .send({ day, weightKg: 80 })
        .expect(204);
      await http()
        .post('/api/me/food-log')
        .set('Authorization', auth)
        .send({ day, meal: 'lunch', source: 'food', refId: 'rice', amount: 100 })
        .expect(201);
    }

    const before = await http().get('/api/me/profile').set('Authorization', auth).expect(200);
    const progress = await http().get('/api/me/progress').set('Authorization', auth).expect(200);
    expect(progress.body.analysis.status).toBe('adjust');
    expect(progress.body.analysis.direction).toBe('decrease');
    expect(progress.body.analysis.currentTarget).toBe(before.body.plan.targetCalories);

    const accepted = await http()
      .post('/api/me/progress/adjustment/accept')
      .set('Authorization', auth)
      .expect(200);
    expect(accepted.body.targetCalories).toBe(progress.body.analysis.proposedTarget);

    const after = await http().get('/api/me/profile').set('Authorization', auth).expect(200);
    expect(after.body.plan.targetCalories).toBe(accepted.body.targetCalories);
    expect(after.body.adjusted).toBe(true);

    // Cel mult o ajustare la 14 zile.
    await http().post('/api/me/progress/adjustment/accept').set('Authorization', auth).expect(409);
    const again = await http().get('/api/me/progress').set('Authorization', auth).expect(200);
    expect(again.body.analysis.status).not.toBe('adjust');
    expect(weekdayOfIso(today)).toBeGreaterThanOrEqual(0);
  });
});
