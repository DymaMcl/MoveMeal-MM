export type Sex = 'male' | 'female';

/** Obiectivele disponibile la crearea profilului. */
export type Goal = 'lose' | 'gain' | 'muscle' | 'maintain';

/**
 * Cum se obtine deficitul la slabire: doar din alimentatie, doar din exercitii fizice
 * (mananci cat cheltui, arzi diferenta prin miscare) sau mixt.
 */
export type LossApproach = 'diet' | 'exercise' | 'mixed';

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
  /** Doar pentru obiectivul „lose”; implicit „diet”. */
  lossApproach?: LossApproach;
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
  /** Calorii de ars zilnic prin exercitii fizice, peste activitatea obisnuita (0 daca nu e cazul). */
  exerciseKcal: number;
  /** Deficitul zilnic total planificat (alimentatie + exercitii), in kcal; 0 la mentinere/crestere. */
  dailyDeficit: number;
}
