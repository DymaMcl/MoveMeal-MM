import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBase64,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { LANGUAGES } from '../assistant/assistant.dto.js';
import type { LogMeal } from '../nutrition/nutrition.dto.js';
import { MAX_GRAMS, MAX_ITEMS } from './food-photo.service.js';

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** Aproximativ 4,5 MB de imagine (aplicatia trimite de obicei o imagine micsorata, sub 400 KB). */
export const MAX_IMAGE_BASE64 = 6_000_000;

export class AnalyzePhotoDto {
  @IsBase64()
  @MaxLength(MAX_IMAGE_BASE64)
  image!: string;

  @IsIn(IMAGE_TYPES)
  mimeType!: (typeof IMAGE_TYPES)[number];

  @IsIn(LANGUAGES)
  language!: (typeof LANGUAGES)[number];

  /** Descrierea optionala a mesei (ajuta la recunoasterea corecta). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  hint?: string;
}

/** Corectarea unui aliment (index dat) sau adaugarea unuia nou (fara index). */
export class EditPhotoItemDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_ITEMS - 1)
  index?: number;

  /** Alimentul din catalog… */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  foodId?: string;

  /** …sau denumirea scrisa de utilizator (valorile le estimeaza modelul AI). */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_GRAMS)
  grams?: number;

  @IsIn(LANGUAGES)
  language!: (typeof LANGUAGES)[number];
}

export class PhotoChoiceDto {
  @IsInt()
  @Min(0)
  @Max(MAX_ITEMS - 1)
  index!: number;

  @IsInt()
  @Min(1)
  @Max(MAX_GRAMS)
  grams!: number;
}

export class LogPhotoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;

  @IsIn(['breakfast', 'lunch', 'dinner', 'snack'])
  meal!: LogMeal;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => PhotoChoiceDto)
  items!: PhotoChoiceDto[];
}
