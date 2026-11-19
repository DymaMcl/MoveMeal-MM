import type { Goal } from '../types.ts';
import { EXERCISES } from './exercises.ts';
import type {
  Exercise,
  MovementPattern,
  MuscleGroup,
  PlanWarning,
  Prescription,
  SessionTemplate,
  Weekday,
  WorkoutLevel,
  WorkoutPlan,
  WorkoutPreferences,
  WorkoutSession,
} from './types.ts';

/** Numarul de zile recomandat pentru fiecare nivel. */
export const LEVEL_DAYS: Record<WorkoutLevel, { min: number; max: number }> = {
  light: { min: 2, max: 3 },
  moderate: { min: 3, max: 4 },
  intense: { min: 5, max: 5 },
};

export const MAX_FOCUS_GROUPS = 2;
/** Cel mult atatea exercitii suplimentare pe sedinta pentru grupele alese ca accent. */
const MAX_FOCUS_EXTRAS_PER_SESSION = 2;

export type PreferencesError =
  'days_count' | 'duplicate_days' | 'too_many_focus_groups' | 'invalid_day';

/** Verifica preferintele; intoarce lista de probleme (goala daca sunt valide). */
export function validatePreferences(prefs: WorkoutPreferences): PreferencesError[] {
  const errors: PreferencesError[] = [];
  const { min, max } = LEVEL_DAYS[prefs.level];
  if (prefs.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) errors.push('invalid_day');
  if (new Set(prefs.days).size !== prefs.days.length) errors.push('duplicate_days');
  if (prefs.days.length < min || prefs.days.length > max) errors.push('days_count');
  if (prefs.focus.length > MAX_FOCUS_GROUPS) errors.push('too_many_focus_groups');
  return errors;
}

// ---------------------------------------------------------------------------
// Sabloanele sedintelor: fiecare „slot” cere un tip de miscare.

interface Slot {
  /** Tiparele de miscare acceptate, in ordinea preferintei. */
  patterns: MovementPattern[];
  /** Grupele musculare acceptate (daca lipseste, orice grupa). */
  groups?: MuscleGroup[];
  /** Pentru brate: biceps sau triceps. */
  muscle?: 'biceps' | 'triceps';
  /** Grupele din care se alege o alternativa daca niciun exercitiu nu se potriveste slotului. */
  fallback?: MuscleGroup[];
  /** Slot care poate fi eliminat pentru cei care practica sporturi solicitante pentru picioare. */
  legAccessory?: boolean;
  /** Slot care poate fi eliminat pentru inotatori (solicitare mare a umerilor). */
  shoulderAccessory?: boolean;
}

const LOWER: MuscleGroup[] = ['legs', 'glutes'];

const S = {
  squat: { patterns: ['squat'], groups: ['legs'], fallback: LOWER } as Slot,
  lunge: { patterns: ['lunge'], legAccessory: true, fallback: LOWER } as Slot,
  hinge: { patterns: ['hinge', 'glute'], fallback: LOWER } as Slot,
  glute: {
    patterns: ['glute', 'hinge'],
    groups: LOWER,
    legAccessory: true,
    fallback: LOWER,
  } as Slot,
  legIso: {
    patterns: ['isolation', 'glute'],
    groups: LOWER,
    legAccessory: true,
    fallback: LOWER,
  } as Slot,
  pushH: { patterns: ['push_h'], groups: ['chest'] } as Slot,
  pushV: { patterns: ['push_v', 'push_h'], groups: ['shoulders', 'chest'] } as Slot,
  pullH: { patterns: ['pull_h'], groups: ['back'], fallback: ['back'] } as Slot,
  pullV: { patterns: ['pull_v', 'pull_h'], groups: ['back'], fallback: ['back'] } as Slot,
  shoulderIso: {
    patterns: ['isolation', 'pull_h', 'push_v'],
    groups: ['shoulders'],
    shoulderAccessory: true,
  } as Slot,
  rearShoulder: {
    patterns: ['pull_h', 'isolation'],
    groups: ['shoulders', 'back'],
    shoulderAccessory: true,
  } as Slot,
  chestIso: { patterns: ['isolation', 'push_h'], groups: ['chest'] } as Slot,
  biceps: {
    patterns: ['isolation'],
    groups: ['arms'],
    muscle: 'biceps',
    fallback: ['arms'],
  } as Slot,
  triceps: {
    patterns: ['isolation', 'push_h'],
    groups: ['arms'],
    muscle: 'triceps',
    fallback: ['arms'],
  } as Slot,
  core: { patterns: ['core'], groups: ['core'] } as Slot,
};

const TEMPLATES: Record<SessionTemplate, Slot[]> = {
  full_a: [S.squat, S.pushH, S.pullV, S.glute, S.shoulderIso, S.core],
  full_b: [S.hinge, S.pushV, S.pullH, S.lunge, S.biceps, S.core],
  full_c: [S.squat, S.pushH, S.pullH, S.glute, S.triceps, S.core],
  upper: [S.pushH, S.pullV, S.pushV, S.pullH, S.biceps, S.core],
  lower: [S.squat, S.hinge, S.lunge, S.legIso, S.core],
  push: [S.pushH, S.pushV, S.chestIso, S.shoulderIso, S.triceps, S.core],
  pull: [S.pullV, S.pullH, S.rearShoulder, S.biceps, S.core],
  legs: [S.squat, S.hinge, S.lunge, S.glute, S.core],
};

/** Grupele musculare lucrate in fiecare tip de sedinta (pentru accent). */
const TEMPLATE_GROUPS: Record<SessionTemplate, MuscleGroup[]> = {
  full_a: ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes'],
  full_b: ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes'],
  full_c: ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes'],
  upper: ['chest', 'back', 'shoulders', 'arms', 'core'],
  lower: ['legs', 'glutes', 'core'],
  push: ['chest', 'shoulders', 'arms', 'core'],
  pull: ['back', 'shoulders', 'arms', 'core'],
  legs: ['legs', 'glutes', 'core'],
};

function splitFor(daysCount: number): SessionTemplate[] {
  if (daysCount <= 2) return ['full_a', 'full_b'].slice(0, daysCount) as SessionTemplate[];
  if (daysCount === 3) return ['full_a', 'full_b', 'full_c'];
  if (daysCount === 4) return ['upper', 'lower', 'upper', 'lower'];
  return ['push', 'pull', 'legs', 'upper', 'lower'];
}

// ---------------------------------------------------------------------------
// Filtrarea exercitiilor

export function isAvailable(exercise: Exercise, prefs: WorkoutPreferences): boolean {
  if (exercise.stresses.some((s) => prefs.limitations.includes(s))) return false;
  if (prefs.location === 'gym') return true;
  return exercise.requires.some((option) =>
    option.every((item) => item !== 'gym' && prefs.equipment.includes(item)),
  );
}

const MAX_DIFFICULTY: Record<WorkoutLevel, number> = { light: 2, moderate: 3, intense: 3 };
const PREFERRED_DIFFICULTY: Record<WorkoutLevel, number> = { light: 1, moderate: 2, intense: 3 };

function matches(exercise: Exercise, slot: Slot): boolean {
  return (
    slot.patterns.includes(exercise.pattern) &&
    (!slot.groups || slot.groups.includes(exercise.group)) &&
    (!slot.muscle || exercise.muscle === slot.muscle)
  );
}

/**
 * Cat de potrivit este echipamentul (0 = cel mai potrivit). La sala se prefera aparatele si
 * greutatile libere; acasa, greutatile libere inaintea benzilor si a greutatii corpului.
 */
function equipmentRank(exercise: Exercise, location: WorkoutPreferences['location']): number {
  const ranks = exercise.requires.map((option) => {
    if (option.length === 0) return 3;
    if (option.includes('gym')) return location === 'gym' ? 0 : 9;
    if (option.includes('bands')) return 2;
    return 1;
  });
  return Math.min(...ranks);
}

/**
 * Candidatii pentru un slot, ordonati: tiparul preferat, echipamentul potrivit locului,
 * apoi dificultatea cea mai apropiata de nivel.
 */
function candidates(slot: Slot, pool: Exercise[], prefs: WorkoutPreferences): Exercise[] {
  const target = PREFERRED_DIFFICULTY[prefs.level];
  return pool
    .filter((e) => matches(e, slot) && e.difficulty <= MAX_DIFFICULTY[prefs.level])
    .sort(
      (a, b) =>
        slot.patterns.indexOf(a.pattern) - slot.patterns.indexOf(b.pattern) ||
        equipmentRank(a, prefs.location) - equipmentRank(b, prefs.location) ||
        Math.abs(a.difficulty - target) - Math.abs(b.difficulty - target) ||
        a.id.localeCompare(b.id),
    );
}

const ALL_PATTERNS: MovementPattern[] = [
  'squat',
  'hinge',
  'glute',
  'lunge',
  'push_h',
  'push_v',
  'pull_v',
  'pull_h',
  'isolation',
  'core',
];

// ---------------------------------------------------------------------------
// Seriile, repetarile si pauzele in functie de obiectiv si nivel

function prescribe(
  exercise: Exercise,
  goal: Goal,
  level: WorkoutLevel,
  focus: boolean,
): Prescription {
  const compound = exercise.pattern !== 'isolation' && exercise.pattern !== 'core';
  const base = level === 'light' ? 3 : goal === 'muscle' || goal === 'gain' ? 4 : 3;
  const sets = compound ? base : Math.max(2, base - 1);

  let target: string;
  let restSec: number;
  if (exercise.unit === 'seconds') {
    target = level === 'light' ? '20-30' : '30-45';
    restSec = 45;
  } else if (exercise.group === 'core') {
    target = '12-15';
    restSec = 45;
  } else if (goal === 'muscle' || goal === 'gain') {
    target = compound ? '8-12' : '10-12';
    restSec = compound ? 90 : 60;
  } else if (goal === 'lose') {
    target = '12-15';
    restSec = compound ? 60 : 45;
  } else {
    target = '10-12';
    restSec = 60;
  }

  return { exerciseId: exercise.id, sets, target, restSec, ...(focus ? { focus: true } : {}) };
}

// ---------------------------------------------------------------------------

function hasConsecutiveDays(days: Weekday[]): boolean {
  const set = new Set(days);
  return days.some((d) => set.has(((d + 1) % 7) as Weekday));
}

const LEG_SPORTS = new Set(['running', 'cycling', 'football']);

const groupOf = (exerciseId: string) => EXERCISES.find((e) => e.id === exerciseId)?.group;

/**
 * Genereaza programul saptamanal. Volumul pentru grupele alese ca accent creste moderat
 * (cel mult un exercitiu in plus pe grupa si sedinta), pentru a nu afecta recuperarea.
 */
export function generateWorkoutPlan(prefs: WorkoutPreferences, goal: Goal): WorkoutPlan {
  const errors = validatePreferences(prefs);
  if (errors.length > 0) throw new Error(`Preferinte invalide: ${errors.join(', ')}`);

  const days = [...prefs.days].sort((a, b) => a - b);
  const templates = splitFor(days.length);
  const pool = EXERCISES.filter((e) => isAvailable(e, prefs));
  const legSports = prefs.sports.some((s) => LEG_SPORTS.has(s));
  const swimming = prefs.sports.includes('swimming');

  const warnings = new Set<PlanWarning>();
  if (templates[0].startsWith('full') && hasConsecutiveDays(days)) {
    warnings.add('consecutive_full_body');
  }

  // Cate aparitii are fiecare exercitiu in saptamana, pentru a varia alegerile.
  const weeklyUse = new Map<string, number>();

  const sessions: WorkoutSession[] = days.map((weekday, index) => {
    const template = templates[index];
    let slots = TEMPLATES[template];
    if (legSports) {
      // Cei care alearga, pedaleaza sau joaca fotbal pastreaza un singur exercitiu accesoriu pentru picioare.
      const firstAccessory = slots.find((s) => s.legAccessory);
      const reduced = slots.filter((s) => !s.legAccessory || s === firstAccessory);
      if (reduced.length < slots.length) warnings.add('reduced_legs_for_sports');
      slots = reduced;
    }
    if (swimming && slots.some((s) => s.shoulderAccessory)) {
      slots = slots.filter((s) => !s.shoulderAccessory);
      warnings.add('reduced_shoulders_for_swimming');
    }
    if (prefs.level === 'light') {
      // Nivel usor: cel mult 5 exercitii, pastrand miscarea de baza si abdomenul.
      const core = slots.filter((s) => s === S.core);
      slots = [...slots.filter((s) => s !== S.core).slice(0, 4), ...core];
    }

    const used = new Set<string>();
    const pick = (slot: Slot): Exercise | undefined => {
      let list = candidates(slot, pool, prefs).filter((e) => !used.has(e.id));
      if (list.length === 0 && slot.fallback) {
        // Nicio varianta potrivita (de exemplu din cauza limitarilor): alt exercitiu pentru aceleasi grupe.
        list = candidates({ patterns: ALL_PATTERNS, groups: slot.fallback }, pool, prefs).filter(
          (e) => !used.has(e.id),
        );
      }
      if (list.length === 0) return undefined;
      // Preferam exercitiile folosite cel mai rar in saptamana; la egalitate, ordinea de calitate.
      const best = [...list].sort(
        (a, b) => (weeklyUse.get(a.id) ?? 0) - (weeklyUse.get(b.id) ?? 0),
      )[0];
      used.add(best.id);
      weeklyUse.set(best.id, (weeklyUse.get(best.id) ?? 0) + 1);
      return best;
    };

    const exercises: Prescription[] = [];
    for (const slot of slots) {
      const exercise = pick(slot);
      if (exercise) exercises.push(prescribe(exercise, goal, prefs.level, false));
    }
    // Cu prea putin echipament sau prea multe limitari, sedinta poate ramane scurta.
    if (exercises.length < 4) warnings.add('missing_slots');

    // Accentul pe grupele alese, doar in sedintele care lucreaza acele grupe.
    let extras = 0;
    for (const group of prefs.focus) {
      if (extras >= MAX_FOCUS_EXTRAS_PER_SESSION) break;
      if (!TEMPLATE_GROUPS[template].includes(group)) continue;
      const exercise = pick({ patterns: ALL_PATTERNS, groups: [group] });
      if (!exercise) continue;
      const item = prescribe(exercise, goal, prefs.level, true);
      // Abdomenul ramane ultimul in sedinta (daca accentul nu este chiar pe abdomen).
      const coreIndex = exercises.findIndex((p) => groupOf(p.exerciseId) === 'core');
      if (coreIndex >= 0 && group !== 'core') exercises.splice(coreIndex, 0, item);
      else exercises.push(item);
      extras += 1;
    }

    return { weekday, template, exercises };
  });

  return { sessions, warnings: [...warnings] };
}

/** Numarul total de serii pe grupa musculara intr-o saptamana. */
export function weeklySetsByGroup(plan: WorkoutPlan): Record<MuscleGroup, number> {
  const totals: Record<MuscleGroup, number> = {
    chest: 0,
    back: 0,
    shoulders: 0,
    arms: 0,
    core: 0,
    legs: 0,
    glutes: 0,
  };
  for (const session of plan.sessions) {
    for (const p of session.exercises) {
      const group = groupOf(p.exerciseId);
      if (group) totals[group] += p.sets;
    }
  }
  return totals;
}
