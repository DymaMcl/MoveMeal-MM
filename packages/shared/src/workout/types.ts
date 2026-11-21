/** mixed = unele zile acasa, celelalte la sala (vezi WorkoutPreferences.homeDays). */
export type WorkoutLocation = 'home' | 'gym' | 'mixed';

/** Locul unei sedinte concrete. */
export type SessionLocation = 'home' | 'gym';

/** Nivelul ales: usor (2–3 zile), moderat (3–4 zile), intens (5 zile). */
export type WorkoutLevel = 'light' | 'moderate' | 'intense';

/** Echipamentul disponibil acasa. La sala se considera ca exista tot echipamentul. */
export type Equipment = 'dumbbells' | 'kettlebell' | 'bands' | 'pullup_bar' | 'bench';

/** Aparate si haltere – disponibile doar la sala. */
export type GymOnly = 'gym';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'core' | 'legs' | 'glutes';

/** Zone sensibile: exercitiile care le solicita sunt evitate. */
export type Limitation = 'knees' | 'lower_back' | 'shoulders' | 'wrists';

export type Sport = 'running' | 'cycling' | 'swimming' | 'football' | 'other';

/** 0 = luni … 6 = duminica. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type MovementPattern =
  | 'squat'
  | 'lunge'
  | 'hinge'
  | 'glute'
  | 'push_h'
  | 'push_v'
  | 'pull_h'
  | 'pull_v'
  | 'isolation'
  | 'core';

export interface Exercise {
  id: string;
  name: { ro: string; en: string };
  group: MuscleGroup;
  /** Pentru brate: muschiul principal (biceps in zilele de tras, triceps in cele de impins). */
  muscle?: 'biceps' | 'triceps';
  pattern: MovementPattern;
  /** Variante de echipament (oricare dintre ele); [] = doar greutatea corpului. */
  requires: (Equipment | GymOnly)[][];
  difficulty: 1 | 2 | 3;
  /** Zonele solicitate in mod deosebit. */
  stresses: Limitation[];
  /** Exercitiile statice (plansa) se masoara in secunde. */
  unit: 'reps' | 'seconds';
  /** Identificatorul din free-exercise-db (fotografiile 0.jpg si 1.jpg). */
  image: string;
  steps: { ro: string[]; en: string[] };
}

export interface WorkoutPreferences {
  location: WorkoutLocation;
  level: WorkoutLevel;
  days: Weekday[];
  /** Doar pentru antrenamentul mixt: zilele (dintre `days`) de acasa; celelalte sunt la sala. */
  homeDays?: Weekday[];
  equipment: Equipment[];
  sports: Sport[];
  limitations: Limitation[];
  /** Grupele musculare pe care utilizatorul doreste un accent mai mare (cel mult 2). */
  focus: MuscleGroup[];
}

export type SessionTemplate =
  'full_a' | 'full_b' | 'full_c' | 'upper' | 'lower' | 'push' | 'pull' | 'legs';

export interface Prescription {
  exerciseId: string;
  sets: number;
  /** De exemplu „8-12” (repetari) sau „30-45” (secunde, vezi unitatea exercitiului). */
  target: string;
  restSec: number;
  /** Adaugat pentru grupa musculara aleasa ca accent. */
  focus?: boolean;
}

export interface WorkoutSession {
  weekday: Weekday;
  /** Unde are loc sedinta (lipseste in programele create inainte de antrenamentul mixt). */
  location?: SessionLocation;
  template: SessionTemplate;
  exercises: Prescription[];
}

export type PlanWarning =
  | 'consecutive_full_body'
  | 'reduced_legs_for_sports'
  | 'reduced_shoulders_for_swimming'
  | 'missing_slots';

export interface WorkoutPlan {
  sessions: WorkoutSession[];
  warnings: PlanWarning[];
}
