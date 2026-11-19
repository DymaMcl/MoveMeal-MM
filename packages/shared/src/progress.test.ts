import { describe, expect, it } from 'vitest';
import { analyzeProgress, movingAverage7, type WeightEntry } from './progress.ts';

const today = '2026-11-29';
const days = Array.from({ length: 14 }, (_, i) => {
  const d = new Date('2026-11-16T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return d.toISOString().slice(0, 10);
});

/** Jurnal simulat: greutatea scade/creste liniar cu `perWeekPct` pe saptamana. */
function simulate(startKg: number, perWeekPct: number): WeightEntry[] {
  return days.map((day, i) => ({
    day,
    kg: Math.round(startKg * (1 + (perWeekPct / 100) * (i / 7)) * 100) / 100,
  }));
}

const base = {
  sex: 'male' as const,
  today,
  loggedDays: days,
  currentTarget: 2345,
  tdee: 2759,
};

describe('analyzeProgress', () => {
  it('nu propune nimic fara suficiente date', () => {
    const fewWeights = analyzeProgress({
      ...base,
      goal: 'lose',
      weights: simulate(80, -0.1).slice(0, 5),
    });
    expect(fewWeights.status).toBe('insufficient_data');
    const fewLogs = analyzeProgress({
      ...base,
      goal: 'lose',
      weights: simulate(80, -0.1),
      loggedDays: days.slice(0, 9),
    });
    expect(fewLogs.status).toBe('insufficient_data');
  });

  it('slabire prea lenta: propune scaderea tintei cu 5%, rotunjita la 5 kcal', () => {
    const result = analyzeProgress({ ...base, goal: 'lose', weights: simulate(80, -0.1) });
    expect(result.status).toBe('adjust');
    if (result.status === 'adjust') {
      expect(result.direction).toBe('decrease');
      expect(result.proposedTarget).toBe(2230); // 2345 × 0,95 = 2227,75 → 2230
    }
  });

  it('slabire prea rapida: propune cresterea tintei', () => {
    const result = analyzeProgress({ ...base, goal: 'lose', weights: simulate(80, -1.2) });
    expect(result.status).toBe('adjust');
    if (result.status === 'adjust') {
      expect(result.direction).toBe('increase');
      expect(result.proposedTarget).toBe(2460); // 2345 × 1,05 = 2462,25 → 2460
    }
  });

  it('ritm in interval: nicio modificare', () => {
    const result = analyzeProgress({ ...base, goal: 'lose', weights: simulate(80, -0.5) });
    expect(result.status).toBe('on_track');
  });

  it('respecta limitele de siguranta', () => {
    // Tinta deja la -20% din necesar: nu se mai poate cobori.
    const result = analyzeProgress({
      ...base,
      goal: 'lose',
      currentTarget: 2210,
      weights: simulate(80, 0),
    });
    expect(result.status).toBe('at_limit');
  });

  it('crestere in masa prea lenta: propune cresterea tintei', () => {
    const result = analyzeProgress({
      ...base,
      goal: 'muscle',
      currentTarget: 3030,
      weights: simulate(70, 0),
    });
    expect(result.status).toBe('adjust');
    if (result.status === 'adjust') expect(result.direction).toBe('increase');
  });

  it('mentinere: variatia de pana la ±0,25% este in interval', () => {
    expect(
      analyzeProgress({
        ...base,
        goal: 'maintain',
        currentTarget: 2759,
        weights: simulate(70, 0.2),
      }).status,
    ).toBe('on_track');
    expect(
      analyzeProgress({
        ...base,
        goal: 'maintain',
        currentTarget: 2759,
        weights: simulate(70, 0.6),
      }).status,
    ).toBe('adjust');
  });
});

describe('movingAverage7', () => {
  it('calculeaza media ultimelor 7 zile pentru fiecare masuratoare', () => {
    const avg = movingAverage7([
      { day: '2026-11-01', kg: 80 },
      { day: '2026-11-02', kg: 82 },
      { day: '2026-11-10', kg: 79 },
    ]);
    expect(avg.map((a) => a.avg)).toEqual([80, 81, 79]);
  });
});
