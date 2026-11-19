import { MIN_CALORIES } from './energy.ts';
import type { Goal, Sex } from './types.ts';

export interface WeightEntry {
  /** AAAA-LL-ZZ */
  day: string;
  kg: number;
}

/** Ritmul vizat, in procente din greutate pe saptamana (Laboratorul 2). */
export const TARGET_RATE: Record<Goal, { min: number; max: number }> = {
  lose: { min: -0.75, max: -0.25 },
  gain: { min: 0.1, max: 0.5 },
  muscle: { min: 0.1, max: 0.5 },
  maintain: { min: -0.25, max: 0.25 },
};

export const ANALYSIS_DAYS = 14;
export const MIN_WEIGHT_ENTRIES = 6;
export const MIN_LOGGED_DAYS = 10;
const ADJUSTMENT_STEP = 0.05;

/** Limitele de siguranta fata de necesarul zilnic (tabelul 1.2). */
const LIMITS: Record<Goal, { min: number; max: number }> = {
  lose: { min: 0.8, max: 1.0 },
  maintain: { min: 0.95, max: 1.05 },
  gain: { min: 1.0, max: 1.15 },
  muscle: { min: 1.0, max: 1.15 },
};

export type ProgressAnalysis =
  | { status: 'insufficient_data'; weightEntries: number; loggedDays: number }
  | { status: 'on_track'; weeklyChangePct: number }
  | {
      status: 'adjust';
      weeklyChangePct: number;
      direction: 'decrease' | 'increase';
      currentTarget: number;
      proposedTarget: number;
    }
  | { status: 'at_limit'; weeklyChangePct: number; direction: 'decrease' | 'increase' };

function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const average = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

/** Media mobila pe 7 zile pentru fiecare zi cu masuratoare (pentru grafic). */
export function movingAverage7(entries: WeightEntry[]): { day: string; kg: number; avg: number }[] {
  const sorted = [...entries].sort((a, b) => a.day.localeCompare(b.day));
  return sorted.map((e) => {
    const from = addDays(e.day, -6);
    const window = sorted.filter((x) => x.day >= from && x.day <= e.day).map((x) => x.kg);
    return { day: e.day, kg: e.kg, avg: Math.round(average(window) * 100) / 100 };
  });
}

/**
 * Analizeaza ultimele 14 zile (pana la `today`, inclusiv) si propune, daca e cazul,
 * modificarea tintei calorice cu 5%, rotunjita la 5 kcal, in limitele de siguranta.
 */
export function analyzeProgress(input: {
  goal: Goal;
  sex: Sex;
  today: string;
  weights: WeightEntry[];
  /** Zilele in care jurnalul alimentar are cel putin o inregistrare. */
  loggedDays: string[];
  currentTarget: number;
  /** Necesarul zilnic estimat (pentru limitele de siguranta). */
  tdee: number;
}): ProgressAnalysis {
  const start = addDays(input.today, -(ANALYSIS_DAYS - 1));
  const inWindow = (day: string) => day >= start && day <= input.today;
  const weights = input.weights.filter((w) => inWindow(w.day));
  const loggedDays = new Set(input.loggedDays.filter(inWindow)).size;

  const firstWeekEnd = addDays(start, 6);
  const firstWeek = weights.filter((w) => w.day <= firstWeekEnd).map((w) => w.kg);
  const secondWeek = weights.filter((w) => w.day > firstWeekEnd).map((w) => w.kg);

  if (
    weights.length < MIN_WEIGHT_ENTRIES ||
    loggedDays < MIN_LOGGED_DAYS ||
    firstWeek.length === 0 ||
    secondWeek.length === 0
  ) {
    return { status: 'insufficient_data', weightEntries: weights.length, loggedDays };
  }

  // Variatia mediei pe 7 zile intre cele doua saptamani, in procente din greutate.
  const before = average(firstWeek);
  const after = average(secondWeek);
  const weeklyChangePct = Math.round(((after - before) / before) * 100 * 100) / 100;

  const { min, max } = TARGET_RATE[input.goal];
  if (weeklyChangePct >= min && weeklyChangePct <= max)
    return { status: 'on_track', weeklyChangePct };

  // Prea lent spre obiectiv sau prea rapid: tinta se corecteaza in sens invers.
  const direction: 'decrease' | 'increase' = weeklyChangePct > max ? 'decrease' : 'increase';
  const factor = direction === 'decrease' ? 1 - ADJUSTMENT_STEP : 1 + ADJUSTMENT_STEP;
  const limits = LIMITS[input.goal];
  // Limitele se rotunjesc spre interior, ca rotunjirea la 5 kcal sa nu le depaseasca.
  const lower = Math.ceil(Math.max(MIN_CALORIES[input.sex], input.tdee * limits.min) / 5) * 5;
  const upper = Math.floor((input.tdee * limits.max) / 5) * 5;
  const proposed = Math.min(
    upper,
    Math.max(lower, Math.round((input.currentTarget * factor) / 5) * 5),
  );

  const moves =
    direction === 'decrease' ? proposed < input.currentTarget : proposed > input.currentTarget;
  if (!moves) return { status: 'at_limit', weeklyChangePct, direction };
  return {
    status: 'adjust',
    weeklyChangePct,
    direction,
    currentTarget: input.currentTarget,
    proposedTarget: proposed,
  };
}
