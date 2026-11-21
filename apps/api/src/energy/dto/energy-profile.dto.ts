import {
  LIMITS,
  type ActivityLevel,
  type EnergyProfile,
  type Goal,
  type LossApproach,
  type Sex,
} from '@movemeal/shared';
import { IsIn, IsInt, IsNumber, IsOptional, Max, Min, ValidateIf } from 'class-validator';

const SEXES: Sex[] = ['male', 'female'];
const GOALS: Goal[] = ['lose', 'gain', 'muscle', 'maintain'];
const LOSS_APPROACHES: LossApproach[] = ['diet', 'exercise', 'mixed'];
const ACTIVITY_LEVELS: ActivityLevel[] = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'very_active',
];

/** Datele trimise de aplicatie pentru calculul necesarului energetic. */
export class EnergyProfileDto implements EnergyProfile {
  @IsInt()
  @Min(LIMITS.age.min)
  @Max(LIMITS.age.max)
  age!: number;

  @IsIn(SEXES)
  sex!: Sex;

  @IsNumber()
  @Min(LIMITS.heightCm.min)
  @Max(LIMITS.heightCm.max)
  heightCm!: number;

  @IsNumber()
  @Min(LIMITS.weightKg.min)
  @Max(LIMITS.weightKg.max)
  weightKg!: number;

  @IsIn(ACTIVITY_LEVELS)
  activityLevel!: ActivityLevel;

  @IsIn(GOALS)
  goal!: Goal;

  /** Obligatoriu doar pentru slabire si crestere in greutate. */
  @ValidateIf((o: EnergyProfileDto) => o.goal === 'lose' || o.goal === 'gain')
  @IsNumber()
  @Min(LIMITS.weightKg.min)
  @Max(LIMITS.weightKg.max)
  targetWeightKg?: number;

  @ValidateIf((o: EnergyProfileDto) => o.goal === 'lose' || o.goal === 'gain')
  @IsInt()
  @Min(LIMITS.weeks.min)
  @Max(LIMITS.weeks.max)
  weeks?: number;

  /** Doar la slabire: din alimentatie, din exercitii sau mixt (implicit alimentatie). */
  @IsOptional()
  @IsIn(LOSS_APPROACHES)
  lossApproach?: LossApproach;
}
