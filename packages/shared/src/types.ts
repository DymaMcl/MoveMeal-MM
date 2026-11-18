export type Sex = 'male' | 'female';

/** Obiectivele disponibile la crearea profilului. */
export type Goal = 'lose' | 'gain' | 'muscle' | 'maintain';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';

export interface BodyData {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
}

export interface EnergyProfile extends BodyData {
  activityLevel: ActivityLevel;
  goal: Goal;
  /** Doar pentru obiectivele „lose” și „gain”. */
  targetWeightKg?: number;
  /** Perioada propusă pentru atingerea greutății-țintă, în săptămâni. */
  weeks?: number;
}

export interface Macros {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export interface EnergyPlan {
  bmr: number;
  tdee: number;
  targetCalories: number;
  macros: Macros;
}
