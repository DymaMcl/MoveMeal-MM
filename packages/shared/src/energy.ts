import type { ActivityLevel, BodyData, EnergyPlan, EnergyProfile, Goal, Macros } from './types';

/** Energia aproximativă stocată într-un kilogram de țesut adipos (kcal). */
export const KCAL_PER_KG = 7700;

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** Aportul minim sub care aplicația nu coboară fără supravegherea unui specialist. */
export const MIN_CALORIES = { male: 1500, female: 1200 } as const;

/** Deficit / surplus maxim aplicat automat (kcal pe zi). */
const MAX_DAILY_DEFICIT = 1000;
const MAX_DAILY_SURPLUS = 500;
/** Surplus moderat folosit pentru dezvoltarea masei musculare. */
const MUSCLE_SURPLUS_RATIO = 0.1;

const PROTEIN_G_PER_KG: Record<Goal, number> = {
  lose: 2.0,
  muscle: 1.8,
  gain: 1.6,
  maintain: 1.4,
};
const FAT_SHARE = 0.25;

/** Metabolismul bazal după formula Mifflin-St Jeor. */
export function calculateBmr({ age, sex, heightCm, weightKg }: BodyData): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Cheltuiala energetică zilnică totală. */
export function calculateTdee(body: BodyData, activityLevel: ActivityLevel): number {
  return calculateBmr(body) * ACTIVITY_FACTORS[activityLevel];
}

function dailyAdjustment(profile: EnergyProfile, tdee: number): number {
  const { goal, targetWeightKg, weeks, weightKg } = profile;
  switch (goal) {
    case 'maintain':
      return 0;
    case 'muscle':
      return tdee * MUSCLE_SURPLUS_RATIO;
    case 'lose':
    case 'gain': {
      if (targetWeightKg === undefined || !weeks || weeks <= 0) {
        return goal === 'lose' ? -500 : 300;
      }
      const perDay = ((targetWeightKg - weightKg) * KCAL_PER_KG) / (weeks * 7);
      return Math.max(-MAX_DAILY_DEFICIT, Math.min(MAX_DAILY_SURPLUS, perDay));
    }
  }
}

export function calculateMacros(calories: number, weightKg: number, goal: Goal): Macros {
  const proteinG = Math.round(PROTEIN_G_PER_KG[goal] * weightKg);
  const fatG = Math.round((calories * FAT_SHARE) / 9);
  const carbsKcal = calories - proteinG * 4 - fatG * 9;
  return { proteinG, fatG, carbsG: Math.max(0, Math.round(carbsKcal / 4)) };
}

/** Calculează necesarul zilnic de calorii și macronutrienți pentru profilul dat. */
export function calculateEnergyPlan(profile: EnergyProfile): EnergyPlan {
  const bmr = calculateBmr(profile);
  const tdee = bmr * ACTIVITY_FACTORS[profile.activityLevel];
  const raw = tdee + dailyAdjustment(profile, tdee);
  const targetCalories = Math.round(Math.max(MIN_CALORIES[profile.sex], raw) / 10) * 10;
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    macros: calculateMacros(targetCalories, profile.weightKg, profile.goal),
  };
}
