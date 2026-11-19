import type { Weekday } from '@movemeal/shared';

/** Data locala in formatul AAAA-LL-ZZ (fara conversie in UTC). */
export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ziua saptamanii cu luni = 0 … duminica = 6. */
export function weekdayOf(date: Date): Weekday {
  return ((date.getDay() + 6) % 7) as Weekday;
}

/** Cele 7 zile ale saptamanii curente, de luni pana duminica. */
export function currentWeek(today = new Date()): Date[] {
  const monday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - weekdayOf(today),
  );
  return Array.from(
    { length: 7 },
    (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
  );
}

/** „joi, 20 nov.” pentru o data AAAA-LL-ZZ, in limba data (fara deplasare de fus orar). */
export function formatDay(day: string, locale: string, long = false): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString(locale, {
    weekday: long ? 'long' : 'short',
    day: 'numeric',
    month: long ? 'long' : 'short',
  });
}

/** Data dintr-un moment ISO, de exemplu „20 nov. 2026”. */
export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
