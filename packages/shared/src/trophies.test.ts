import { describe, expect, it } from 'vitest';
import { getTrophy, longestStreak, TROPHIES } from './trophies.ts';

describe('trofee', () => {
  it('are identificatori unici', () => {
    expect(new Set(TROPHIES.map((t) => t.id)).size).toBe(TROPHIES.length);
    expect(getTrophy('steps_10k_3')?.goal).toBe(3);
  });

  it('calculeaza cea mai lunga serie de zile consecutive', () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-11-01'])).toBe(1);
    expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-05', '2026-11-06'])).toBe(3);
    // Ordinea si duplicatele nu conteaza; trecerea dintre luni este continua.
    expect(longestStreak(['2026-12-01', '2026-11-30', '2026-11-30', '2026-11-29'])).toBe(3);
  });
});
