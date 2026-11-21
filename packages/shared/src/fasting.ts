import { bmi } from './limits.ts';

/**
 * Postul intermitent (fereastra de mancat): optional, cu avertismente. Nu este recomandat
 * minorilor, persoanelor subponderale, si se discuta cu medicul in sarcina, diabet sau
 * tulburari de alimentatie.
 */
export type FastingPlanId = '12_12' | '14_10' | '16_8' | '18_6';

export interface FastingPlan {
  id: FastingPlanId;
  fastHours: number;
  level: 'beginner' | 'intermediate' | 'advanced';
}

export const FASTING_PLANS: FastingPlan[] = [
  { id: '12_12', fastHours: 12, level: 'beginner' },
  { id: '14_10', fastHours: 14, level: 'beginner' },
  { id: '16_8', fastHours: 16, level: 'intermediate' },
  { id: '18_6', fastHours: 18, level: 'advanced' },
];

export const getFastingPlan = (id: string) => FASTING_PLANS.find((p) => p.id === id);

/** Postul cel mai lung acceptat de aplicatie (ore). */
export const MAX_FAST_HOURS = 24;

export type FastingBlock = 'minor' | 'underweight' | null;

/** Motivul pentru care postul nu este propus (sau null daca poate fi folosit). */
export function fastingBlock(input: {
  age: number;
  weightKg: number;
  heightCm: number;
}): FastingBlock {
  if (input.age < 18) return 'minor';
  if (bmi(input.weightKg, input.heightCm) < 18.5) return 'underweight';
  return null;
}

/** Etapele postului, orientative, dupa orele trecute de la ultima masa. */
export type FastingStage = 'digesting' | 'settling' | 'fat_burning';

export function fastingStage(hours: number): FastingStage {
  if (hours < 4) return 'digesting';
  if (hours < 12) return 'settling';
  return 'fat_burning';
}
