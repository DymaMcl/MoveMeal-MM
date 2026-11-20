import type pg from 'pg';
import { addDaysIso, todayIso } from '../common/dates.js';

export type Goal = 'lose' | 'gain' | 'muscle' | 'maintain';

export interface GoalProgress {
  goal: Goal;
  /** 0–100: cat din obiectiv a fost atins. */
  pct: number;
  /**
   * weight = slabire / ingrasare: diferenta de greutate fata de tinta;
   * consistency = mentinere / masa musculara: jurnalul alimentar si antrenamentele din ultimele 7 zile.
   */
  kind: 'weight' | 'consistency';
  startKg: number;
  currentKg: number;
  targetKg: number | null;
  loggedDays: number;
  workoutDays: number;
}

/** Antrenamente pe saptamana considerate suficiente pentru 100% la mentinere / masa musculara. */
const WORKOUT_DAYS_GOAL = 3;

/**
 * Calculeaza progresul utilizatorului curent (in tranzactia sa, cu RLS) si il salveaza in
 * profilul public, de unde il pot vedea ceilalti fara acces la datele sale de sanatate.
 */
export async function refreshGoalProgress(c: pg.PoolClient): Promise<GoalProgress | null> {
  const profile = await c.query<{ goal: Goal; weight_kg: number; target_weight_kg: number | null }>(
    'select goal, weight_kg, target_weight_kg from profiles where user_id = app_user_id()',
  );
  const p = profile.rows[0];
  if (!p) return null;
  const latest = await c.query<{ weight_kg: number }>(
    `select weight_kg from body_measurements where user_id = app_user_id()
     order by day desc limit 1`,
  );
  const today = todayIso();
  const from = addDaysIso(today, -6);
  const logged = await c.query<{ n: number }>(
    `select count(distinct day)::int as n from food_log
     where user_id = app_user_id() and day between $1 and $2`,
    [from, today],
  );
  const workouts = await c.query<{ n: number }>(
    `select count(distinct day)::int as n from workout_logs
     where user_id = app_user_id() and day between $1 and $2`,
    [from, today],
  );
  const startKg = p.weight_kg;
  const currentKg = latest.rows[0]?.weight_kg ?? startKg;
  const loggedDays = logged.rows[0].n;
  const workoutDays = workouts.rows[0].n;

  let pct: number;
  let kind: GoalProgress['kind'];
  if ((p.goal === 'lose' || p.goal === 'gain') && p.target_weight_kg !== null) {
    kind = 'weight';
    const total = p.target_weight_kg - startKg;
    const done = currentKg - startKg;
    pct = total === 0 ? 100 : Math.round((done / total) * 100);
  } else {
    kind = 'consistency';
    pct = Math.round(
      Math.min(1, loggedDays / 7) * 60 + Math.min(1, workoutDays / WORKOUT_DAYS_GOAL) * 40,
    );
  }
  pct = Math.min(100, Math.max(0, pct));

  await c.query(
    `update social_profiles set goal = $1, progress_pct = $2, progress_kind = $3,
       progress_updated_at = now()
     where user_id = app_user_id()`,
    [p.goal, pct, kind],
  );
  return {
    goal: p.goal,
    pct,
    kind,
    startKg,
    currentKg,
    targetKg: p.target_weight_kg,
    loggedDays,
    workoutDays,
  };
}
