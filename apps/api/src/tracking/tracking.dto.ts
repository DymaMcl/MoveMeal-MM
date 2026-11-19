import { IsInt, IsNumber, IsOptional, Matches, Max, Min } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class MeasurementDto {
  @Matches(DAY)
  day!: string;

  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(35)
  @Max(250)
  weightKg!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(40)
  @Max(250)
  waistCm?: number;
}

export class WaterDto {
  @Matches(DAY)
  day!: string;

  @IsInt()
  @Min(0)
  @Max(10000)
  ml!: number;
}
