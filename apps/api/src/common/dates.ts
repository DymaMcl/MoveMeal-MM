/** Fusul orar al aplicatiei (Laboratorul 2: Europe/Chisinau). */
export const APP_TIME_ZONE = 'Europe/Chisinau';

/** Data de azi in fusul orar al aplicatiei, in formatul AAAA-LL-ZZ. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function addDaysIso(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Inregistrarile pot fi adaugate sau modificate doar pentru ultimele 14 zile. */
export const EDITABLE_DAYS = 14;

export function isEditableDay(day: string, today = todayIso()): boolean {
  return day <= today && day > addDaysIso(today, -EDITABLE_DAYS);
}

/** 0 = luni … 6 = duminica, pentru o data AAAA-LL-ZZ. */
export function weekdayOfIso(day: string): number {
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
}
