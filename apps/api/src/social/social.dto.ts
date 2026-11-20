import { Type } from 'class-transformer';
import {
  IsBase64,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IMAGE_MIME } from './media.service.js';

/** Aproximativ 4,5 MB de imagine codificata base64. */
export const MAX_IMAGE_BASE64 = 6_000_000;

export const POST_KINDS = ['meal', 'workout', 'running', 'cycling', 'other'] as const;
export const VISIBILITIES = ['private', 'public'] as const;
export const REPORT_REASONS = [
  'nudity',
  'violence',
  'spam',
  'harassment',
  'not_relevant',
  'other',
] as const;
export const BLOG_CATEGORIES = [
  'nutrition',
  'training',
  'health',
  'recipes',
  'motivation',
] as const;

export class ImageDto {
  @IsBase64()
  @MaxLength(MAX_IMAGE_BASE64)
  image!: string;

  @IsIn(IMAGE_MIME)
  mimeType!: (typeof IMAGE_MIME)[number];
}

export class CreatePostDto extends ImageDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsIn(POST_KINDS)
  kind!: (typeof POST_KINDS)[number];

  @IsIn(VISIBILITIES)
  visibility!: (typeof VISIBILITIES)[number];

  /** Masa salvata din fotografiere: valorile se iau de pe server, nu de la client. */
  @IsOptional()
  @IsUUID()
  foodPhotoId?: string;
}

export class UpdatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;

  @IsOptional()
  @IsIn(VISIBILITIES)
  visibility?: (typeof VISIBILITIES)[number];
}

export class ToggleDto {
  @IsBoolean()
  value!: boolean;
}

export class ReportDto {
  @IsIn(REPORT_REASONS)
  reason!: (typeof REPORT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}

export class FeedQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;

  @IsOptional()
  @IsIn(POST_KINDS)
  kind?: (typeof POST_KINDS)[number];
}

export class SocialProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName!: string;

  @IsString()
  @MaxLength(160)
  bio!: string;

  @IsBoolean()
  showProgress!: boolean;
}

export class BlogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cursor?: string;

  @IsOptional()
  @IsIn(BLOG_CATEGORIES)
  category?: (typeof BLOG_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}

export class BlogPostDto {
  @IsString()
  @MinLength(5)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MaxLength(300)
  summary!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(20000)
  body!: string;

  @IsIn(BLOG_CATEGORIES)
  category!: (typeof BLOG_CATEGORIES)[number];

  @IsIn(['draft', 'published'])
  status!: 'draft' | 'published';

  /** Imaginea de coperta noua (optional). */
  @IsOptional()
  @IsBase64()
  @MaxLength(MAX_IMAGE_BASE64)
  coverImage?: string;

  @IsOptional()
  @IsIn(IMAGE_MIME)
  coverMimeType?: (typeof IMAGE_MIME)[number];

  /** Sterge coperta existenta. */
  @IsOptional()
  @IsBoolean()
  removeCover?: boolean;
}

export class DayQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;
}

export class PageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  page?: number;
}
