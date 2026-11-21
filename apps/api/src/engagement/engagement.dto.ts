import {
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class FollowDto {
  @IsBoolean()
  value!: boolean;
}

export class StepsDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;

  @IsInt()
  @Min(0)
  @Max(100_000)
  steps!: number;

  /** manual = introdus de utilizator; device = citit din telefon. */
  @IsIn(['manual', 'device'])
  source!: 'manual' | 'device';
}

export class NewsDto {
  @IsIn(['feature', 'challenge'])
  kind!: 'feature' | 'challenge';

  @IsString()
  @MinLength(3)
  @MaxLength(80)
  title!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(600)
  body!: string;
}
