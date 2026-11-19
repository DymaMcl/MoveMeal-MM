import {
  addNutrients,
  getRecipe,
  recipeAllowed,
  recipeNutrients,
  recipePrice,
  roundNutrients,
  scaleNutrients,
} from './catalog.ts';
import { getFood } from './foods.ts';
import { RECIPES } from './recipes.ts';
import type {
  Allergen,
  FoodCategory,
  MealPlan,
  MealPlanIssue,
  MealSlot,
  MealType,
  NutritionPreferences,
  Nutrients,
  PlannedDay,
  PlannedMeal,
  Recipe,
} from './types.ts';

/** Impartirea tintei calorice pe mese (Laboratorul 2). */
export const MEAL_SLOTS: Record<3 | 4 | 5, { slot: MealSlot; share: number }[]> = {
  3: [
    { slot: 'breakfast', share: 0.3 },
    { slot: 'lunch', share: 0.4 },
    { slot: 'dinner', share: 0.3 },
  ],
  4: [
    { slot: 'breakfast', share: 0.25 },
    { slot: 'lunch', share: 0.35 },
    { slot: 'snack1', share: 0.1 },
    { slot: 'dinner', share: 0.3 },
  ],
  5: [
    { slot: 'breakfast', share: 0.25 },
    { slot: 'snack1', share: 0.1 },
    { slot: 'lunch', share: 0.3 },
    { slot: 'snack2', share: 0.1 },
    { slot: 'dinner', share: 0.25 },
  ],
};

export const SLOT_MEAL_TYPE: Record<MealSlot, MealType> = {
  breakfast: 'breakfast',
  lunch: 'main',
  dinner: 'main',
  snack1: 'snack',
  snack2: 'snack',
};

export const MIN_PORTIONS = 0.5;
export const MAX_PORTIONS = 2;
const PORTION_STEP = 0.25;
/** Toleranta pentru totalul zilnic de calorii. */
export const CALORIE_TOLERANCE = 0.05;
/** Proteinele trebuie sa atinga cel putin acest procent din tinta. */
export const PROTEIN_MIN_SHARE = 0.9;
/** O reteta poate aparea de cel mult atatea ori pe saptamana. */
export const MAX_RECIPE_USES = 2;
const ATTEMPTS_PER_DAY = 150;

export interface MealPlanTarget {
  kcal: number;
  protein: number;
  /**
   * Limita superioara pentru proteine, in grame (tabelul 1.2: cel mult 2,0 g/kg).
   * Implicit: tinta × 1,4.
   */
  proteinMax?: number;
}

const DEFAULT_PROTEIN_MAX_FACTOR = 1.4;

export type BlockingRestriction =
  | { kind: 'diet' }
  | { kind: 'allergen'; allergen: Allergen }
  | { kind: 'excluded_foods' }
  | { kind: 'budget' };

export type MealPlanResult =
  { ok: true; plan: MealPlan } | { ok: false; blockedBy: BlockingRestriction | null };

// ---------------------------------------------------------------------------

/** Generator pseudo-aleator determinist (acelasi profil → acelasi plan). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clampPortions = (p: number) =>
  Math.min(MAX_PORTIONS, Math.max(MIN_PORTIONS, Math.round(p / PORTION_STEP) * PORTION_STEP));

function withinBudget(recipe: Recipe, prefs: NutritionPreferences): boolean {
  return prefs.budget !== 'economic' || recipePrice(recipe) < 3;
}

/** Retetele permise, grupate pe tipul mesei. */
function candidatesByType(prefs: NutritionPreferences): Record<MealType, Recipe[]> {
  const allowed = RECIPES.filter((r) => recipeAllowed(r, prefs) && withinBudget(r, prefs));
  return {
    breakfast: allowed.filter((r) => r.mealType === 'breakfast'),
    main: allowed.filter((r) => r.mealType === 'main'),
    snack: allowed.filter((r) => r.mealType === 'snack'),
  };
}

/** Cate retete diferite sunt necesare pentru fiecare tip de masa intr-o saptamana. */
function requiredRecipes(mealsPerDay: 3 | 4 | 5): Record<MealType, number> {
  const perDay: Record<MealType, number> = { breakfast: 0, main: 0, snack: 0 };
  for (const { slot } of MEAL_SLOTS[mealsPerDay]) perDay[SLOT_MEAL_TYPE[slot]] += 1;
  return {
    breakfast: Math.ceil((perDay.breakfast * 7) / MAX_RECIPE_USES),
    main: Math.ceil((perDay.main * 7) / MAX_RECIPE_USES),
    snack: Math.ceil((perDay.snack * 7) / MAX_RECIPE_USES),
  };
}

function hasEnoughRecipes(prefs: NutritionPreferences): boolean {
  const pool = candidatesByType(prefs);
  const needed = requiredRecipes(prefs.mealsPerDay);
  return (Object.keys(needed) as MealType[]).every((t) => pool[t].length >= needed[t]);
}

/** Restrictia care, daca ar fi relaxata, ar permite alcatuirea planului. */
export function findBlockingRestriction(prefs: NutritionPreferences): BlockingRestriction | null {
  if (prefs.budget === 'economic' && hasEnoughRecipes({ ...prefs, budget: 'flexible' })) {
    return { kind: 'budget' };
  }
  if (prefs.excludedFoods.length > 0 && hasEnoughRecipes({ ...prefs, excludedFoods: [] })) {
    return { kind: 'excluded_foods' };
  }
  for (const allergen of prefs.allergens) {
    const relaxed = { ...prefs, allergens: prefs.allergens.filter((a) => a !== allergen) };
    if (hasEnoughRecipes(relaxed)) return { kind: 'allergen', allergen };
  }
  // Dieta se relaxeaza treptat (vegana → vegetariana → pescetariana → omnivora).
  const steps: NutritionPreferences['diet'][] = ['vegan', 'vegetarian', 'pescatarian', 'omnivore'];
  for (const diet of steps.slice(steps.indexOf(prefs.diet) + 1)) {
    if (hasEnoughRecipes({ ...prefs, diet })) return { kind: 'diet' };
  }
  // Mai multe restrictii impreuna: se indica primul alergen (cel mai des intalnit in retete).
  if (prefs.allergens.length > 0 && hasEnoughRecipes({ ...prefs, allergens: [] })) {
    return { kind: 'allergen', allergen: prefs.allergens[0] };
  }
  return null;
}

// ---------------------------------------------------------------------------

interface Slot {
  slot: MealSlot;
  target: number;
}

function preferenceScore(recipe: Recipe, prefs: NutritionPreferences): number {
  const favourite = recipe.ingredients.some((i) => prefs.preferredFoods.includes(i.foodId));
  const price = recipePrice(recipe);
  const budgetFit =
    prefs.budget === 'economic'
      ? price === 1
        ? 1
        : 0.5
      : prefs.budget === 'balanced'
        ? price === 3
          ? 0.6
          : 1
        : 1;
  return (favourite ? 3 : 1) * budgetFit;
}

/** Alege portiile (0,5–2) pentru ca totalul sa se apropie de tinta zilei. */
function fitPortions(recipes: Recipe[], slots: Slot[], dayTarget: number): number[] {
  const kcal = recipes.map((r) => recipeNutrients(r).kcal);
  const portions = recipes.map((_, i) => clampPortions(slots[i].target / kcal[i]));
  const total = () => portions.reduce((s, p, i) => s + p * kcal[i], 0);

  for (let guard = 0; guard < 40; guard++) {
    const error = total() - dayTarget;
    if (Math.abs(error) <= dayTarget * 0.01) break;
    // Pasul care reduce cel mai mult abaterea, preferand masa cea mai departe de tinta ei.
    let best = -1;
    let bestError = Math.abs(error);
    for (let i = 0; i < portions.length; i++) {
      const next = portions[i] + (error > 0 ? -PORTION_STEP : PORTION_STEP);
      if (next < MIN_PORTIONS || next > MAX_PORTIONS) continue;
      const newError = Math.abs(error + (next - portions[i]) * kcal[i]);
      if (newError < bestError - 1e-9) {
        bestError = newError;
        best = i;
      }
    }
    if (best < 0) break;
    portions[best] += error > 0 ? -PORTION_STEP : PORTION_STEP;
  }
  return portions;
}

function buildMeals(recipes: Recipe[], slots: Slot[], portions: number[]): PlannedMeal[] {
  return recipes.map((r, i) => ({
    slot: slots[i].slot,
    recipeId: r.id,
    portions: portions[i],
    nutrients: roundNutrients(scaleNutrients(recipeNutrients(r), portions[i])),
  }));
}

function totalsOf(meals: PlannedMeal[]): Nutrients {
  return roundNutrients(
    meals.reduce((s, m) => addNutrients(s, m.nutrients), { kcal: 0, protein: 0, carbs: 0, fat: 0 }),
  );
}

/** Scorul unei zile: abaterea calorica, deficitul de proteine si preferintele. */
function dayScore(totals: Nutrients, target: MealPlanTarget, preference: number): number {
  const calorieError = Math.abs(totals.kcal - target.kcal) / target.kcal;
  const proteinShortfall = Math.max(0, PROTEIN_MIN_SHARE - totals.protein / target.protein);
  const proteinMax = target.proteinMax ?? target.protein * DEFAULT_PROTEIN_MAX_FACTOR;
  const proteinExcess = Math.max(0, totals.protein / proteinMax - 1);
  const caloriePenalty =
    calorieError > CALORIE_TOLERANCE ? 10 + calorieError * 100 : calorieError * 10;
  return caloriePenalty + proteinShortfall * 30 + proteinExcess * 30 - preference * 0.3;
}

function weightedPick(list: Recipe[], weight: (r: Recipe) => number, random: () => number): Recipe {
  const weights = list.map(weight);
  const sum = weights.reduce((a, b) => a + b, 0);
  let x = random() * sum;
  for (let i = 0; i < list.length; i++) {
    x -= weights[i];
    if (x <= 0) return list[i];
  }
  return list[list.length - 1];
}

function planDay(
  weekday: number,
  prefs: NutritionPreferences,
  target: MealPlanTarget,
  pool: Record<MealType, Recipe[]>,
  uses: Map<string, number>,
  random: () => number,
): PlannedDay | null {
  const slots: Slot[] = MEAL_SLOTS[prefs.mealsPerDay].map((s) => ({
    slot: s.slot,
    target: target.kcal * s.share,
  }));
  const proteinDensity = (r: Recipe) => {
    const n = recipeNutrients(r);
    return (n.protein * 4) / Math.max(n.kcal, 1);
  };

  let best: { meals: PlannedMeal[]; score: number } | null = null;
  for (let attempt = 0; attempt < ATTEMPTS_PER_DAY; attempt++) {
    const chosen: Recipe[] = [];
    for (const slot of slots) {
      const options = pool[SLOT_MEAL_TYPE[slot.slot]].filter(
        (r) => (uses.get(r.id) ?? 0) < MAX_RECIPE_USES && !chosen.includes(r),
      );
      if (options.length === 0) break;
      // Retetele preferate si cele bogate in proteine au sanse mai mari.
      chosen.push(
        weightedPick(
          options,
          (r) => preferenceScore(r, prefs) * (0.4 + proteinDensity(r) * 4),
          random,
        ),
      );
    }
    if (chosen.length < slots.length) continue;

    const portions = fitPortions(chosen, slots, target.kcal);
    const meals = buildMeals(chosen, slots, portions);
    const preference = chosen.reduce((s, r) => s + preferenceScore(r, prefs), 0) / chosen.length;
    const score = dayScore(totalsOf(meals), target, preference);
    if (!best || score < best.score) best = { meals, score };
  }
  if (!best) return null;
  for (const m of best.meals) uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1);
  return { weekday, meals: best.meals, totals: totalsOf(best.meals) };
}

function issuesOf(days: PlannedDay[], target: MealPlanTarget): MealPlanIssue[] {
  const issues = new Set<MealPlanIssue>();
  for (const d of days) {
    if (Math.abs(d.totals.kcal - target.kcal) > target.kcal * CALORIE_TOLERANCE) {
      issues.add('calories_out_of_range');
    }
    if (d.totals.protein < target.protein * PROTEIN_MIN_SHARE) issues.add('protein_below_target');
    const max = target.proteinMax ?? target.protein * DEFAULT_PROTEIN_MAX_FACTOR;
    if (d.totals.protein > max) issues.add('protein_above_limit');
  }
  return [...issues];
}

function seedFor(prefs: NutritionPreferences, target: MealPlanTarget, salt: number): number {
  return hashString(JSON.stringify({ prefs, target, salt }));
}

/**
 * Genereaza planul pe 7 zile. Alergenii si alimentele excluse nu apar niciodata;
 * daca restrictiile nu permit un plan, se intoarce restrictia care il blocheaza.
 */
export function generateMealPlan(
  prefs: NutritionPreferences,
  target: MealPlanTarget,
  salt = 0,
): MealPlanResult {
  if (!hasEnoughRecipes(prefs)) return { ok: false, blockedBy: findBlockingRestriction(prefs) };
  const pool = candidatesByType(prefs);
  const random = mulberry32(seedFor(prefs, target, salt));
  const uses = new Map<string, number>();
  const days: PlannedDay[] = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    const day = planDay(weekday, prefs, target, pool, uses, random);
    if (!day) return { ok: false, blockedBy: findBlockingRestriction(prefs) };
    days.push(day);
  }
  return {
    ok: true,
    plan: {
      targetKcal: Math.round(target.kcal),
      targetProtein: Math.round(target.protein),
      ...(target.proteinMax ? { targetProteinMax: Math.round(target.proteinMax) } : {}),
      days,
      issues: issuesOf(days, target),
    },
  };
}

/** Regenereaza o singura zi, pastrand limita de doua aparitii pe saptamana pentru celelalte zile. */
export function regenerateDay(
  plan: MealPlan,
  weekday: number,
  prefs: NutritionPreferences,
  salt: number,
): MealPlan {
  const target = {
    kcal: plan.targetKcal,
    protein: plan.targetProtein,
    proteinMax: plan.targetProteinMax,
  };
  const uses = new Map<string, number>();
  for (const d of plan.days) {
    if (d.weekday === weekday) continue;
    for (const m of d.meals) uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1);
  }
  const random = mulberry32(seedFor(prefs, target, salt * 31 + weekday));
  const day = planDay(weekday, prefs, target, candidatesByType(prefs), uses, random);
  if (!day) return plan;
  const days = plan.days.map((d) => (d.weekday === weekday ? day : d));
  return { ...plan, days, issues: issuesOf(days, target) };
}

/**
 * Cel putin trei alternative pentru o masa: retete compatibile de acelasi tip,
 * scalate pentru a pastra aproximativ aceleasi calorii.
 */
export function mealAlternatives(
  plan: MealPlan,
  weekday: number,
  slot: MealSlot,
  prefs: NutritionPreferences,
  count = 3,
): PlannedMeal[] {
  const day = plan.days.find((d) => d.weekday === weekday);
  const current = day?.meals.find((m) => m.slot === slot);
  if (!day || !current) return [];
  const uses = new Map<string, number>();
  for (const d of plan.days)
    for (const m of d.meals) uses.set(m.recipeId, (uses.get(m.recipeId) ?? 0) + 1);
  const inDay = new Set(day.meals.map((m) => m.recipeId));

  return candidatesByType(prefs)
    [SLOT_MEAL_TYPE[slot]].filter(
      (r) => !inDay.has(r.id) && (uses.get(r.id) ?? 0) < MAX_RECIPE_USES,
    )
    .map((r) => {
      const portions = clampPortions(current.nutrients.kcal / recipeNutrients(r).kcal);
      const nutrients = roundNutrients(scaleNutrients(recipeNutrients(r), portions));
      return { slot, recipeId: r.id, portions, nutrients };
    })
    .sort(
      (a, b) =>
        Math.abs(a.nutrients.kcal - current.nutrients.kcal) -
          Math.abs(b.nutrients.kcal - current.nutrients.kcal) ||
        b.nutrients.protein - a.nutrients.protein,
    )
    .slice(0, count);
}

/** Inlocuieste o masa si recalculeaza totalurile zilei. */
export function replaceMeal(plan: MealPlan, weekday: number, meal: PlannedMeal): MealPlan {
  const target = {
    kcal: plan.targetKcal,
    protein: plan.targetProtein,
    proteinMax: plan.targetProteinMax,
  };
  const days = plan.days.map((d) => {
    if (d.weekday !== weekday) return d;
    const meals = d.meals.map((m) => (m.slot === meal.slot ? meal : m));
    return { ...d, meals, totals: totalsOf(meals) };
  });
  return { ...plan, days, issues: issuesOf(days, target) };
}

export interface ShoppingItem {
  foodId: string;
  grams: number;
}

/** Lista de cumparaturi a saptamanii: ingredientele insumate in grame, grupate pe categorii. */
export function shoppingList(plan: MealPlan): Partial<Record<FoodCategory, ShoppingItem[]>> {
  const grams = new Map<string, number>();
  for (const day of plan.days) {
    for (const meal of day.meals) {
      const recipe = getRecipe(meal.recipeId);
      if (!recipe) continue;
      for (const i of recipe.ingredients) {
        grams.set(i.foodId, (grams.get(i.foodId) ?? 0) + i.grams * meal.portions);
      }
    }
  }
  const groups: Partial<Record<FoodCategory, ShoppingItem[]>> = {};
  for (const [foodId, total] of grams) {
    const category = getFood(foodId)!.category;
    (groups[category] ??= []).push({ foodId, grams: Math.ceil(total / 10) * 10 });
  }
  for (const list of Object.values(groups)) list!.sort((a, b) => b.grams - a.grams);
  return groups;
}
