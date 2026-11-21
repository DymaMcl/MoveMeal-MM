import { KCAL_PER_KG, MIN_CALORIES } from './energy.ts';
import type { Sex } from './types.ts';

/** „Daca fiecare zi ar fi ca azi”: prognoza pe 5 saptamani. */
export const PROJECTION_DAYS = 35;

/** Abaterea de la tinta considerata „in tinta” (kcal sau procent, care e mai mare). */
const ON_TARGET_KCAL = 100;
const ON_TARGET_RATIO = 0.05;

export type DayVerdict = 'on_target' | 'under' | 'over';

export type DayProjection =
  | {
      status: 'ok';
      verdict: DayVerdict;
      /** Diferenta fata de cheltuiala zilnica estimata (negativ = deficit). */
      balanceKcal: number;
      /** Diferenta fata de tinta zilnica (negativ = sub tinta). */
      vsTargetKcal: number;
      changeKg: number;
      projectedKg: number;
      days: number;
    }
  /** Nimic in jurnal. */
  | { status: 'empty' }
  /**
   * Sub minimul sigur: fie ziua nu este completata, fie aportul este prea mic. Prognoza nu se
   * afiseaza, ca aplicatia sa nu incurajeze o restrictie periculoasa.
   */
  | { status: 'below_minimum'; minimumKcal: number };

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Prognoza greutatii daca fiecare zi ar fi ca ziua data. Foloseste cheltuiala zilnica estimata
 * (TDEE) si 7700 kcal pentru 1 kg; este o estimare orientativa, nu o promisiune.
 */
export function projectDay(input: {
  consumedKcal: number;
  targetKcal: number;
  tdee: number;
  weightKg: number;
  sex: Sex;
  /** Calorii arse in plus prin miscare (activitati, pasi, antrenament). */
  burnedKcal?: number;
  days?: number;
}): DayProjection {
  const days = input.days ?? PROJECTION_DAYS;
  const consumed = Math.max(0, input.consumedKcal);
  if (consumed < 1) return { status: 'empty' };
  const minimumKcal = MIN_CALORIES[input.sex];
  if (consumed < minimumKcal) return { status: 'below_minimum', minimumKcal };

  const balanceKcal = Math.round(consumed - input.tdee - Math.max(0, input.burnedKcal ?? 0));
  const vsTargetKcal = Math.round(consumed - input.targetKcal);
  const tolerance = Math.max(ON_TARGET_KCAL, input.targetKcal * ON_TARGET_RATIO);
  const verdict: DayVerdict =
    Math.abs(vsTargetKcal) <= tolerance ? 'on_target' : vsTargetKcal < 0 ? 'under' : 'over';
  const changeKg = round1((balanceKcal * days) / KCAL_PER_KG);
  return {
    status: 'ok',
    verdict,
    balanceKcal,
    vsTargetKcal,
    changeKg: Object.is(changeKg, -0) ? 0 : changeKg,
    projectedKg: round1(input.weightKg + changeKg),
    days,
  };
}
