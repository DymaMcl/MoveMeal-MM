import { describe, expect, it } from 'vitest';
import { checkWeightGoal, maxSafeLossPerWeek, minHealthyWeight } from './goal.ts';

describe('checkWeightGoal', () => {
  it('acceptă un ritm rezonabil de slăbire', () => {
    const r = checkWeightGoal({ goal: 'lose', weightKg: 90, heightCm: 180, targetWeightKg: 80, weeks: 12 });
    expect(r.status).toBe('ok');
  });

  it('respinge un ritm prea rapid și sugerează o perioadă realistă', () => {
    // 20 kg în 4 săptămâni; maxim 0,9 kg/săpt. la 90 kg -> 23 săptămâni
    const r = checkWeightGoal({ goal: 'lose', weightKg: 90, heightCm: 180, targetWeightKg: 70, weeks: 4 });
    expect(r.status).toBe('too_fast');
    expect(r.recommendedWeeks).toBe(23);
  });

  it('plafonează ritmul de slăbire la 1 kg pe săptămână', () => {
    expect(maxSafeLossPerWeek(150)).toBe(1);
    expect(maxSafeLossPerWeek(70)).toBeCloseTo(0.7);
  });

  it('limitează creșterea în greutate la 0,5 kg pe săptămână', () => {
    const r = checkWeightGoal({ goal: 'gain', weightKg: 60, heightCm: 175, targetWeightKg: 66, weeks: 6 });
    expect(r.status).toBe('too_fast');
    expect(r.recommendedWeeks).toBe(12);
  });

  it('semnalează direcția greșită', () => {
    const r = checkWeightGoal({ goal: 'lose', weightKg: 70, heightCm: 175, targetWeightKg: 75, weeks: 10 });
    expect(r.status).toBe('wrong_direction');
  });

  it('semnalează o greutate-țintă sub IMC 18,5', () => {
    const r = checkWeightGoal({ goal: 'lose', weightKg: 60, heightCm: 180, targetWeightKg: 55, weeks: 30 });
    expect(r.status).toBe('unhealthy_target');
    expect(minHealthyWeight(180)).toBe(60);
  });
});
