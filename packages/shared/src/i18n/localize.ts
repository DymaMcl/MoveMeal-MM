import type { Food, Recipe } from '../nutrition/types.ts';
import type { Exercise } from '../workout/types.ts';
import { RU_EXERCISES, RU_FOODS, RU_RECIPES } from './ru-catalog.ts';

/** Limbile in care este disponibil continutul catalogului. */
export type ContentLanguage = 'ro' | 'en' | 'ru';

/** Denumirea unui aliment in limba data (cu engleza ca rezerva). */
export function foodName(food: Food, lang: ContentLanguage): string {
  if (lang === 'ru') return RU_FOODS[food.id] ?? food.name.en;
  return food.name[lang];
}

export function recipeName(recipe: Recipe, lang: ContentLanguage): string {
  if (lang === 'ru') return RU_RECIPES[recipe.id]?.name ?? recipe.name.en;
  return recipe.name[lang];
}

export function recipeSteps(recipe: Recipe, lang: ContentLanguage): string[] {
  if (lang === 'ru') return RU_RECIPES[recipe.id]?.steps ?? recipe.steps.en;
  return recipe.steps[lang];
}

export function exerciseName(exercise: Exercise, lang: ContentLanguage): string {
  if (lang === 'ru') return RU_EXERCISES[exercise.id]?.name ?? exercise.name.en;
  return exercise.name[lang];
}

export function exerciseSteps(exercise: Exercise, lang: ContentLanguage): string[] {
  if (lang === 'ru') return RU_EXERCISES[exercise.id]?.steps ?? exercise.steps.en;
  return exercise.steps[lang];
}
