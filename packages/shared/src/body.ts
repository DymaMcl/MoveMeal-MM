import { calculateBmr } from './energy.ts';
import { bmi } from './limits.ts';
import type { BodyData, Sex } from './types.ts';

/**
 * „Cantarul ponderal”: starea corpului dupa indicele de masa corporala (clasificarea OMS),
 * intervalul de greutate sanatoasa, procentul estimat de grasime si raportul talie/inaltime.
 * Valorile sunt orientative si nu inlocuiesc evaluarea unui medic.
 */

export type BmiCategory =
  | 'severe_thinness'
  | 'thinness'
  | 'normal'
  | 'overweight'
  | 'obese1'
  | 'obese2'
  | 'obese3';

/** Gruparea simpla afisata utilizatorului: prea slab, normal, supraponderal, obezitate. */
export type BodyStatus = 'under' | 'normal' | 'over' | 'obese';

/** Pragurile OMS pentru adulti (limita inferioara a fiecarei categorii). */
export const BMI_THRESHOLDS: { category: BmiCategory; from: number }[] = [
  { category: 'severe_thinness', from: 0 },
  { category: 'thinness', from: 16 },
  { category: 'normal', from: 18.5 },
  { category: 'overweight', from: 25 },
  { category: 'obese1', from: 30 },
  { category: 'obese2', from: 35 },
  { category: 'obese3', from: 40 },
];

export function bmiCategory(value: number): BmiCategory {
  let found: BmiCategory = 'severe_thinness';
  for (const t of BMI_THRESHOLDS) if (value >= t.from) found = t.category;
  return found;
}

export function bodyStatus(category: BmiCategory): BodyStatus {
  if (category === 'severe_thinness' || category === 'thinness') return 'under';
  if (category === 'normal') return 'normal';
  if (category === 'overweight') return 'over';
  return 'obese';
}

/** Greutatea corespunzatoare intervalului normal al IMC (18,5–24,9) pentru inaltimea data. */
export function healthyWeightRange(heightCm: number): { min: number; max: number } {
  const m2 = (heightCm / 100) ** 2;
  return { min: Math.round(18.5 * m2 * 10) / 10, max: Math.round(24.9 * m2 * 10) / 10 };
}

/** Procentul de grasime estimat din IMC (formula Deurenberg, 1991), pentru adulti. */
export function estimateBodyFat(bmiValue: number, age: number, sex: Sex): number {
  const value = 1.2 * bmiValue + 0.23 * age - 10.8 * (sex === 'male' ? 1 : 0) - 5.4;
  return Math.round(Math.max(2, value) * 10) / 10;
}

export type BodyFatLevel = 'essential' | 'athletic' | 'fitness' | 'average' | 'high';

/** Categoriile procentului de grasime (American Council on Exercise). */
const FAT_LEVELS: Record<Sex, { level: BodyFatLevel; from: number }[]> = {
  male: [
    { level: 'essential', from: 0 },
    { level: 'athletic', from: 6 },
    { level: 'fitness', from: 14 },
    { level: 'average', from: 18 },
    { level: 'high', from: 25 },
  ],
  female: [
    { level: 'essential', from: 0 },
    { level: 'athletic', from: 14 },
    { level: 'fitness', from: 21 },
    { level: 'average', from: 25 },
    { level: 'high', from: 32 },
  ],
};

export function bodyFatLevel(percent: number, sex: Sex): BodyFatLevel {
  let found: BodyFatLevel = 'essential';
  for (const l of FAT_LEVELS[sex]) if (percent >= l.from) found = l.level;
  return found;
}

export type WaistRisk = 'low' | 'increased' | 'high';

/** Raportul talie/inaltime: sub 0,5 – risc scazut, 0,5–0,6 – crescut, peste 0,6 – ridicat. */
export function waistRisk(waistCm: number, heightCm: number): { ratio: number; risk: WaistRisk } {
  const ratio = Math.round((waistCm / heightCm) * 100) / 100;
  return { ratio, risk: ratio < 0.5 ? 'low' : ratio < 0.6 ? 'increased' : 'high' };
}

export interface BodyAssessment {
  bmi: number;
  category: BmiCategory;
  status: BodyStatus;
  healthy: { min: number; max: number };
  /** Kilograme de slabit (pozitiv) sau de pus (negativ) pana la intervalul normal; 0 = in interval. */
  toHealthy: number;
  bodyFat: number;
  bodyFatLevel: BodyFatLevel;
  /** Metabolismul bazal (Mifflin–St Jeor), kcal/zi. */
  bmr: number;
  waist?: { ratio: number; risk: WaistRisk };
  /** Clasificarea IMC pentru adulti nu se aplica exact sub 18 ani. */
  minor: boolean;
}

export function assessBody(body: BodyData & { waistCm?: number }): BodyAssessment {
  const value = Math.round(bmi(body.weightKg, body.heightCm) * 10) / 10;
  const category = bmiCategory(value);
  const healthy = healthyWeightRange(body.heightCm);
  const toHealthy =
    body.weightKg > healthy.max
      ? Math.round((body.weightKg - healthy.max) * 10) / 10
      : body.weightKg < healthy.min
        ? -Math.round((healthy.min - body.weightKg) * 10) / 10
        : 0;
  const bodyFat = estimateBodyFat(value, body.age, body.sex);
  return {
    bmi: value,
    category,
    status: bodyStatus(category),
    healthy,
    toHealthy,
    bodyFat,
    bodyFatLevel: bodyFatLevel(bodyFat, body.sex),
    bmr: Math.round(calculateBmr(body)),
    ...(body.waistCm ? { waist: waistRisk(body.waistCm, body.heightCm) } : {}),
    minor: body.age < 18,
  };
}
