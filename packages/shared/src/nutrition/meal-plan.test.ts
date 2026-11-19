import { describe, expect, it } from 'vitest';
import {
  getRecipe,
  recipeAllergens,
  recipeAllowed,
  recipeDiets,
  recipeNutrients,
} from './catalog.ts';
import { FOODS, getFood, searchFoods } from './foods.ts';
import {
  CALORIE_TOLERANCE,
  MAX_RECIPE_USES,
  MEAL_SLOTS,
  generateMealPlan,
  mealAlternatives,
  regenerateDay,
  replaceMeal,
  shoppingList,
  type MealPlanTarget,
} from './meal-plan.ts';
import { RECIPES } from './recipes.ts';
import type { Allergen, Diet, MealPlan, NutritionPreferences } from './types.ts';

const base: NutritionPreferences = {
  diet: 'omnivore',
  allergens: [],
  excludedFoods: [],
  preferredFoods: [],
  budget: 'balanced',
  mealsPerDay: 3,
};
const target: MealPlanTarget = { kcal: 2100, protein: 130 };

function planOf(prefs: Partial<NutritionPreferences>, t = target): MealPlan {
  const result = generateMealPlan({ ...base, ...prefs }, t);
  if (!result.ok) throw new Error(`Plan blocat: ${JSON.stringify(result.blockedBy)}`);
  return result.plan;
}

describe('catalogul de alimente si retete', () => {
  it('toate ingredientele exista in catalog, iar identificatorii sunt unici', () => {
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    for (const r of RECIPES) {
      for (const i of r.ingredients)
        expect(getFood(i.foodId), `${r.id}: ${i.foodId}`).toBeDefined();
      expect(r.steps.ro.length).toBe(r.steps.en.length);
    }
  });

  it('calculeaza valorile nutritionale ale retetei din ingrediente', () => {
    const recipe = getRecipe('oatmeal_banana')!;
    // 60 g ovaz (227,4) + 200 g lapte (94) + 100 g banana (89) + 10 g nuci (65,4)
    expect(recipeNutrients(recipe).kcal).toBeCloseTo(475.8, 1);
  });

  it('deduce alergenii si dietele din ingrediente', () => {
    const recipe = getRecipe('oatmeal_banana')!;
    expect(recipeAllergens(recipe)).toEqual(['gluten', 'milk', 'nuts']);
    expect(recipeDiets(recipe)).toEqual(['vegetarian', 'pescatarian', 'omnivore']);
    expect(recipeDiets(getRecipe('chia_pudding')!)).toContain('vegan');
    expect(recipeDiets(getRecipe('tuna_salad')!)).not.toContain('vegetarian');
  });

  it('cauta alimente in romana sau engleza, fara diacritice', () => {
    expect(searchFoods('branza').map((f) => f.id)).toContain('cottage_cheese');
    expect(searchFoods('chicken')[0].id).toBe('chicken_breast');
    expect(searchFoods('xyz')).toEqual([]);
  });

  it('are suficiente retete pentru fiecare dieta si pentru restrictiile principale', () => {
    for (const diet of ['vegan', 'vegetarian'] as Diet[]) {
      expect(RECIPES.filter((r) => recipeAllowed(r, { ...base, diet })).length).toBeGreaterThan(20);
    }
    for (const allergen of ['gluten', 'milk'] as Allergen[]) {
      const ok = RECIPES.filter((r) => recipeAllowed(r, { ...base, allergens: [allergen] }));
      expect(ok.length).toBeGreaterThan(30);
    }
  });
});

describe('generateMealPlan', () => {
  it('genereaza 7 zile cu numarul de mese ales', () => {
    for (const meals of [3, 4, 5] as const) {
      const plan = planOf({ mealsPerDay: meals });
      expect(plan.days).toHaveLength(7);
      for (const d of plan.days) {
        expect(d.meals.map((m) => m.slot)).toEqual(MEAL_SLOTS[meals].map((s) => s.slot));
      }
    }
  });

  it('scaleaza portiile intre 0,5 si 2, in trepte de 0,25', () => {
    const plan = planOf({ mealsPerDay: 4 });
    for (const m of plan.days.flatMap((d) => d.meals)) {
      expect(m.portions).toBeGreaterThanOrEqual(0.5);
      expect(m.portions).toBeLessThanOrEqual(2);
      expect((m.portions * 4) % 1).toBe(0);
    }
  });

  it('aceeasi reteta apare de cel mult doua ori pe saptamana', () => {
    const plan = planOf({ mealsPerDay: 5 });
    const uses = new Map<string, number>();
    for (const m of plan.days.flatMap((d) => d.meals))
      uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1);
    expect(Math.max(...uses.values())).toBeLessThanOrEqual(MAX_RECIPE_USES);
  });

  it('este determinist pentru acelasi profil', () => {
    expect(planOf({ mealsPerDay: 4 })).toEqual(planOf({ mealsPerDay: 4 }));
  });

  it('pe multe profiluri: fara alergeni sau alimente excluse si cel putin 95% din zile in ±5%', () => {
    const diets: Diet[] = ['omnivore', 'pescatarian', 'vegetarian', 'vegan'];
    const allergenSets: Allergen[][] = [[], ['gluten'], ['milk'], ['eggs'], ['gluten', 'milk']];
    const targets: MealPlanTarget[] = [
      { kcal: 1500, protein: 95 },
      { kcal: 2000, protein: 120 },
      { kcal: 2600, protein: 145 },
    ];
    let days = 0;
    let inRange = 0;
    let profiles = 0;
    for (const diet of diets)
      for (const allergens of allergenSets)
        for (const mealsPerDay of [3, 4, 5] as const)
          for (const t of targets) {
            const excludedFoods = ['mushrooms'];
            const result = generateMealPlan(
              { ...base, diet, allergens, mealsPerDay, excludedFoods },
              t,
            );
            if (!result.ok) continue;
            profiles++;
            for (const d of result.plan.days) {
              days++;
              if (Math.abs(d.totals.kcal - t.kcal) <= t.kcal * CALORIE_TOLERANCE) inRange++;
              for (const m of d.meals) {
                const recipe = getRecipe(m.recipeId)!;
                expect(recipeAllergens(recipe).some((a) => allergens.includes(a))).toBe(false);
                expect(recipe.ingredients.some((i) => excludedFoods.includes(i.foodId))).toBe(
                  false,
                );
                expect(recipeDiets(recipe)).toContain(diet);
              }
            }
          }
    expect(profiles).toBeGreaterThanOrEqual(170);
    expect(inRange / days).toBeGreaterThanOrEqual(0.95);
  });

  it('atinge proteinele pentru un profil omnivor obisnuit', () => {
    const plan = planOf({}, { kcal: 2345, protein: 144 });
    for (const d of plan.days) expect(d.totals.protein).toBeGreaterThanOrEqual(144 * 0.9);
    expect(plan.issues).toEqual([]);
  });

  it('favorizeaza alimentele preferate', () => {
    const count = (plan: MealPlan) =>
      plan.days
        .flatMap((d) => d.meals)
        .filter((m) => getRecipe(m.recipeId)!.ingredients.some((i) => i.foodId === 'salmon'))
        .length;
    expect(count(planOf({ preferredFoods: ['salmon'] }))).toBeGreaterThan(count(planOf({})));
  });

  it('bugetul economic exclude retetele scumpe', () => {
    const plan = planOf({ budget: 'economic' });
    const ids = plan.days.flatMap((d) => d.meals.map((m) => m.recipeId));
    expect(ids).not.toContain('salmon_quinoa');
  });

  it('spune ce restrictie blocheaza planul', () => {
    const allNuts = generateMealPlan(
      {
        ...base,
        diet: 'vegan',
        allergens: ['soy', 'gluten', 'nuts', 'peanuts', 'sesame'],
        mealsPerDay: 5,
      },
      target,
    );
    expect(allNuts.ok).toBe(false);
    if (!allNuts.ok) expect(allNuts.blockedBy).not.toBeNull();
  });
});

describe('modificarea planului', () => {
  const prefs = { ...base, mealsPerDay: 4 as const };
  const plan = planOf(prefs);

  it('propune cel putin trei alternative compatibile pentru o masa', () => {
    const current = plan.days[0].meals.find((m) => m.slot === 'lunch')!;
    const alternatives = mealAlternatives(plan, 0, 'lunch', prefs);
    expect(alternatives.length).toBeGreaterThanOrEqual(3);
    for (const alt of alternatives) {
      expect(alt.recipeId).not.toBe(current.recipeId);
      expect(getRecipe(alt.recipeId)!.mealType).toBe('main');
      expect(Math.abs(alt.nutrients.kcal - current.nutrients.kcal)).toBeLessThan(
        current.nutrients.kcal * 0.3,
      );
    }
  });

  it('inlocuieste o masa si recalculeaza totalul zilei', () => {
    const alt = mealAlternatives(plan, 2, 'dinner', prefs)[0];
    const updated = replaceMeal(plan, 2, alt);
    const day = updated.days[2];
    expect(day.meals.find((m) => m.slot === 'dinner')!.recipeId).toBe(alt.recipeId);
    expect(day.totals.kcal).toBe(Math.round(day.meals.reduce((s, m) => s + m.nutrients.kcal, 0)));
  });

  it('regenereaza o singura zi si pastreaza celelalte', () => {
    const updated = regenerateDay(plan, 3, prefs, 7);
    expect(updated.days.filter((d) => d.weekday !== 3)).toEqual(
      plan.days.filter((d) => d.weekday !== 3),
    );
    const uses = new Map<string, number>();
    for (const m of updated.days.flatMap((d) => d.meals))
      uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1);
    expect(Math.max(...uses.values())).toBeLessThanOrEqual(MAX_RECIPE_USES);
  });

  it('lista de cumparaturi insumeaza ingredientele pe categorii', () => {
    const list = shoppingList(plan);
    const all = Object.values(list).flat();
    expect(all.length).toBeGreaterThan(10);
    for (const [category, items] of Object.entries(list)) {
      for (const item of items!) expect(getFood(item.foodId)!.category).toBe(category);
    }
    // Totalul de ovaz din lista acopera toate portiile din plan.
    const oats = plan.days
      .flatMap((d) => d.meals)
      .reduce((s, m) => {
        const g = getRecipe(m.recipeId)!.ingredients.find((i) => i.foodId === 'oats')?.grams ?? 0;
        return s + g * m.portions;
      }, 0);
    const listed = all.find((i) => i.foodId === 'oats')?.grams ?? 0;
    expect(listed).toBeGreaterThanOrEqual(oats);
  });
});

describe('substituteFoods', () => {
  it('propune inlocuitori din aceeasi categorie, compatibili cu dieta', async () => {
    const { substituteFoods } = await import('./catalog.ts');
    const subs = substituteFoods('chicken_breast', 150, {
      diet: 'omnivore',
      allergens: [],
      excludedFoods: [],
    });
    expect(subs.length).toBe(3);
    for (const s of subs) expect(getFood(s.foodId)!.category).toBe('meat_fish');
    expect(subs.map((s) => s.foodId)).toContain('turkey_breast');

    const vegan = substituteFoods('milk', 200, { diet: 'vegan', allergens: [], excludedFoods: [] });
    expect(vegan.every((s) => getFood(s.foodId)!.origin === 'plant')).toBe(true);
  });
});
