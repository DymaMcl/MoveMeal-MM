import type { MealSlot, Nutrients, NutritionPreferences } from '@movemeal/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  ApiError,
  type FoodLogEntry,
  type LogMeal,
  type NutritionProgram,
} from '@/api/client';
import { useAppState } from './app-state';
import { isoDate } from './dates';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface NutritionValue {
  status: Status;
  program: NutritionProgram | null;
  reload: () => Promise<void>;
  savePreferences: (prefs: NutritionPreferences) => Promise<void>;
  regenerate: (weekday?: number) => Promise<void>;
  replaceMeal: (weekday: number, slot: MealSlot, recipeId: string) => Promise<void>;

  /** Jurnalul pe zile (AAAA-LL-ZZ → inregistrari). */
  log: Record<string, FoodLogEntry[]>;
  loadDay: (day: string) => Promise<void>;
  addEntry: (entry: {
    day: string;
    meal: LogMeal;
    source: 'food' | 'recipe';
    refId: string;
    amount: number;
  }) => Promise<void>;
  eatPlanned: (day: string, slot: MealSlot) => Promise<void>;
  deleteEntry: (entry: FoodLogEntry) => Promise<void>;

  waterToday: number;
  addWater: (ml: number) => Promise<void>;
}

const NutritionContext = createContext<NutritionValue | null>(null);

export const ZERO: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function sumEntries(entries: FoodLogEntry[] = []): Nutrients {
  return entries.reduce(
    (s, e) => ({
      kcal: s.kcal + e.kcal,
      protein: s.protein + e.protein,
      carbs: s.carbs + e.carbs,
      fat: s.fat + e.fat,
    }),
    ZERO,
  );
}

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { session } = useAppState();
  const token = session?.token ?? null;
  const [status, setStatus] = useState<Status>('idle');
  const [program, setProgram] = useState<NutritionProgram | null>(null);
  const [log, setLog] = useState<Record<string, FoodLogEntry[]>>({});
  const [waterToday, setWaterToday] = useState(0);

  const loadDay = useCallback(
    async (day: string) => {
      if (!token) return;
      const entries = await api.foodLog(token, day);
      setLog((prev) => ({ ...prev, [day]: entries }));
    },
    [token],
  );

  const reload = useCallback(async () => {
    if (!token) return;
    setStatus('loading');
    const today = isoDate(new Date());
    try {
      const [loaded, , water] = await Promise.all([
        api.getNutrition(token).catch((e: unknown) => {
          if (e instanceof ApiError && e.status === 404) return null;
          throw e;
        }),
        loadDay(today),
        api.water(token, today),
      ]);
      setProgram(loaded);
      setWaterToday(water.ml);
      setStatus(loaded ? 'ready' : 'empty');
    } catch {
      setStatus('error');
    }
  }, [token, loadDay]);

  useEffect(() => {
    setProgram(null);
    setLog({});
    setWaterToday(0);
    setStatus('idle');
    if (token) void reload();
  }, [token, reload]);

  const savePreferences = useCallback(
    async (prefs: NutritionPreferences) => {
      if (!token) throw new Error('Nu exista sesiune');
      setProgram(await api.saveNutritionPreferences(token, prefs));
      setStatus('ready');
    },
    [token],
  );

  const regenerate = useCallback(
    async (weekday?: number) => {
      if (!token) return;
      setProgram(await api.regenerateNutrition(token, weekday));
    },
    [token],
  );

  const replaceMeal = useCallback(
    async (weekday: number, slot: MealSlot, recipeId: string) => {
      if (!token) return;
      setProgram(await api.replaceMeal(token, weekday, slot, recipeId));
    },
    [token],
  );

  const addEntry = useCallback<NutritionValue['addEntry']>(
    async (entry) => {
      if (!token) return;
      const saved = await api.addFoodLog(token, entry);
      setLog((prev) => ({ ...prev, [entry.day]: [...(prev[entry.day] ?? []), saved] }));
    },
    [token],
  );

  const eatPlanned = useCallback(
    async (day: string, slot: MealSlot) => {
      if (!token) return;
      const saved = await api.eatPlannedMeal(token, day, slot);
      setLog((prev) => ({ ...prev, [day]: [...(prev[day] ?? []), saved] }));
    },
    [token],
  );

  const deleteEntry = useCallback(
    async (entry: FoodLogEntry) => {
      if (!token) return;
      await api.deleteFoodLog(token, entry.id);
      setLog((prev) => ({
        ...prev,
        [entry.day]: (prev[entry.day] ?? []).filter((e) => e.id !== entry.id),
      }));
    },
    [token],
  );

  const addWater = useCallback(
    async (ml: number) => {
      if (!token) return;
      const next = Math.max(0, Math.min(10000, waterToday + ml));
      setWaterToday(next);
      try {
        await api.setWater(token, isoDate(new Date()), next);
      } catch {
        setWaterToday(waterToday);
      }
    },
    [token, waterToday],
  );

  const value = useMemo<NutritionValue>(
    () => ({
      status,
      program,
      reload,
      savePreferences,
      regenerate,
      replaceMeal,
      log,
      loadDay,
      addEntry,
      eatPlanned,
      deleteEntry,
      waterToday,
      addWater,
    }),
    [
      status,
      program,
      reload,
      savePreferences,
      regenerate,
      replaceMeal,
      log,
      loadDay,
      addEntry,
      eatPlanned,
      deleteEntry,
      waterToday,
      addWater,
    ],
  );
  return <NutritionContext.Provider value={value}>{children}</NutritionContext.Provider>;
}

export function useNutrition(): NutritionValue {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition trebuie folosit in interiorul NutritionProvider');
  return ctx;
}

/** Corespondenta dintre locul mesei din plan si sectiunea din jurnal. */
export const SLOT_TO_LOG: Record<MealSlot, LogMeal> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack1: 'snack',
  snack2: 'snack',
};
