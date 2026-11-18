import { bmi } from './limits';

export type GoalCheckStatus =
  | 'ok'
  | 'too_fast'
  | 'wrong_direction'
  | 'unhealthy_target';

export interface GoalCheck {
  status: GoalCheckStatus;
  /** Ritmul propus de utilizator, în kg pe săptămână (valoare absolută). */
  weeklyRateKg: number;
  /** Ritmul maxim considerat sănătos pentru acest utilizator. */
  maxWeeklyRateKg: number;
  /** Numărul minim de săptămâni recomandat. */
  recommendedWeeks: number;
}

/** Slăbire: cel mult 1% din greutatea corporală și cel mult 1 kg pe săptămână. */
export function maxSafeLossPerWeek(weightKg: number): number {
  return Math.min(1, weightKg * 0.01);
}

/** Creștere în greutate: cel mult 0,5 kg pe săptămână. */
export const MAX_SAFE_GAIN_PER_WEEK = 0.5;

const MIN_HEALTHY_BMI = 18.5;

/**
 * Verifică dacă obiectivul de greutate poate fi atins într-un mod rezonabil
 * în perioada propusă și sugerează o perioadă mai realistă dacă nu.
 */
export function checkWeightGoal(params: {
  goal: 'lose' | 'gain';
  weightKg: number;
  heightCm: number;
  targetWeightKg: number;
  weeks: number;
}): GoalCheck {
  const { goal, weightKg, heightCm, targetWeightKg, weeks } = params;
  const diff = Math.abs(targetWeightKg - weightKg);
  const maxWeeklyRateKg =
    goal === 'lose' ? maxSafeLossPerWeek(weightKg) : MAX_SAFE_GAIN_PER_WEEK;
  const recommendedWeeks = Math.max(1, Math.ceil(diff / maxWeeklyRateKg - 1e-9));
  const weeklyRateKg = weeks > 0 ? diff / weeks : Infinity;
  const base = { weeklyRateKg, maxWeeklyRateKg, recommendedWeeks };

  const wrongDirection =
    (goal === 'lose' && targetWeightKg >= weightKg) ||
    (goal === 'gain' && targetWeightKg <= weightKg);
  if (wrongDirection) return { ...base, status: 'wrong_direction' };

  if (goal === 'lose' && bmi(targetWeightKg, heightCm) < MIN_HEALTHY_BMI) {
    return { ...base, status: 'unhealthy_target' };
  }
  if (weeklyRateKg > maxWeeklyRateKg + 1e-9) return { ...base, status: 'too_fast' };
  return { ...base, status: 'ok' };
}

/** Greutatea minimă corespunzătoare unui IMC sănătos, pentru mesajele de avertizare. */
export function minHealthyWeight(heightCm: number): number {
  const m = heightCm / 100;
  return Math.ceil(MIN_HEALTHY_BMI * m * m);
}
