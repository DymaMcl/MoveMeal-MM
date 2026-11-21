import { ACTIVITIES, FASTING_PLANS, type ActivityId, type FastingPlanId } from '@movemeal/shared';
import { IsDateString, IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class ActivityDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  day!: string;

  @IsIn(ACTIVITIES.map((a) => a.id))
  activityId!: ActivityId;

  @IsInt()
  @Min(1)
  @Max(600)
  minutes!: number;

  /** Optional: caloriile citite de pe ceas / aparat; altfel se calculeaza din MET. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5000)
  kcal?: number;
}

export class FastingStartDto {
  @IsIn(FASTING_PLANS.map((p) => p.id))
  planId!: FastingPlanId;

  /** Ora ultimei mese, daca postul a inceput mai devreme (cel mult cu 24 de ore). */
  @IsOptional()
  @IsDateString()
  startedAt?: string;
}
