import { describe, expect, it } from 'vitest';
import { activityKcal, getActivity, stepsKcal, workoutKcal } from './activities.ts';
import { projectDay } from './day-summary.ts';
import { fastingBlock, fastingStage } from './fasting.ts';

describe('activitati', () => {
  it('calculeaza arderea neta dupa MET', () => {
    // alergare 8.3 MET, 80 kg, 30 min -> (7.3 * 80 * 0.5) = 292
    expect(activityKcal(getActivity('running')!, 30, 80)).toBe(292);
  });

  it('numara doar pasii de peste pragul zilnic obisnuit', () => {
    expect(stepsKcal(4000, 80)).toBe(0);
    expect(stepsKcal(10000, 80)).toBe(200);
  });

  it('estimeaza antrenamentul de forta dupa exercitiile bifate', () => {
    expect(workoutKcal(0, 80)).toBe(0);
    expect(workoutKcal(5, 80)).toBe(160);
  });

  it('prognoza zilei tine cont de caloriile arse', () => {
    const base = {
      consumedKcal: 2000,
      targetKcal: 2000,
      tdee: 2000,
      weightKg: 80,
      sex: 'male' as const,
    };
    const still = projectDay(base);
    const active = projectDay({ ...base, burnedKcal: 300 });
    expect(still.status === 'ok' && still.balanceKcal).toBe(0);
    expect(active.status === 'ok' && active.balanceKcal).toBe(-300);
  });
});

describe('post intermitent', () => {
  it('nu este propus minorilor si persoanelor subponderale', () => {
    expect(fastingBlock({ age: 16, weightKg: 60, heightCm: 170 })).toBe('minor');
    expect(fastingBlock({ age: 25, weightKg: 50, heightCm: 175 })).toBe('underweight');
    expect(fastingBlock({ age: 25, weightKg: 70, heightCm: 175 })).toBeNull();
  });

  it('descrie etapele postului dupa orele trecute', () => {
    expect(fastingStage(2)).toBe('digesting');
    expect(fastingStage(8)).toBe('settling');
    expect(fastingStage(14)).toBe('fat_burning');
  });
});
