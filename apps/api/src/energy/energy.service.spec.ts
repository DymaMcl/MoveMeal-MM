import { EnergyService } from './energy.service.js';

describe('EnergyService', () => {
  const service = new EnergyService();
  const base = { age: 22, sex: 'male' as const, heightCm: 180, weightKg: 90 };

  it('calculeaza planul pentru mentinere fara verificarea obiectivului', () => {
    const result = service.calculate({ ...base, activityLevel: 'light', goal: 'maintain' });
    expect(result.goalCheck).toBeNull();
    expect(result.plan.bmr).toBe(1920);
    expect(result.plan.tdee).toBe(2640);
  });

  it('foloseste perioada recomandata cand cea propusa este prea scurta', () => {
    const result = service.calculate({
      ...base,
      activityLevel: 'light',
      goal: 'lose',
      targetWeightKg: 70,
      weeks: 4,
    });
    expect(result.goalCheck?.status).toBe('too_fast');
    expect(result.goalCheck?.recommendedWeeks).toBe(23);
    // 20 kg in 23 de saptamani -> deficit de ~956 kcal/zi
    expect(result.plan.targetCalories).toBe(1680);
  });
});
