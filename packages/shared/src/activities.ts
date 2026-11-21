/**
 * Activitatile fizice (cardio, sport, treburi) si caloriile arse. Valorile MET sunt din
 * „Compendium of Physical Activities” (Ainsworth et al., 2011). Se calculeaza arderea NETA
 * (MET - 1): cheltuiala de repaus este deja inclusa in TDEE, deci nu o numaram de doua ori.
 */
export type ActivityId =
  | 'walking'
  | 'brisk_walking'
  | 'running'
  | 'running_fast'
  | 'cycling'
  | 'stationary_bike'
  | 'swimming'
  | 'elliptical'
  | 'rowing'
  | 'jump_rope'
  | 'hiit'
  | 'strength'
  | 'yoga'
  | 'pilates'
  | 'dancing'
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'hiking'
  | 'stairs'
  | 'housework'
  | 'gardening';

export interface ActivityDefinition {
  id: ActivityId;
  met: number;
  /** Numele pictogramei (Ionicons). */
  icon: string;
  category: 'cardio' | 'sport' | 'gym' | 'daily';
}

export const ACTIVITIES: ActivityDefinition[] = [
  { id: 'walking', met: 3.5, icon: 'walk', category: 'cardio' },
  { id: 'brisk_walking', met: 4.3, icon: 'walk', category: 'cardio' },
  { id: 'running', met: 8.3, icon: 'speedometer', category: 'cardio' },
  { id: 'running_fast', met: 9.8, icon: 'flash', category: 'cardio' },
  { id: 'cycling', met: 6.8, icon: 'bicycle', category: 'cardio' },
  { id: 'stationary_bike', met: 6.8, icon: 'bicycle', category: 'gym' },
  { id: 'swimming', met: 5.8, icon: 'water', category: 'cardio' },
  { id: 'elliptical', met: 5.0, icon: 'infinite', category: 'gym' },
  { id: 'rowing', met: 7.0, icon: 'boat', category: 'gym' },
  { id: 'jump_rope', met: 11.8, icon: 'pulse', category: 'cardio' },
  { id: 'hiit', met: 8.0, icon: 'flame', category: 'gym' },
  { id: 'strength', met: 5.0, icon: 'barbell', category: 'gym' },
  { id: 'yoga', met: 2.5, icon: 'body', category: 'gym' },
  { id: 'pilates', met: 3.0, icon: 'body', category: 'gym' },
  { id: 'dancing', met: 7.3, icon: 'musical-notes', category: 'sport' },
  { id: 'football', met: 7.0, icon: 'football', category: 'sport' },
  { id: 'basketball', met: 6.5, icon: 'basketball', category: 'sport' },
  { id: 'tennis', met: 7.3, icon: 'tennisball', category: 'sport' },
  { id: 'hiking', met: 6.0, icon: 'trail-sign', category: 'cardio' },
  { id: 'stairs', met: 8.0, icon: 'trending-up', category: 'cardio' },
  { id: 'housework', met: 3.5, icon: 'home', category: 'daily' },
  { id: 'gardening', met: 3.8, icon: 'leaf', category: 'daily' },
];

export const getActivity = (id: string) => ACTIVITIES.find((a) => a.id === id);

/** Caloriile arse NET (peste repaus) intr-o activitate. */
export function activityKcal(activity: ActivityDefinition, minutes: number, weightKg: number) {
  return Math.round(((activity.met - 1) * weightKg * minutes) / 60);
}

/**
 * Pasii obisnuiti dintr-o zi (deplasari, casa) sunt deja in nivelul de activitate ales; doar
 * pasii de peste acest prag se numara ca miscare in plus.
 */
export const STEPS_BASELINE = 5000;

/** Caloriile arse in plus prin pasi (aprox. 0,0005 kcal pe pas si kilogram, net). */
export function stepsKcal(steps: number, weightKg: number) {
  return Math.round(Math.max(0, steps - STEPS_BASELINE) * weightKg * 0.0005);
}

/** Un exercitiu bifat in programul de forta: ~3 serii cu pauze, aprox. 6 minute la MET 5. */
export const WORKOUT_EXERCISE_MINUTES = 6;

export function workoutKcal(completedExercises: number, weightKg: number) {
  return Math.round((4 * weightKg * WORKOUT_EXERCISE_MINUTES * completedExercises) / 60);
}
