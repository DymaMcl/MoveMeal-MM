import { describe, expect, it } from 'vitest';
import { projectDay, PROJECTION_DAYS } from './day-summary.ts';

const base = { targetKcal: 2000, tdee: 2500, weightKg: 80, sex: 'male' as const };

describe('projectDay', () => {
  it('nu face prognoza pentru o zi goala', () => {
    expect(projectDay({ ...base, consumedKcal: 0 })).toEqual({ status: 'empty' });
  });

  it('nu face prognoza sub minimul sigur (zi incompleta sau aport prea mic)', () => {
    expect(projectDay({ ...base, consumedKcal: 900 })).toEqual({
      status: 'below_minimum',
      minimumKcal: 1500,
    });
    expect(projectDay({ ...base, sex: 'female', consumedKcal: 1250 }).status).toBe('ok');
  });

  it('calculeaza schimbarea pe 5 saptamani din deficit (7700 kcal = 1 kg)', () => {
    const p = projectDay({ ...base, consumedKcal: 2000 });
    expect(p.status).toBe('ok');
    if (p.status !== 'ok') return;
    // -500 kcal/zi × 35 zile / 7700 = -2,27 kg
    expect(p.balanceKcal).toBe(-500);
    expect(p.changeKg).toBe(-2.3);
    expect(p.projectedKg).toBe(77.7);
    expect(p.days).toBe(PROJECTION_DAYS);
    expect(p.verdict).toBe('on_target');
  });

  it('arata surplusul si depasirea tintei', () => {
    const p = projectDay({ ...base, consumedKcal: 3000 });
    if (p.status !== 'ok') throw new Error('status');
    expect(p.verdict).toBe('over');
    expect(p.vsTargetKcal).toBe(1000);
    expect(p.changeKg).toBe(2.3);
  });

  it('considera „in tinta” abaterile mici', () => {
    const near = projectDay({ ...base, consumedKcal: 1920 });
    const under = projectDay({ ...base, consumedKcal: 1700 });
    expect(near.status === 'ok' && near.verdict).toBe('on_target');
    expect(under.status === 'ok' && under.verdict).toBe('under');
  });

  it('nu intoarce -0 cand bilantul este echilibrat', () => {
    const p = projectDay({ ...base, consumedKcal: 2500 });
    expect(p.status === 'ok' && Object.is(p.changeKg, -0)).toBe(false);
  });
});
