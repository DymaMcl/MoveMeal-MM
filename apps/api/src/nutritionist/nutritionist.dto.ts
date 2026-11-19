import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class NutritionistProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  displayName!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(2000)
  bio!: string;

  @IsString()
  @MaxLength(1000)
  qualifications!: string;

  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears!: number;

  @IsString()
  @MaxLength(1000)
  services!: string;

  @IsInt()
  @Min(0)
  @Max(100000)
  priceMdl!: number;

  @IsIn([30, 45, 60, 90])
  slotMinutes!: number;
}

export class HourDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @Matches(TIME)
  start!: string;

  @Matches(TIME)
  end!: string;
}

export class HoursDto {
  @ValidateNested({ each: true })
  @Type(() => HourDto)
  @ArrayMaxSize(42)
  hours!: HourDto[];
}

export class DayOffDto {
  @Matches(DAY)
  day!: string;

  @IsIn([true, false])
  off!: boolean;
}

export class DecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RescheduleDto extends DecisionDto {
  @IsISO8601()
  startsAt!: string;
}

export class AdjustClientDto {
  /** null = revine la tinta calculata automat. */
  @IsOptional()
  @IsInt()
  @Min(800)
  @Max(6000)
  calorieTarget!: number | null;

  @IsString()
  @MaxLength(1000)
  note!: string;
}
