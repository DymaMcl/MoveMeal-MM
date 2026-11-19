import { describe, expect, it } from 'vitest';
import { FOODS } from '../nutrition/foods.ts';
import { RECIPES } from '../nutrition/recipes.ts';
import { EXERCISES } from '../workout/exercises.ts';
import { exerciseName, exerciseSteps, foodName, recipeName, recipeSteps } from './localize.ts';
import { RU_EXERCISES, RU_FOODS, RU_RECIPES } from './ru-catalog.ts';

describe('traducerea catalogului in rusa', () => {
  it('fiecare aliment, reteta si exercitiu are denumire in rusa', () => {
    for (const f of FOODS) expect(RU_FOODS[f.id], f.id).toBeTruthy();
    for (const r of RECIPES) expect(RU_RECIPES[r.id]?.name, r.id).toBeTruthy();
    for (const e of EXERCISES) expect(RU_EXERCISES[e.id]?.name, e.id).toBeTruthy();
  });

  it('pasii au acelasi numar ca in romana', () => {
    for (const r of RECIPES) expect(RU_RECIPES[r.id].steps.length, r.id).toBe(r.steps.ro.length);
    for (const e of EXERCISES)
      expect(RU_EXERCISES[e.id].steps.length, e.id).toBe(e.steps.ro.length);
  });

  it('nu exista traduceri pentru elemente inexistente', () => {
    const foods = new Set(FOODS.map((f) => f.id));
    const recipes = new Set(RECIPES.map((r) => r.id));
    const exercises = new Set(EXERCISES.map((e) => e.id));
    for (const id of Object.keys(RU_FOODS)) expect(foods.has(id), id).toBe(true);
    for (const id of Object.keys(RU_RECIPES)) expect(recipes.has(id), id).toBe(true);
    for (const id of Object.keys(RU_EXERCISES)) expect(exercises.has(id), id).toBe(true);
  });

  it('alege limba ceruta', () => {
    const egg = FOODS.find((f) => f.id === 'eggs')!;
    expect(foodName(egg, 'ro')).toBe('Ou de găină');
    expect(foodName(egg, 'en')).toBe('Chicken egg');
    expect(foodName(egg, 'ru')).toBe('Куриное яйцо');
    const recipe = RECIPES[0];
    expect(recipeName(recipe, 'ru')).toBe(RU_RECIPES[recipe.id].name);
    expect(recipeSteps(recipe, 'en')).toEqual(recipe.steps.en);
    const exercise = EXERCISES[0];
    expect(exerciseName(exercise, 'ru')).toBe('Отжимания');
    expect(exerciseSteps(exercise, 'ru')).toHaveLength(exercise.steps.ro.length);
  });
});
