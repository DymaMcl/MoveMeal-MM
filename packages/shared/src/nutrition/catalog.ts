import { FOODS, getFood } from './foods.ts';
import { RECIPES } from './recipes.ts';
import type {
  Allergen,
  Diet,
  Food,
  FoodOrigin,
  NutritionPreferences,
  Nutrients,
  Recipe,
} from './types.ts';

const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
  };
}

export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    carbs: n.carbs * factor,
    fat: n.fat * factor,
  };
}

/** Rotunjire pentru afisare: calorii la unitate, macronutrienti la o zecimala. */
export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    protein: Math.round(n.protein * 10) / 10,
    carbs: Math.round(n.carbs * 10) / 10,
    fat: Math.round(n.fat * 10) / 10,
  };
}

/** Valorile nutritionale pentru o cantitate dintr-un aliment. */
export function foodNutrients(food: Food, grams: number): Nutrients {
  return scaleNutrients(food, grams / 100);
}

function ingredientFoods(recipe: Recipe): Food[] {
  return recipe.ingredients.map((i) => {
    const food = getFood(i.foodId);
    if (!food) throw new Error(`Aliment necunoscut in reteta ${recipe.id}: ${i.foodId}`);
    return food;
  });
}

/** Valorile calculate se memoreaza per reteta (retetele nu se modifica dupa creare). */
function memo<T>(compute: (recipe: Recipe) => T): (recipe: Recipe) => T {
  const cache = new WeakMap<Recipe, T>();
  return (recipe) => {
    if (!cache.has(recipe)) cache.set(recipe, compute(recipe));
    return cache.get(recipe)!;
  };
}

/** Valorile nutritionale ale unei portii, calculate din ingrediente. */
export const recipeNutrients = memo((recipe: Recipe): Nutrients =>
  recipe.ingredients.reduce(
    (sum, i) => addNutrients(sum, foodNutrients(getFood(i.foodId)!, i.grams)),
    ZERO,
  ),
);

/** Alergenii retetei, deduși din alergenii ingredientelor. */
export const recipeAllergens = memo((recipe: Recipe): Allergen[] =>
  [...new Set(ingredientFoods(recipe).flatMap((f) => f.allergens))].sort(),
);

const DIET_ALLOWS: Record<Diet, FoodOrigin[]> = {
  omnivore: ['meat', 'fish', 'dairy', 'egg', 'honey', 'plant'],
  pescatarian: ['fish', 'dairy', 'egg', 'honey', 'plant'],
  vegetarian: ['dairy', 'egg', 'honey', 'plant'],
  vegan: ['plant'],
};

export function recipeFitsDiet(recipe: Recipe, diet: Diet): boolean {
  return ingredientFoods(recipe).every((f) => DIET_ALLOWS[diet].includes(f.origin));
}

/** Dietele compatibile cu reteta (pentru etichete). */
export function recipeDiets(recipe: Recipe): Diet[] {
  return (['vegan', 'vegetarian', 'pescatarian', 'omnivore'] as Diet[]).filter((d) =>
    recipeFitsDiet(recipe, d),
  );
}

/** Pretul aproximativ al retetei (1–3), dupa ingredientele principale ca greutate. */
export const recipePrice = memo((recipe: Recipe): 1 | 2 | 3 => {
  const total = recipe.ingredients.reduce((s, i) => s + i.grams, 0);
  const weighted =
    recipe.ingredients.reduce((s, i) => s + getFood(i.foodId)!.price * i.grams, 0) / total;
  return weighted < 1.5 ? 1 : weighted < 2.2 ? 2 : 3;
});

/** Reteta respecta dieta, alergenii si alimentele excluse ale utilizatorului. */
export function recipeAllowed(
  recipe: Recipe,
  prefs: Pick<NutritionPreferences, 'diet' | 'allergens' | 'excludedFoods'>,
): boolean {
  if (!recipeFitsDiet(recipe, prefs.diet)) return false;
  if (recipeAllergens(recipe).some((a) => prefs.allergens.includes(a))) return false;
  return !recipe.ingredients.some((i) => prefs.excludedFoods.includes(i.foodId));
}

const RECIPE_BY_ID = new Map(RECIPES.map((r) => [r.id, r]));

export function getRecipe(id: string): Recipe | undefined {
  return RECIPE_BY_ID.get(id);
}

export interface FoodSubstitute {
  foodId: string;
  /** Cantitatea care pastreaza aproximativ aceleasi calorii. */
  grams: number;
}

/**
 * Inlocuitori pentru un ingredient: alimente din aceeasi categorie, compatibile cu dieta
 * si restrictiile utilizatorului, cu valori nutritionale cat mai apropiate.
 */
export function substituteFoods(
  foodId: string,
  grams: number,
  prefs: Pick<NutritionPreferences, 'diet' | 'allergens' | 'excludedFoods'>,
  count = 3,
): FoodSubstitute[] {
  const original = getFood(foodId);
  if (!original) return [];
  const share = (f: Food) => {
    const total = Math.max(f.kcal, 1);
    return { p: (f.protein * 4) / total, c: (f.carbs * 4) / total, f: (f.fat * 9) / total };
  };
  const o = share(original);
  return FOODS.filter(
    (f) =>
      f.id !== foodId &&
      f.category === original.category &&
      DIET_ALLOWS[prefs.diet].includes(f.origin) &&
      !f.allergens.some((a) => prefs.allergens.includes(a)) &&
      !prefs.excludedFoods.includes(f.id),
  )
    .map((f) => {
      const x = share(f);
      // Distanta dintre profilurile de macronutrienti (proportia caloriilor din fiecare).
      const distance = Math.abs(x.p - o.p) + Math.abs(x.c - o.c) + Math.abs(x.f - o.f);
      return { f, distance };
    })
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count)
    .map(({ f }) => ({
      foodId: f.id,
      grams: Math.max(5, Math.round((grams * original.kcal) / Math.max(f.kcal, 1) / 5) * 5),
    }));
}

export { FOODS, RECIPES };
