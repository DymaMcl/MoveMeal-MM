import { describe, expect, it } from 'vitest';
import { EXERCISES, getExercise } from './exercises.ts';
import {
  generateWorkoutPlan,
  isAvailable,
  validatePreferences,
  weeklySetsByGroup,
} from './generator.ts';
import type { WorkoutPreferences } from './types.ts';

const base: WorkoutPreferences = {
  location: 'gym',
  level: 'moderate',
  days: [0, 2, 4],
  equipment: [],
  sports: [],
  limitations: [],
  focus: [],
};

const exercisesOf = (plan: ReturnType<typeof generateWorkoutPlan>) =>
  plan.sessions.flatMap((s) => s.exercises.map((p) => getExercise(p.exerciseId)!));

describe('catalogul de exercitii', () => {
  it('are identificatori unici si instructiuni in ambele limbi', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    for (const e of EXERCISES) {
      expect(e.steps.ro.length).toBeGreaterThanOrEqual(3);
      expect(e.steps.en.length).toBe(e.steps.ro.length);
    }
  });

  it('acopera fiecare grupa musculara si acasa, fara echipament', () => {
    const home = { ...base, location: 'home' as const };
    const groups = new Set(EXERCISES.filter((e) => isAvailable(e, home)).map((e) => e.group));
    for (const g of ['chest', 'back', 'arms', 'core', 'legs', 'glutes'])
      expect(groups).toContain(g);
  });
});

describe('validatePreferences', () => {
  it('verifica numarul de zile pentru fiecare nivel', () => {
    expect(validatePreferences({ ...base, level: 'light', days: [0, 3] })).toEqual([]);
    expect(validatePreferences({ ...base, level: 'light', days: [0, 1, 2, 3] })).toContain(
      'days_count',
    );
    expect(validatePreferences({ ...base, level: 'intense', days: [0, 1, 2] })).toContain(
      'days_count',
    );
  });

  it('respinge zilele duplicate si prea multe grupe de accent', () => {
    expect(validatePreferences({ ...base, days: [0, 0, 2] })).toContain('duplicate_days');
    expect(validatePreferences({ ...base, focus: ['arms', 'legs', 'back'] })).toContain(
      'too_many_focus_groups',
    );
  });
});

describe('generateWorkoutPlan', () => {
  it('creeaza cate o sedinta pentru fiecare zi aleasa, in ordinea saptamanii', () => {
    const plan = generateWorkoutPlan({ ...base, days: [4, 0, 2] }, 'maintain');
    expect(plan.sessions.map((s) => s.weekday)).toEqual([0, 2, 4]);
    expect(plan.sessions.map((s) => s.template)).toEqual(['full_a', 'full_b', 'full_c']);
  });

  it('alege impartirea in functie de numarul de zile', () => {
    const four = generateWorkoutPlan({ ...base, days: [0, 1, 3, 4] }, 'muscle');
    expect(four.sessions.map((s) => s.template)).toEqual(['upper', 'lower', 'upper', 'lower']);
    const five = generateWorkoutPlan(
      { ...base, level: 'intense', days: [0, 1, 2, 3, 4] },
      'muscle',
    );
    expect(five.sessions.map((s) => s.template)).toEqual([
      'push',
      'pull',
      'legs',
      'upper',
      'lower',
    ]);
  });

  it('acasa foloseste doar echipamentul declarat', () => {
    const prefs = { ...base, location: 'home' as const, equipment: ['bands' as const] };
    const plan = generateWorkoutPlan(prefs, 'maintain');
    for (const e of exercisesOf(plan)) {
      expect(e.requires.some((o) => o.every((i) => i === 'bands'))).toBe(true);
    }
    expect(exercisesOf(plan).some((e) => e.requires.some((o) => o.includes('bands')))).toBe(true);
  });

  it('fara echipament genereaza un program doar cu greutatea corpului', () => {
    const plan = generateWorkoutPlan({ ...base, location: 'home' }, 'lose');
    expect(plan.sessions.every((s) => s.exercises.length >= 4)).toBe(true);
    for (const e of exercisesOf(plan)) expect(e.requires).toContainEqual([]);
  });

  it('evita exercitiile care solicita zonele cu limitari', () => {
    const plan = generateWorkoutPlan({ ...base, limitations: ['knees', 'lower_back'] }, 'maintain');
    for (const e of exercisesOf(plan)) {
      expect(e.stresses).not.toContain('knees');
      expect(e.stresses).not.toContain('lower_back');
    }
  });

  it('nu repeta un exercitiu in aceeasi sedinta', () => {
    const plan = generateWorkoutPlan(
      { ...base, level: 'intense', days: [0, 1, 2, 3, 4], focus: ['arms', 'chest'] },
      'muscle',
    );
    for (const s of plan.sessions) {
      const ids = s.exercises.map((p) => p.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('accentul pe o grupa adauga volum moderat, fara a dubla programul', () => {
    const normal = generateWorkoutPlan(base, 'muscle');
    const focused = generateWorkoutPlan({ ...base, focus: ['arms'] }, 'muscle');
    const before = weeklySetsByGroup(normal).arms;
    const after = weeklySetsByGroup(focused).arms;
    expect(after).toBeGreaterThan(before);
    for (let i = 0; i < normal.sessions.length; i++) {
      const extra = focused.sessions[i].exercises.length - normal.sessions[i].exercises.length;
      expect(extra).toBeLessThanOrEqual(1);
    }
    // Exercitiile suplimentare sunt marcate, iar abdomenul ramane la final.
    for (const s of focused.sessions) {
      expect(getExercise(s.exercises.at(-1)!.exerciseId)!.group).toBe('core');
    }
    expect(focused.sessions.some((s) => s.exercises.some((p) => p.focus))).toBe(true);
  });

  it('accentul se aplica doar in sedintele care lucreaza grupa respectiva', () => {
    const plan = generateWorkoutPlan({ ...base, days: [0, 1, 3, 4], focus: ['arms'] }, 'muscle');
    const lower = plan.sessions.filter((s) => s.template === 'lower');
    expect(lower.every((s) => s.exercises.every((p) => !p.focus))).toBe(true);
  });

  it('reduce volumul pentru picioare la cei care alearga', () => {
    const prefs = { ...base, days: [0, 1, 3, 4] as WorkoutPreferences['days'] };
    const normal = weeklySetsByGroup(generateWorkoutPlan(prefs, 'maintain'));
    const runner = generateWorkoutPlan({ ...prefs, sports: ['running'] }, 'maintain');
    expect(runner.warnings).toContain('reduced_legs_for_sports');
    const reduced = weeklySetsByGroup(runner);
    expect(reduced.legs + reduced.glutes).toBeLessThan(normal.legs + normal.glutes);
  });

  it('semnaleaza antrenamentele full body in zile consecutive', () => {
    expect(generateWorkoutPlan({ ...base, days: [0, 1, 3] }, 'maintain').warnings).toContain(
      'consecutive_full_body',
    );
    expect(generateWorkoutPlan(base, 'maintain').warnings).not.toContain('consecutive_full_body');
  });

  it('adapteaza repetarile si pauzele la obiectiv', () => {
    const lose = generateWorkoutPlan(base, 'lose').sessions[0].exercises[0];
    const muscle = generateWorkoutPlan(base, 'muscle').sessions[0].exercises[0];
    expect(lose.target).toBe('12-15');
    expect(muscle.target).toBe('8-12');
    expect(muscle.restSec).toBeGreaterThan(lose.restSec);
    expect(muscle.sets).toBeGreaterThanOrEqual(lose.sets);
  });

  it('nivelul usor are cel mult 5 exercitii pe sedinta', () => {
    const plan = generateWorkoutPlan({ ...base, level: 'light', days: [1, 4] }, 'maintain');
    expect(plan.sessions.every((s) => s.exercises.length <= 5)).toBe(true);
    expect(exercisesOf(plan).every((e) => e.difficulty <= 2)).toBe(true);
  });
});

describe('alegerea exercitiilor potrivite', () => {
  const intense = {
    ...base,
    level: 'intense' as const,
    days: [0, 1, 2, 3, 4] as WorkoutPreferences['days'],
  };

  it('la sala prefera aparatele si greutatile libere in locul benzilor', () => {
    const plan = generateWorkoutPlan(intense, 'muscle');
    const bands = exercisesOf(plan).filter((e) => e.requires.every((o) => o.includes('bands')));
    expect(bands).toEqual([]);
  });

  it('in ziua de tras lucreaza bicepsul, iar in cea de impins tricepsul', () => {
    const plan = generateWorkoutPlan(intense, 'muscle');
    const arms = (template: string) =>
      plan.sessions
        .find((s) => s.template === template)!
        .exercises.map((p) => getExercise(p.exerciseId)!)
        .filter((e) => e.group === 'arms');
    expect(arms('pull').every((e) => e.muscle === 'biceps')).toBe(true);
    expect(arms('push').every((e) => e.muscle === 'triceps')).toBe(true);
  });

  it('cu limitari la genunchi, zilele de picioare raman complete', () => {
    const plan = generateWorkoutPlan({ ...intense, limitations: ['knees'] }, 'muscle');
    for (const s of plan.sessions.filter((x) => x.template === 'legs' || x.template === 'lower')) {
      expect(s.exercises.length).toBeGreaterThanOrEqual(4);
    }
    expect(plan.warnings).not.toContain('missing_slots');
  });
});

describe('antrenamentul mixt (acasa si la sala)', () => {
  const mixed: WorkoutPreferences = {
    ...base,
    location: 'mixed',
    level: 'intense',
    days: [0, 1, 2, 3, 4, 5],
    homeDays: [1, 3, 5],
    equipment: ['dumbbells'],
  };

  it('valideaza zilele de acasa: cel putin una acasa si una la sala, dintre zilele alese', () => {
    expect(validatePreferences(mixed)).toEqual([]);
    expect(validatePreferences({ ...mixed, homeDays: [] })).toContain('mixed_days');
    expect(validatePreferences({ ...mixed, homeDays: [...mixed.days] })).toContain('mixed_days');
    expect(validatePreferences({ ...mixed, homeDays: [6] })).toContain('mixed_days');
    expect(validatePreferences({ ...mixed, homeDays: undefined })).toContain('mixed_days');
  });

  it('acasa foloseste doar echipamentul ales, iar la sala si aparatele', () => {
    const plan = generateWorkoutPlan(mixed, 'muscle');
    expect(plan.sessions).toHaveLength(6);
    for (const session of plan.sessions) {
      const expected = mixed.homeDays!.includes(session.weekday) ? 'home' : 'gym';
      expect(session.location).toBe(expected);
      if (expected === 'home') {
        for (const p of session.exercises) {
          expect(isAvailable(getExercise(p.exerciseId)!, mixed, 'home')).toBe(true);
        }
      }
    }
    // La sala apar si exercitii care cer aparate.
    const gymOnly = plan.sessions
      .filter((s) => s.location === 'gym')
      .flatMap((s) => s.exercises)
      .some((p) => getExercise(p.exerciseId)!.requires.every((o) => o.includes('gym')));
    expect(gymOnly).toBe(true);
  });

  it('6 zile: push / pull / legs de doua ori', () => {
    const plan = generateWorkoutPlan(mixed, 'muscle');
    expect(plan.sessions.map((s) => s.template)).toEqual([
      'push',
      'pull',
      'legs',
      'push',
      'pull',
      'legs',
    ]);
  });

  it('programele obisnuite au aceeasi locatie in toate sedintele', () => {
    const home = generateWorkoutPlan({ ...base, location: 'home', equipment: ['dumbbells'] }, 'lose');
    expect(home.sessions.every((s) => s.location === 'home')).toBe(true);
    const gym = generateWorkoutPlan(base, 'lose');
    expect(gym.sessions.every((s) => s.location === 'gym')).toBe(true);
  });
});
