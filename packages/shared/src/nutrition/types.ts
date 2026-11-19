/** Cei 14 alergeni principali (Regulamentul UE 1169/2011, anexa II). */
export type Allergen =
  | 'gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'peanuts'
  | 'soy'
  | 'milk'
  | 'nuts'
  | 'celery'
  | 'mustard'
  | 'sesame'
  | 'sulphites'
  | 'lupin'
  | 'molluscs';

export const ALLERGENS: Allergen[] = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
];

export type Diet = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';

/** Originea alimentului, folosita pentru compatibilitatea cu dietele. */
export type FoodOrigin = 'meat' | 'fish' | 'dairy' | 'egg' | 'honey' | 'plant';

/** Categoriile din lista de cumparaturi. */
export type FoodCategory =
  | 'meat_fish'
  | 'dairy_eggs'
  | 'grains'
  | 'legumes'
  | 'vegetables'
  | 'fruits'
  | 'nuts_seeds'
  | 'oils_condiments';

/** Valori nutritionale (la 100 g pentru alimente, pe portie pentru retete). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food extends Nutrients {
  id: string;
  name: { ro: string; en: string };
  category: FoodCategory;
  origin: FoodOrigin;
  allergens: Allergen[];
  /** 1 = accesibil, 2 = mediu, 3 = mai scump. */
  price: 1 | 2 | 3;
  /** Masa unei bucati, in grame (pentru alimentele care se numara: oua, fructe, felii). */
  pieceGrams?: number;
}

export type MealType = 'breakfast' | 'main' | 'snack';

export interface RecipeIngredient {
  foodId: string;
  /** Gramele pentru o portie. */
  grams: number;
}

export interface Recipe {
  id: string;
  name: { ro: string; en: string };
  mealType: MealType;
  minutes: number;
  ingredients: RecipeIngredient[];
  steps: { ro: string[]; en: string[] };
}

export type Budget = 'economic' | 'balanced' | 'flexible';

export interface NutritionPreferences {
  diet: Diet;
  allergens: Allergen[];
  /** Alimente pe care utilizatorul nu le consuma (excluse fara exceptie). */
  excludedFoods: string[];
  /** Alimente preferate (favorizate la alegerea retetelor). */
  preferredFoods: string[];
  budget: Budget;
  mealsPerDay: 3 | 4 | 5;
}

/** Locul unei mese in zi. */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack1' | 'snack2';

export interface PlannedMeal {
  slot: MealSlot;
  recipeId: string;
  /** Intre 0,5 si 2, in trepte de 0,25. */
  portions: number;
  nutrients: Nutrients;
}

export interface PlannedDay {
  /** 0 = luni … 6 = duminica. */
  weekday: number;
  meals: PlannedMeal[];
  totals: Nutrients;
}

export type MealPlanIssue =
  /** Totalul unei zile nu a putut fi adus in ±5% fata de tinta. */
  | 'calories_out_of_range'
  /** Proteinele unei zile sunt sub 90% din tinta. */
  | 'protein_below_target';

export interface MealPlan {
  targetKcal: number;
  targetProtein: number;
  days: PlannedDay[];
  issues: MealPlanIssue[];
}
