import { describe, expect, it } from 'vitest';
import {
  assessBody,
  bmiCategory,
  bodyFatLevel,
  estimateBodyFat,
  healthyWeightRange,
  waistRisk,
} from './body.ts';

describe('cantarul ponderal', () => {
  it('clasifica IMC dupa pragurile OMS', () => {
    expect(bmiCategory(15.9)).toBe('severe_thinness');
    expect(bmiCategory(17)).toBe('thinness');
    expect(bmiCategory(18.5)).toBe('normal');
    expect(bmiCategory(24.99)).toBe('normal');
    expect(bmiCategory(25)).toBe('overweight');
    expect(bmiCategory(30)).toBe('obese1');
    expect(bmiCategory(35)).toBe('obese2');
    expect(bmiCategory(41)).toBe('obese3');
  });

  it('calculeaza intervalul de greutate sanatoasa', () => {
    expect(healthyWeightRange(180)).toEqual({ min: 59.9, max: 80.7 });
  });

  it('estimeaza grasimea corporala (Deurenberg)', () => {
    // 1.2*22 + 0.23*30 - 10.8 - 5.4 = 17.1
    expect(estimateBodyFat(22, 30, 'male')).toBe(17.1);
    expect(bodyFatLevel(17.1, 'male')).toBe('fitness');
    expect(bodyFatLevel(33, 'female')).toBe('high');
  });

  it('evalueaza riscul dupa raportul talie/inaltime', () => {
    expect(waistRisk(80, 180)).toEqual({ ratio: 0.44, risk: 'low' });
    expect(waistRisk(95, 170).risk).toBe('increased');
    expect(waistRisk(110, 170).risk).toBe('high');
  });

  it('rezuma starea corpului si kilogramele pana la intervalul normal', () => {
    const over = assessBody({ age: 30, sex: 'male', heightCm: 180, weightKg: 95 });
    expect(over).toMatchObject({ bmi: 29.3, category: 'overweight', status: 'over' });
    expect(over.toHealthy).toBe(14.3);
    expect(over.bmr).toBe(1930);

    const under = assessBody({ age: 17, sex: 'female', heightCm: 170, weightKg: 50 });
    expect(under).toMatchObject({ status: 'under', minor: true });
    expect(under.toHealthy).toBeLessThan(0);

    expect(assessBody({ age: 40, sex: 'female', heightCm: 165, weightKg: 60 }).toHealthy).toBe(0);
  });
});
