import type { BodyData } from './types';

export const LIMITS = {
  age: { min: 16, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 35, max: 300 },
  weeks: { min: 1, max: 104 },
} as const;

export type BodyField = keyof Pick<BodyData, 'age' | 'heightCm' | 'weightKg'>;

export function isInRange(field: keyof typeof LIMITS, value: number): boolean {
  const { min, max } = LIMITS[field];
  return Number.isFinite(value) && value >= min && value <= max;
}

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}
