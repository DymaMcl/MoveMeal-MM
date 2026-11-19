import {
  ALLERGENS,
  type Allergen,
  type Budget,
  type Diet,
  type MealSlot,
  type NutritionPreferences,
} from '@movemeal/shared';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DIETS: Diet[] = ['omnivore', 'pescatarian', 'vegetarian', 'vegan'];
const BUDGETS: Budget[] = ['economic', 'balanced', 'flexible'];
const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack1', 'snack2'];
export const LOG_MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type LogMeal = (typeof LOG_MEALS)[number];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class NutritionPreferencesDto implements NutritionPreferences {
  @IsIn(DIETS)
  diet!: Diet;

  @IsArray()
  @ArrayUnique()
  @IsIn(ALLERGENS, { each: true })
  allergens!: Allergen[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  excludedFoods!: string[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  preferredFoods!: string[];

  @IsIn(BUDGETS)
  budget!: Budget;

  @IsInt()
  @Min(3)
  @Max(5)
  mealsPerDay!: 3 | 4 | 5;
}

export class RegenerateDto {
  /** Lipsa = toata saptamana. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  weekday?: number;
}

export class ReplaceMealDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsIn(SLOTS)
  slot!: MealSlot;

  @IsString()
  @MaxLength(64)
  recipeId!: string;
}

export class LogEntryDto {
  @Matches(DAY)
  day!: string;

  @IsIn(LOG_MEALS)
  meal!: LogMeal;

  @IsIn(['food', 'recipe'])
  source!: 'food' | 'recipe';

  @IsString()
  @MaxLength(64)
  refId!: string;

  /** Grame pentru alimente, portii pentru retete. */
  @IsNumber()
  @Min(0.25)
  @Max(5000)
  amount!: number;
}

export class EatPlannedMealDto {
  @Matches(DAY)
  day!: string;

  @IsIn(SLOTS)
  slot!: MealSlot;
}
