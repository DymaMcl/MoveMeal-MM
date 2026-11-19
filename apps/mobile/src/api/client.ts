import type {
  EnergyPlan,
  EnergyProfile,
  FoodCategory,
  MealPlan,
  MealSlot,
  Nutrients,
  NutritionPreferences,
  PlannedMeal,
  ProgressAnalysis,
  ShoppingItem,
  WorkoutPlan,
  WorkoutPreferences,
} from '@movemeal/shared';
import Constants from 'expo-constants';

/**
 * Adresa serverului. Implicit se foloseste calculatorul pe care ruleaza Expo
 * (acelasi IP ca serverul de dezvoltare), portul 3000.
 */
function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000/api`;
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Corpul raspunsului (de exemplu restrictia care blocheaza planul alimentar). */
    readonly data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Status 0 = serverul nu a putut fi contactat. */
export const isNetworkError = (e: unknown) => e instanceof ApiError && e.status === 0;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'network');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] };
  if (!res.ok) {
    const message = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? '');
    throw new ApiError(res.status, message, data as Record<string, unknown>);
  }
  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string };
}

export interface ProfileResponse {
  profile: EnergyProfile & { name: string };
  plan: EnergyPlan;
  /** Tinta calorica a fost modificata printr-o ajustare acceptata. */
  adjusted?: boolean;
}

export interface NutritionProgram {
  preferences: NutritionPreferences;
  plan: MealPlan;
}

export type LogMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLogEntry extends Nutrients {
  id: string;
  day: string;
  meal: LogMeal;
  source: 'food' | 'recipe';
  refId: string;
  name: string;
  amount: number;
  unit: 'g' | 'portion';
}

export interface Measurement {
  day: string;
  weightKg: number;
  waistCm: number | null;
  average7: number;
}

export interface ProgressResponse {
  analysis: ProgressAnalysis;
  lastAdjustment: { createdAt: string; status: string; proposedTarget: number } | null;
  loggedDaysThisWeek: number;
}

export const api = {
  register: (email: string, password: string, healthDataConsent: boolean) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: { email, password, healthDataConsent },
    }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: (token: string) => request<void>('/auth/logout', { method: 'POST', token }),
  me: (token: string) =>
    request<{ id: string; email: string; healthDataConsent: boolean }>('/me', { token }),
  getProfile: (token: string) => request<ProfileResponse>('/me/profile', { token }),
  saveProfile: (token: string, profile: EnergyProfile & { name: string }) =>
    request<ProfileResponse>('/me/profile', { method: 'PUT', body: profile, token }),
  getWorkout: (token: string) => request<WorkoutProgram>('/me/workout', { token }),
  saveWorkout: (token: string, preferences: WorkoutPreferences) =>
    request<WorkoutProgram>('/me/workout', { method: 'PUT', body: preferences, token }),
  getWorkoutLog: (token: string, from: string, to: string) =>
    request<WorkoutLogEntry[]>(`/me/workout/log?from=${from}&to=${to}`, { token }),
  setWorkoutLog: (token: string, day: string, exerciseId: string, done: boolean) =>
    request<void>('/me/workout/log', { method: 'PUT', body: { day, exerciseId, done }, token }),

  // Plan alimentar
  getNutrition: (token: string) => request<NutritionProgram>('/me/nutrition', { token }),
  saveNutritionPreferences: (token: string, preferences: NutritionPreferences) =>
    request<NutritionProgram>('/me/nutrition/preferences', {
      method: 'PUT',
      body: preferences,
      token,
    }),
  regenerateNutrition: (token: string, weekday?: number) =>
    request<NutritionProgram>('/me/nutrition/regenerate', {
      method: 'POST',
      body: weekday === undefined ? {} : { weekday },
      token,
    }),
  mealAlternatives: (token: string, weekday: number, slot: MealSlot) =>
    request<PlannedMeal[]>(`/me/nutrition/alternatives?weekday=${weekday}&slot=${slot}`, { token }),
  replaceMeal: (token: string, weekday: number, slot: MealSlot, recipeId: string) =>
    request<NutritionProgram>('/me/nutrition/meal', {
      method: 'PUT',
      body: { weekday, slot, recipeId },
      token,
    }),
  shoppingList: (token: string) =>
    request<Partial<Record<FoodCategory, ShoppingItem[]>>>('/me/nutrition/shopping-list', {
      token,
    }),

  // Jurnal alimentar
  foodLog: (token: string, day: string) =>
    request<FoodLogEntry[]>(`/me/food-log?day=${day}`, { token }),
  addFoodLog: (
    token: string,
    entry: { day: string; meal: LogMeal; source: 'food' | 'recipe'; refId: string; amount: number },
  ) => request<FoodLogEntry>('/me/food-log', { method: 'POST', body: entry, token }),
  eatPlannedMeal: (token: string, day: string, slot: MealSlot) =>
    request<FoodLogEntry>('/me/food-log/planned', { method: 'POST', body: { day, slot }, token }),
  deleteFoodLog: (token: string, id: string) =>
    request<void>(`/me/food-log/${id}`, { method: 'DELETE', token }),
  recentFoods: (token: string) => request<string[]>('/me/food-log/recent-foods', { token }),

  // Masuratori, apa, progres
  saveMeasurement: (token: string, day: string, weightKg: number) =>
    request<void>('/me/measurements', { method: 'PUT', body: { day, weightKg }, token }),
  measurements: (token: string, weeks: 4 | 8 | 12) =>
    request<Measurement[]>(`/me/measurements?weeks=${weeks}`, { token }),
  water: (token: string, day: string) =>
    request<{ day: string; ml: number }>(`/me/water?day=${day}`, { token }),
  setWater: (token: string, day: string, ml: number) =>
    request<void>('/me/water', { method: 'PUT', body: { day, ml }, token }),
  progress: (token: string) => request<ProgressResponse>('/me/progress', { token }),
  acceptAdjustment: (token: string) =>
    request<{ targetCalories: number }>('/me/progress/adjustment/accept', {
      method: 'POST',
      token,
    }),
  rejectAdjustment: (token: string) =>
    request<void>('/me/progress/adjustment/reject', { method: 'POST', token }),
};

export interface WorkoutProgram {
  preferences: WorkoutPreferences;
  plan: WorkoutPlan;
  createdAt: string;
}

export interface WorkoutLogEntry {
  day: string;
  exerciseId: string;
}
