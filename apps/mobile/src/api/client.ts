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

export type Role = 'user' | 'nutritionist' | 'admin';

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; role: Role };
}

export interface Me {
  id: string;
  email: string;
  role: Role;
  healthDataConsent: boolean;
}

export interface ProfileResponse {
  profile: EnergyProfile & { name: string };
  plan: EnergyPlan;
  /** Tinta calorica a fost modificata printr-o ajustare acceptata sau de nutritionist. */
  adjusted?: boolean;
  adjustedBy?: 'adjustment' | 'nutritionist' | null;
  nutritionistNote?: string | null;
}

export interface NutritionProgram {
  preferences: NutritionPreferences;
  plan: MealPlan;
  /** Planul a fost regenerat de nutritionist (data ajustarii). */
  adjustedByNutritionistAt?: string | null;
}

export type LogMeal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodLogEntry extends Nutrients {
  id: string;
  day: string;
  meal: LogMeal;
  /** photo = aliment recunoscut din fotografie, care nu exista in catalog. */
  source: 'food' | 'recipe' | 'photo';
  refId: string;
  name: string;
  amount: number;
  unit: 'g' | 'portion';
}

/** Paginile pe care asistentul AI le poate recomanda. */
export type AssistantAction =
  | 'home'
  | 'workout'
  | 'meals'
  | 'calories'
  | 'foodPhoto'
  | 'progress'
  | 'nutritionist'
  | 'bodyCheck'
  | 'settings';

export interface AiStatus {
  available: boolean;
  /** Cererile ramase in ultimele 24 de ore. */
  remaining: { chat: number; photo: number };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantReply {
  reply: string;
  action: AssistantAction | null;
}

export interface PhotoItem {
  index: number;
  name: string;
  grams: number;
  /** Valorile la 100 g (pentru recalcularea dupa corectarea gramajului). */
  per100: Nutrients;
  foodId: string | null;
  confidence: number;
  nutrients: Nutrients;
}

export interface PhotoAnalysis {
  id: string;
  dish: string;
  isFood: boolean;
  items: PhotoItem[];
  total: Nutrients;
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
  me: (token: string) => request<Me>('/me', { token }),
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

  // Notificari
  notifications: (token: string) =>
    request<{ items: NotificationItem[]; unread: number }>('/me/notifications', { token }),
  readNotifications: (token: string) =>
    request<void>('/me/notifications/read', { method: 'POST', token }),

  // Consultatii (utilizator)
  nutritionists: (token: string) => request<NutritionistCard[]>('/nutritionists', { token }),
  slots: (token: string, nutritionistId: string) =>
    request<Slot[]>(`/nutritionists/${nutritionistId}/slots`, { token }),
  consultationOffer: (token: string) =>
    request<ConsultationOffer>('/me/consultation-offer', { token }),
  appointments: (token: string) => request<Appointment[]>('/me/appointments', { token }),
  book: (
    token: string,
    body: { nutritionistId: string; startsAt: string; note?: string; shareData?: boolean },
  ) => request<Appointment>('/me/appointments', { method: 'POST', body, token }),
  cancelAppointment: (token: string, id: string) =>
    request<Appointment>(`/me/appointments/${id}/cancel`, { method: 'POST', token }),
  nutritionistAccess: (token: string) => request<string[]>('/me/nutritionist-access', { token }),
  setNutritionistAccess: (token: string, nutritionistId: string, granted: boolean) =>
    request<string[]>(`/me/nutritionist-access/${nutritionistId}`, {
      method: 'PUT',
      body: { granted },
      token,
    }),

  // Asistentul AI (Gemini) si fotografierea mesei
  ai: {
    status: (token: string) => request<AiStatus>('/me/ai', { token }),
    chat: (token: string, messages: ChatMessage[], language: 'ro' | 'en' | 'ru') =>
      request<AssistantReply>('/me/assistant/chat', {
        method: 'POST',
        body: { messages, language },
        token,
      }),
    analyzePhoto: (
      token: string,
      image: string,
      mimeType: 'image/jpeg',
      language: 'ro' | 'en' | 'ru',
    ) =>
      request<PhotoAnalysis>('/me/food-photo', {
        method: 'POST',
        body: { image, mimeType, language },
        token,
      }),
    logPhoto: (
      token: string,
      id: string,
      body: { day: string; meal: LogMeal; items: { index: number; grams: number }[] },
    ) => request<FoodLogEntry[]>(`/me/food-photo/${id}/log`, { method: 'POST', body, token }),
  },

  // Panoul nutritionistului
  panel: {
    profile: (token: string) => request<NutritionistCard>('/nutritionist/profile', { token }),
    saveProfile: (token: string, body: Omit<NutritionistCard, 'id'>) =>
      request<NutritionistCard>('/nutritionist/profile', { method: 'PUT', body, token }),
    schedule: (token: string) => request<Schedule>('/nutritionist/schedule', { token }),
    setHours: (token: string, hours: WorkHour[]) =>
      request<Schedule>('/nutritionist/schedule/hours', { method: 'PUT', body: { hours }, token }),
    setDayOff: (token: string, day: string, off: boolean) =>
      request<Schedule>('/nutritionist/schedule/day-off', {
        method: 'PUT',
        body: { day, off },
        token,
      }),
    slots: (token: string) => request<Slot[]>('/nutritionist/slots', { token }),
    appointments: (token: string) =>
      request<Appointment[]>('/nutritionist/appointments', { token }),
    confirm: (token: string, id: string, note?: string) =>
      request<Appointment>(`/nutritionist/appointments/${id}/confirm`, {
        method: 'POST',
        body: { note },
        token,
      }),
    reject: (token: string, id: string, note?: string) =>
      request<Appointment>(`/nutritionist/appointments/${id}/reject`, {
        method: 'POST',
        body: { note },
        token,
      }),
    reschedule: (token: string, id: string, startsAt: string, note?: string) =>
      request<Appointment>(`/nutritionist/appointments/${id}/reschedule`, {
        method: 'POST',
        body: { startsAt, note },
        token,
      }),
    clients: (token: string) => request<ClientSummary[]>('/nutritionist/clients', { token }),
    client: (token: string, id: string) =>
      request<ClientDetail>(`/nutritionist/clients/${id}`, { token }),
    adjustClient: (token: string, id: string, calorieTarget: number | null, note: string) =>
      request<ClientDetail>(`/nutritionist/clients/${id}/adjustment`, {
        method: 'PUT',
        body: { calorieTarget, note },
        token,
      }),
  },

  // Panoul administratorului
  admin: {
    stats: (token: string) => request<AdminStats>('/admin/stats', { token }),
    users: (token: string, q: string, role?: Role, page = 0) => {
      const params = [`page=${page}`];
      if (q) params.push(`q=${encodeURIComponent(q)}`);
      if (role) params.push(`role=${role}`);
      return request<{ total: number; page: number; pageSize: number; items: AdminUser[] }>(
        `/admin/users?${params.join('&')}`,
        { token },
      );
    },
    setRole: (token: string, id: string, role: Role) =>
      request<AdminUser>(`/admin/users/${id}/role`, { method: 'PUT', body: { role }, token }),
    block: (token: string, id: string, reason: string) =>
      request<AdminUser>(`/admin/users/${id}/block`, { method: 'POST', body: { reason }, token }),
    unblock: (token: string, id: string) =>
      request<AdminUser>(`/admin/users/${id}/unblock`, { method: 'POST', token }),
    log: (token: string) => request<AdminLogEntry[]>('/admin/log', { token }),
    settings: (token: string) => request<AdminSettings>('/admin/settings', { token }),
    saveSettings: (token: string, body: AdminSettings) =>
      request<AdminSettings>('/admin/settings', { method: 'PUT', body, token }),
  },
};

export type NotificationKind =
  | 'appointment_requested'
  | 'appointment_confirmed'
  | 'appointment_rejected'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'plan_adjusted'
  | 'access_granted'
  | 'access_revoked';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  payload: Record<string, string | number | null | undefined>;
  createdAt: string;
  read: boolean;
}

export interface NutritionistCard {
  id: string;
  displayName: string;
  title: string;
  bio: string;
  qualifications: string;
  experienceYears: number;
  services: string;
  priceMdl: number;
  slotMinutes: number;
}

export interface Slot {
  startsAt: string;
  /** Ziua si ora locala (Europe/Chisinau). */
  day: string;
  time: string;
}

export interface ConsultationOffer {
  days: number;
  expiresAt: string;
  used: boolean;
  eligible: boolean;
}

export type AppointmentStatus = 'requested' | 'confirmed' | 'rejected' | 'cancelled';

export interface Appointment {
  id: string;
  userId: string;
  nutritionistId: string;
  nutritionistName: string;
  clientName: string;
  startsAt: string;
  day: string;
  time: string;
  durationMin: number;
  status: AppointmentStatus;
  free: boolean;
  userNote: string;
  nutritionistNote: string;
  past: boolean;
}

export interface WorkHour {
  weekday: number;
  start: string;
  end: string;
}

export interface Schedule {
  hours: WorkHour[];
  daysOff: string[];
  freeSlots: number;
}

export interface ClientSummary {
  id: string;
  name: string;
  goal: string | null;
  weightKg: number | null;
  lastWeighIn: string | null;
  grantedAt: string;
}

export interface ClientDetail {
  id: string;
  profile: EnergyProfile & { name: string };
  plan: EnergyPlan;
  adjustedBy: 'adjustment' | 'nutritionist' | null;
  nutritionistNote: string | null;
  minCalories: number;
  maxCalories: number;
  weights: { day: string; weightKg: number }[];
  foodLog: { day: string; kcal: number; protein: number }[];
  mealPlan: {
    diet: string | null;
    allergens: string[];
    targetKcal: number | null;
    adjustedAt: string | null;
  } | null;
  appointments: Appointment[];
}

export interface AdminStats {
  users: {
    total: number;
    users: number;
    nutritionists: number;
    admins: number;
    blocked: number;
    newThisWeek: number;
    activeThisWeek: number;
  };
  appointments: Record<AppointmentStatus, number>;
}

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
}

export interface AdminLogEntry {
  id: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  adminEmail: string | null;
  targetEmail: string | null;
}

export interface AdminSettings {
  freeConsultationDays: number;
}

export interface WorkoutProgram {
  preferences: WorkoutPreferences;
  plan: WorkoutPlan;
  createdAt: string;
}

export interface WorkoutLogEntry {
  day: string;
  exerciseId: string;
}
