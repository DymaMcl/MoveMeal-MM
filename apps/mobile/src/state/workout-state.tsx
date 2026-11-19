import type { WorkoutPreferences } from '@movemeal/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type WorkoutProgram } from '@/api/client';
import { useAppState } from './app-state';
import { currentWeek, isoDate } from './dates';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface WorkoutValue {
  status: Status;
  program: WorkoutProgram | null;
  /** Cheile „AAAA-LL-ZZ|exerciseId” ale exercitiilor bifate in saptamana curenta. */
  done: Set<string>;
  reload: () => Promise<void>;
  save: (preferences: WorkoutPreferences) => Promise<void>;
  toggle: (day: string, exerciseId: string) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutValue | null>(null);
const key = (day: string, exerciseId: string) => `${day}|${exerciseId}`;

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const { session } = useAppState();
  const token = session?.token ?? null;
  const [status, setStatus] = useState<Status>('idle');
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!token) return;
    setStatus('loading');
    const week = currentWeek();
    try {
      const [loaded, logs] = await Promise.all([
        api.getWorkout(token).catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
        api.getWorkoutLog(token, isoDate(week[0]), isoDate(week[6])),
      ]);
      setProgram(loaded);
      setDone(new Set(logs.map((l) => key(l.day, l.exerciseId))));
      setStatus(loaded ? 'ready' : 'empty');
    } catch {
      setStatus('error');
    }
  }, [token]);

  // La schimbarea contului se reincarca datele (si se golesc la iesire).
  useEffect(() => {
    setProgram(null);
    setDone(new Set());
    setStatus('idle');
    if (token) void reload();
  }, [token, reload]);

  const save = useCallback(
    async (preferences: WorkoutPreferences) => {
      if (!token) throw new Error('Nu exista sesiune');
      const saved = await api.saveWorkout(token, preferences);
      setProgram(saved);
      setStatus('ready');
    },
    [token],
  );

  const toggle = useCallback(
    async (day: string, exerciseId: string) => {
      if (!token) return;
      const k = key(day, exerciseId);
      const next = !done.has(k);
      // Actualizare imediata in interfata; se revine daca serverul refuza.
      setDone((prev) => {
        const copy = new Set(prev);
        if (next) copy.add(k);
        else copy.delete(k);
        return copy;
      });
      try {
        await api.setWorkoutLog(token, day, exerciseId, next);
      } catch {
        setDone((prev) => {
          const copy = new Set(prev);
          if (next) copy.delete(k);
          else copy.add(k);
          return copy;
        });
      }
    },
    [token, done],
  );

  const value = useMemo(
    () => ({ status, program, done, reload, save, toggle }),
    [status, program, done, reload, save, toggle],
  );
  return <WorkoutContext.Provider value={value}>{children}</WorkoutContext.Provider>;
}

export function useWorkout(): WorkoutValue {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout trebuie folosit in interiorul WorkoutProvider');
  return ctx;
}

export const isDone = (done: Set<string>, day: string, exerciseId: string) =>
  done.has(key(day, exerciseId));
