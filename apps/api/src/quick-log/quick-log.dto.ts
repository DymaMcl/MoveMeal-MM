import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBase64,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LANGUAGES } from '../assistant/assistant.dto.js';
import { IMAGE_TYPES, MAX_IMAGE_BASE64 } from '../food-photo/food-photo.dto.js';
import { LOG_MEALS, type LogMeal } from '../nutrition/nutrition.dto.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const BARCODE = /^[0-9]{8,14}$/;
export const MAX_SAVED_MEALS = 50;
export const MAX_SAVED_ITEMS = 20;

/** Un produs adaugat de utilizator (valorile de pe eticheta, la 100 g). */
export class ProductDto {
  @IsOptional()
  @Matches(BARCODE)
  barcode?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsNumber()
  @Min(0)
  @Max(900)
  kcal!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  protein!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  carbs!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  fat!: number;

  /** Gramajul unei portii de pe ambalaj (optional). */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(2000)
  servingG?: number;
}

/** Fotografia tabelului cu valori nutritionale de pe ambalaj. */
export class LabelDto {
  @IsBase64()
  @MaxLength(MAX_IMAGE_BASE64)
  image!: string;

  @IsIn(IMAGE_TYPES)
  mimeType!: (typeof IMAGE_TYPES)[number];

  @IsIn(LANGUAGES)
  language!: (typeof LANGUAGES)[number];
}

class DayMealDto {
  @Matches(DAY)
  day!: string;

  @IsIn(LOG_MEALS)
  meal!: LogMeal;
}

export class LogProductDto extends DayMealDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  @Max(5000)
  grams!: number;
}

/** Calorii introduse direct (de exemplu la restaurant), cu macronutrienti optionali. */
export class QuickAddDto extends DayMealDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  name?: string;

  @IsNumber()
  @Min(1)
  @Max(5000)
  kcal!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  protein?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  carbs?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  fat?: number;
}

/** Copierea unei mese sau a unei zile intregi (fara masa = toata ziua). */
export class CopyLogDto {
  @Matches(DAY)
  fromDay!: string;

  @Matches(DAY)
  toDay!: string;

  @IsOptional()
  @IsIn(LOG_MEALS)
  fromMeal?: LogMeal;

  /** Masa in care se copiaza (implicit aceeasi). */
  @IsOptional()
  @IsIn(LOG_MEALS)
  toMeal?: LogMeal;
}

export class SaveMealDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  /** Inregistrarile din jurnal care formeaza masa. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SAVED_ITEMS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  entryIds!: string[];
}

export class RenameMealDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;
}

export class LogSavedMealDto extends DayMealDto {}
