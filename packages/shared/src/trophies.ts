/**
 * Trofeele pentru provocari. Conditiile se verifica pe server; aplicatia afiseaza trofeele
 * castigate in profil si progresul celor inca neobtinute.
 */
export type TrophyId = 'first_post' | 'log_streak_7' | 'steps_10k_3' | 'workouts_10';

export type TrophyTier = 'bronze' | 'silver' | 'gold';

export interface TrophyDefinition {
  id: TrophyId;
  tier: TrophyTier;
  /** Numele pictogramei (Ionicons). */
  icon: string;
  /** Pragul de atins (zile, antrenamente, postari). */
  goal: number;
}

/** Pasii zilnici necesari pentru provocarea de mers. */
export const DAILY_STEPS_GOAL = 10_000;

export const TROPHIES: TrophyDefinition[] = [
  { id: 'steps_10k_3', tier: 'gold', icon: 'footsteps', goal: 3 },
  { id: 'log_streak_7', tier: 'silver', icon: 'calendar', goal: 7 },
  { id: 'workouts_10', tier: 'gold', icon: 'barbell', goal: 10 },
  { id: 'first_post', tier: 'bronze', icon: 'camera', goal: 1 },
];

export const getTrophy = (id: string) => TROPHIES.find((t) => t.id === id);

/** Cea mai lunga serie de zile consecutive dintr-o lista de date AAAA-LL-ZZ. */
export function longestStreak(days: string[]): number {
  const sorted = [...new Set(days)].sort();
  let best = 0;
  let current = 0;
  let previous: number | null = null;
  for (const day of sorted) {
    const time = Date.parse(`${day}T12:00:00Z`);
    current = previous !== null && time - previous === 86_400_000 ? current + 1 : 1;
    best = Math.max(best, current);
    previous = time;
  }
  return best;
}
