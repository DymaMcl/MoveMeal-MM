import { describe, expect, it } from 'vitest';
import { calculateBmr, calculateEnergyPlan, calculateMacros, MIN_CALORIES } from './energy.ts';

const male = { age: 25, sex: 'male' as const, heightCm: 180, weightKg: 80 };
const female = { age: 30, sex: 'female' as const, heightCm: 165, weightKg: 60 };

describe('calculateBmr', () => {
  it('folosește formula Mifflin-St Jeor pentru bărbați', () => {
    // 10*80 + 6.25*180 - 5*25 + 5 = 1805
    expect(calculateBmr(male)).toBe(1805);
  });

  it('folosește formula Mifflin-St Jeor pentru femei', () => {
    // 10*60 + 6.25*165 - 5*30 - 161 = 1320.25
    expect(calculateBmr(female)).toBeCloseTo(1320.25);
  });
});

describe('calculateEnergyPlan', () => {
  it('la menținere ținta este egală cu cheltuiala zilnică', () => {
    const plan = calculateEnergyPlan({ ...male, activityLevel: 'moderate', goal: 'maintain' });
    expect(plan.tdee).toBe(Math.round(1805 * 1.55));
    expect(plan.targetCalories).toBe(Math.round((1805 * 1.55) / 10) * 10);
  });

  it('la slăbire aplică deficitul calculat din greutatea-țintă și perioadă', () => {
    // 5 kg în 10 săptămâni -> 5*7700/70 = 550 kcal/zi deficit
    const plan = calculateEnergyPlan({
      ...male,
      activityLevel: 'moderate',
      goal: 'lose',
      targetWeightKg: 75,
      weeks: 10,
    });
    expect(plan.targetCalories).toBe(Math.round((1805 * 1.55 - 550) / 10) * 10);
  });

  it('limitează deficitul zilnic la 1000 kcal', () => {
    const plan = calculateEnergyPlan({
      ...male,
      activityLevel: 'very_active',
      goal: 'lose',
      targetWeightKg: 60,
      weeks: 2,
    });
    expect(plan.targetCalories).toBe(Math.round((1805 * 1.9 - 1000) / 10) * 10);
  });

  it('nu coboară sub aportul minim', () => {
    const plan = calculateEnergyPlan({
      ...female,
      weightKg: 50,
      activityLevel: 'sedentary',
      goal: 'lose',
      targetWeightKg: 45,
      weeks: 1,
    });
    expect(plan.targetCalories).toBe(MIN_CALORIES.female);
  });

  it('la masă musculară adaugă un surplus de 10%', () => {
    const plan = calculateEnergyPlan({ ...male, activityLevel: 'light', goal: 'muscle' });
    expect(plan.targetCalories).toBe(Math.round((1805 * 1.375 * 1.1) / 10) * 10);
  });
});

describe('calculateMacros', () => {
  it('distribuie caloriile între proteine, grăsimi și carbohidrați', () => {
    const m = calculateMacros(2500, 80, 'muscle');
    expect(m.proteinG).toBe(144);
    expect(m.fatG).toBe(69);
    const total = m.proteinG * 4 + m.fatG * 9 + m.carbsG * 4;
    expect(Math.abs(total - 2500)).toBeLessThan(10);
  });
});
