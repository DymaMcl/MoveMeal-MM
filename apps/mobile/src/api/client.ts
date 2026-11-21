import type {
  EnergyPlan,
  TrophyId,
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

/** Adresa implicita (din configurarea aplicatiei sau serverul de dezvoltare). */
export const DEFAULT_API_URL = resolveBaseUrl();

/**
 * Adresa folosita acum. Poate fi schimbata din aplicatie (de exemplu cand calculatorul cu serverul
 * primeste alt IP in alta retea Wi-Fi), fara o versiune noua a aplicatiei.
 */
let apiUrl = DEFAULT_API_URL;

export const getApiUrl = () => apiUrl;

export function setApiUrl(url: string | null): void {
  apiUrl = url ?? DEFAULT_API_URL;
}

/**
 * Transforma ce scrie utilizatorul („192.168.1.5”, „192.168.1.5:3000”, „https://api.exemplu.md”)
 * in adresa completa a serverului. null = adresa nu este valida.
 */
export function normalizeApiUrl(input: string): string | null {
  // Fara clasa URL: in React Native nu are toate proprietatile pe Android.
  const match = /^(?:(https?):\/\/)?([a-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s?#]*)?$/i.exec(input.trim());
  if (!match) return null;
  const [, scheme = 'http', host, explicitPort, rawPath = ''] = match;
  if (!host || host.startsWith('.') || host.endsWith('.')) return null;
  // Fara port explicit, la o adresa locala se foloseste portul serverului de dezvoltare.
  const local = /^(\d{1,3}\.){3}\d{1,3}$|^localhost$/i.test(host);
  const port = explicitPort ?? (local ? '3000' : '');
  if (port && Number(port) > 65535) return null;
  const path = rawPath.replace(/\/+$/, '');
  return `${scheme.toLowerCase()}://${host}${port ? `:${port}` : ''}${path.endsWith('/api') ? path : `${path}/api`}`;
}

/** Verifica daca la adresa data raspunde serverul MoveMeal. */
export async function checkServer(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

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
    res = await fetch(`${apiUrl}${path}`, {
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
  /**
   * photo = aliment recunoscut din fotografie (sau din descriere) care nu exista in catalog;
   * product = produs cu cod de bare sau propriu; quick = calorii introduse direct.
   */
  source: 'food' | 'recipe' | 'photo' | 'product' | 'quick';
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

/** Produs ambalat (Open Food Facts) sau adaugat de utilizator; valorile sunt la 100 g. */
export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  per100: Nutrients;
  servingG: number | null;
  imageUrl: string | null;
  source: 'off' | 'user';
}

export interface ProductInput {
  barcode?: string;
  name: string;
  brand?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  servingG?: number;
}

export interface LabelDraft {
  name: string | null;
  brand: string | null;
  per100: Nutrients;
  servingG: number | null;
}

export interface SavedMealItem extends Nutrients {
  source: FoodLogEntry['source'];
  refId: string;
  name: string;
  amount: number;
  unit: 'g' | 'portion';
}

export interface SavedMeal {
  id: string;
  name: string;
  items: SavedMealItem[];
  total: Nutrients;
  uses: number;
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
  logProduct: (
    token: string,
    body: { day: string; meal: LogMeal; productId: string; grams: number },
  ) => request<FoodLogEntry>('/me/food-log/product', { method: 'POST', body, token }),
  quickAdd: (
    token: string,
    body: {
      day: string;
      meal: LogMeal;
      kcal: number;
      name?: string;
      protein?: number;
      carbs?: number;
      fat?: number;
    },
  ) => request<FoodLogEntry>('/me/food-log/quick', { method: 'POST', body, token }),
  /** Copiaza o masa (fromMeal → toMeal) sau toata ziua. */
  copyLog: (
    token: string,
    body: { fromDay: string; toDay: string; fromMeal?: LogMeal; toMeal?: LogMeal },
  ) => request<FoodLogEntry[]>('/me/food-log/copy', { method: 'POST', body, token }),

  products: {
    byBarcode: (token: string, barcode: string) =>
      request<Product>(`/products/barcode/${barcode}`, { token }),
    lists: (token: string) =>
      request<{ mine: Product[]; recent: Product[] }>('/me/products', { token }),
    create: (token: string, body: ProductInput) =>
      request<Product>('/me/products', { method: 'POST', body, token }),
    update: (token: string, id: string, body: ProductInput) =>
      request<Product>(`/me/products/${id}`, { method: 'PUT', body, token }),
    remove: (token: string, id: string) =>
      request<void>(`/me/products/${id}`, { method: 'DELETE', token }),
    /** Valorile citite de AI de pe eticheta (nu se salveaza). */
    readLabel: (token: string, image: string, language: 'ro' | 'en' | 'ru') =>
      request<LabelDraft>('/me/products/label', {
        method: 'POST',
        body: { image, mimeType: 'image/jpeg', language },
        token,
      }),
  },

  savedMeals: {
    list: (token: string) => request<SavedMeal[]>('/me/saved-meals', { token }),
    create: (token: string, name: string, entryIds: string[]) =>
      request<SavedMeal>('/me/saved-meals', { method: 'POST', body: { name, entryIds }, token }),
    rename: (token: string, id: string, name: string) =>
      request<void>(`/me/saved-meals/${id}`, { method: 'PATCH', body: { name }, token }),
    remove: (token: string, id: string) =>
      request<void>(`/me/saved-meals/${id}`, { method: 'DELETE', token }),
    log: (token: string, id: string, day: string, meal: LogMeal) =>
      request<FoodLogEntry[]>(`/me/saved-meals/${id}/log`, {
        method: 'POST',
        body: { day, meal },
        token,
      }),
  },

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
  notifications: (token: string) => request<NotificationsResponse>('/me/notifications', { token }),
  /** Marcheaza ca citita o sectiune (fara sectiune: toate). */
  readNotifications: (token: string, section?: NotificationSection) =>
    request<void>('/me/notifications/read', {
      method: 'POST',
      body: section ? { section } : {},
      token,
    }),
  news: (token: string, language: 'ro' | 'en' | 'ru') =>
    request<NewsItem[]>(`/news?language=${language}`, { token }),

  // Pasi si trofee
  steps: (token: string, days = 7) => request<StepsDay[]>(`/me/steps?days=${days}`, { token }),
  setSteps: (token: string, body: { day: string; steps: number; source: 'manual' | 'device' }) =>
    request<{ day: StepsDay; trophies: TrophyId[] }>('/me/steps', { method: 'PUT', body, token }),
  myTrophies: (token: string) => request<TrophyStatus[]>('/me/trophies', { token }),
  userTrophies: (token: string, id: string) =>
    request<TrophyStatus[]>(`/users/${id}/trophies`, { token }),

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
      hint?: string,
    ) =>
      request<PhotoAnalysis>('/me/food-photo', {
        method: 'POST',
        body: { image, mimeType, language, ...(hint ? { hint } : {}) },
        token,
      }),
    /** Masa descrisa in cuvinte (scrisa sau dictata). */
    analyzeText: (token: string, text: string, language: 'ro' | 'en' | 'ru') =>
      request<PhotoAnalysis>('/me/food-photo/text', {
        method: 'POST',
        body: { text, language },
        token,
      }),
    /** Corecteaza alimentul cu indexul dat sau adauga unul nou (fara index). */
    editPhotoItem: (
      token: string,
      id: string,
      body: {
        index?: number;
        foodId?: string;
        name?: string;
        grams?: number;
        language: 'ro' | 'en' | 'ru';
      },
    ) => request<PhotoAnalysis>(`/me/food-photo/${id}/items`, { method: 'POST', body, token }),
    logPhoto: (
      token: string,
      id: string,
      body: { day: string; meal: LogMeal; items: { index: number; grams: number }[] },
    ) => request<FoodLogEntry[]>(`/me/food-photo/${id}/log`, { method: 'POST', body, token }),
  },

  // Panoul nutritionistului
  panel: {
    profile: (token: string) => request<NutritionistCard>('/nutritionist/profile', { token }),
    saveProfile: (token: string, body: Omit<NutritionistCard, 'id' | 'avatarId'>) =>
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

  // Comunitatea (lenta), profilul public si salvatele
  social: {
    me: (token: string) => request<MySocial>('/me/social', { token }),
    updateMe: (token: string, body: { displayName: string; bio: string; showProgress: boolean }) =>
      request<SocialProfile>('/me/social', { method: 'PUT', body, token }),
    setAvatar: (token: string, image: string, mimeType: 'image/jpeg') =>
      request<SocialProfile>('/me/social/avatar', {
        method: 'PUT',
        body: { image, mimeType },
        token,
      }),
    removeAvatar: (token: string) =>
      request<SocialProfile>('/me/social/avatar', { method: 'DELETE', token }),
    saved: (token: string) =>
      request<{ posts: Post[]; articles: ArticleCard[] }>('/me/saved', { token }),
    profile: (token: string, id: string) =>
      request<SocialProfile>(`/users/${id}/profile`, { token }),
    userPosts: (token: string, id: string, cursor?: string | null) =>
      request<Page<Post>>(
        `/users/${id}/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        { token },
      ),
    feed: (
      token: string,
      kind?: PostKind | null,
      cursor?: string | null,
      scope: 'all' | 'following' = 'all',
    ) => {
      const params: string[] = [];
      if (kind) params.push(`kind=${kind}`);
      if (scope === 'following') params.push('scope=following');
      if (cursor) params.push(`cursor=${encodeURIComponent(cursor)}`);
      return request<Page<Post>>(`/feed${params.length ? `?${params.join('&')}` : ''}`, { token });
    },
    createPost: (
      token: string,
      body: {
        image: string;
        mimeType: 'image/jpeg';
        caption: string;
        kind: PostKind;
        visibility: Visibility;
        foodPhotoId?: string;
      },
    ) => request<Post>('/posts', { method: 'POST', body, token }),
    post: (token: string, id: string) => request<Post>(`/posts/${id}`, { token }),
    /** Sfat text al echipei (doar nutritionisti si administratori). */
    createTip: (token: string, body: { title: string; caption: string }) =>
      request<Post>('/posts/tip', { method: 'POST', body, token }),
    follow: (token: string, id: string, value: boolean) =>
      request<{ following: boolean; followers: number }>(`/users/${id}/follow`, {
        method: 'PUT',
        body: { value },
        token,
      }),
    followers: (token: string, id: string) =>
      request<FollowUser[]>(`/users/${id}/followers`, { token }),
    following: (token: string, id: string) =>
      request<FollowUser[]>(`/users/${id}/following`, { token }),
    updatePost: (token: string, id: string, body: { caption?: string; visibility?: Visibility }) =>
      request<Post>(`/posts/${id}`, { method: 'PATCH', body, token }),
    deletePost: (token: string, id: string) =>
      request<void>(`/posts/${id}`, { method: 'DELETE', token }),
    like: (token: string, id: string, value: boolean) =>
      request<ToggleResult>(`/posts/${id}/like`, { method: 'PUT', body: { value }, token }),
    save: (token: string, id: string, value: boolean) =>
      request<ToggleResult>(`/posts/${id}/save`, { method: 'PUT', body: { value }, token }),
    report: (token: string, id: string, reason: ReportReason, note?: string) =>
      request<void>(`/posts/${id}/report`, { method: 'POST', body: { reason, note }, token }),
  },

  // Blogul
  blog: {
    list: (
      token: string,
      query: { category?: BlogCategory | null; q?: string; cursor?: string | null } = {},
    ) => {
      const params: string[] = [];
      if (query.category) params.push(`category=${query.category}`);
      if (query.q) params.push(`q=${encodeURIComponent(query.q)}`);
      if (query.cursor) params.push(`cursor=${encodeURIComponent(query.cursor)}`);
      return request<Page<ArticleCard> & { pinned: ArticleCard[] }>(
        `/blog${params.length ? `?${params.join('&')}` : ''}`,
        { token },
      );
    },
    get: (token: string, id: string) => request<Article>(`/blog/${id}`, { token }),
    like: (token: string, id: string, value: boolean) =>
      request<ToggleResult>(`/blog/${id}/like`, { method: 'PUT', body: { value }, token }),
    save: (token: string, id: string, value: boolean) =>
      request<ToggleResult>(`/blog/${id}/save`, { method: 'PUT', body: { value }, token }),
    authored: (token: string, cursor?: string | null) =>
      request<Page<ArticleCard>>(
        `/blog/authored${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        { token },
      ),
    editable: (token: string, id: string) => request<Article>(`/blog/authored/${id}`, { token }),
    create: (token: string, body: ArticleInput) =>
      request<Article>('/blog', { method: 'POST', body, token }),
    update: (token: string, id: string, body: ArticleInput) =>
      request<Article>(`/blog/${id}`, { method: 'PUT', body, token }),
    remove: (token: string, id: string) =>
      request<void>(`/blog/${id}`, { method: 'DELETE', token }),
  },

  // Panoul administratorului
  admin: {
    stats: (token: string) => request<AdminStats>('/admin/stats', { token }),
    users: (token: string, q: string, role?: Role, page = 0, status?: 'active' | 'blocked') => {
      const params = [`page=${page}`];
      if (q) params.push(`q=${encodeURIComponent(q)}`);
      if (role) params.push(`role=${role}`);
      if (status) params.push(`status=${status}`);
      return request<{ total: number; page: number; pageSize: number; items: AdminUser[] }>(
        `/admin/users?${params.join('&')}`,
        { token },
      );
    },
    user: (token: string, id: string) => request<AdminUserDetail>(`/admin/users/${id}`, { token }),
    setRole: (token: string, id: string, role: Role) =>
      request<AdminUser>(`/admin/users/${id}/role`, { method: 'PUT', body: { role }, token }),
    block: (token: string, id: string, reason: string) =>
      request<AdminUser>(`/admin/users/${id}/block`, { method: 'POST', body: { reason }, token }),
    unblock: (token: string, id: string) =>
      request<AdminUser>(`/admin/users/${id}/unblock`, { method: 'POST', token }),
    logoutUser: (token: string, id: string) =>
      request<{ closed: number }>(`/admin/users/${id}/logout`, { method: 'POST', token }),
    unlockUser: (token: string, id: string) =>
      request<AdminUser>(`/admin/users/${id}/unlock`, { method: 'POST', token }),
    moderation: (token: string, filter: ModerationFilter, cursor?: string | null) =>
      request<Page<ModerationItem>>(
        `/admin/moderation?filter=${filter}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        { token },
      ),
    approvePost: (token: string, id: string) =>
      request<void>(`/admin/posts/${id}/approve`, { method: 'POST', token }),
    removePost: (token: string, id: string, reason: string) =>
      request<void>(`/admin/posts/${id}/remove`, { method: 'POST', body: { reason }, token }),
    dismissReports: (token: string, id: string) =>
      request<void>(`/admin/posts/${id}/dismiss`, { method: 'POST', token }),
    deletePost: (token: string, id: string) =>
      request<void>(`/admin/posts/${id}`, { method: 'DELETE', token }),
    articles: (token: string, cursor?: string | null) =>
      request<Page<ArticleCard>>(
        `/admin/articles${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
        { token },
      ),
    changeArticle: (
      token: string,
      id: string,
      body: { pinned?: boolean; status?: ArticleStatus },
    ) => request<void>(`/admin/articles/${id}`, { method: 'PUT', body, token }),
    deleteArticle: (token: string, id: string) =>
      request<void>(`/admin/articles/${id}`, { method: 'DELETE', token }),
    announce: (token: string, body: { title: string; body: string; audience: Audience }) =>
      request<{ recipients: number }>('/admin/announcements', { method: 'POST', body, token }),
    /** Noutate in „Ce e nou?” (functie noua sau provocare), vizibila tuturor. */
    createNews: (
      token: string,
      body: { kind: 'feature' | 'challenge'; title: string; body: string },
    ) => request<NewsItem>('/admin/news', { method: 'POST', body, token }),
    deleteNews: (token: string, id: string) =>
      request<void>(`/admin/news/${id}`, { method: 'DELETE', token }),
    log: (token: string, action?: string, page = 0) =>
      request<AdminLogEntry[]>(`/admin/log?page=${page}${action ? `&action=${action}` : ''}`, {
        token,
      }),
    settings: (token: string) => request<AdminSettings>('/admin/settings', { token }),
    saveSettings: (token: string, body: Partial<AdminSettings>) =>
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
  | 'access_revoked'
  | 'post_approved'
  | 'post_removed'
  | 'post_liked'
  | 'new_follower'
  | 'trophy'
  | 'announcement';

/** Sectiunile notificarilor: comunitatea, noutatile (functii si trofee) si cele personale. */
export type NotificationSection = 'community' | 'news' | 'personal';

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  section: NotificationSection;
  payload: Record<string, string | number | null | undefined>;
  createdAt: string;
  read: boolean;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unread: number;
  sections: Record<NotificationSection, number>;
}

/** Noutatile aplicatiei: functii noi (feature) sau provocari cu trofee (challenge). */
export interface NewsItem {
  id: string;
  kind: 'feature' | 'challenge';
  title: string;
  body: string;
  createdAt: string;
  unread: boolean;
}

export interface StepsDay {
  day: string;
  steps: number;
  source: 'manual' | 'device';
}

export interface TrophyStatus {
  id: TrophyId;
  earned: boolean;
  awardedAt: string | null;
  progress: number;
  goal: number;
}

export interface FollowUser {
  id: string;
  name: string;
  avatarId: string | null;
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
  /** Fotografia de profil; null = initialele. */
  avatarId: string | null;
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
    newToday: number;
    newThisWeek: number;
    activeToday: number;
    activeThisWeek: number;
  };
  appointments: Record<AppointmentStatus, number>;
  content: {
    posts: number;
    publicPosts: number;
    pending: number;
    removed: number;
    reported: number;
    postsThisWeek: number;
    postLikes: number;
    articles: number;
    drafts: number;
    articleViews: number;
    articleLikes: number;
  };
  ai: { chatToday: number; chatWeek: number; photoToday: number; photoWeek: number };
  moderation: {
    approved: number;
    rejected: number;
    pending: number;
    reasons: { reason: string; count: number }[];
  };
  series: { day: string; signups: number; active: number }[];
  topArticles: { id: string; title: string; views: number; likes: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  displayName: string | null;
  createdAt: string;
  lastActiveAt: string | null;
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
  aiChatDaily: number;
  aiPhotoDaily: number;
  communityEnabled: boolean;
  communityPremoderation: boolean;
  postsDaily: number;
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

// ------------------------------------------------------------------ comunitate si blog

/** Adresa unei fotografii salvate pe server (se cere cu antetul Authorization). */
export const mediaUrl = (id: string) => `${apiUrl}/media/${id}`;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** tip = sfat text al echipei (nutritionist sau administrator), fara fotografie. */
export type PostKind = 'meal' | 'workout' | 'running' | 'cycling' | 'other' | 'tip';
export type Visibility = 'private' | 'public';
export type ReportReason = 'nudity' | 'violence' | 'spam' | 'harassment' | 'not_relevant' | 'other';

export interface Author {
  id: string;
  name: string;
  avatarId: string | null;
  role: Role;
}

export interface Post {
  id: string;
  author: Author;
  /** null = sfat text al echipei. */
  mediaId: string | null;
  kind: PostKind;
  title: string | null;
  caption: string;
  visibility: Visibility;
  status: 'published' | 'pending' | 'removed';
  meal: { dish: string; nutrients: Nutrients } | null;
  likeCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  isMine: boolean;
  removedReason: string | null;
  createdAt: string;
}

export interface ToggleResult {
  value: boolean;
  likeCount: number;
  saveCount: number;
}

export type Goal = 'lose' | 'gain' | 'muscle' | 'maintain';

export interface SocialProfile {
  id: string;
  displayName: string;
  bio: string;
  avatarId: string | null;
  role: Role;
  showProgress: boolean;
  progress: { pct: number; kind: 'weight' | 'consistency'; goal: Goal } | null;
  stats: { posts: number; likes: number; followers: number; following: number };
  isFollowing: boolean;
  isMe: boolean;
}

export interface GoalProgress {
  goal: Goal;
  pct: number;
  kind: 'weight' | 'consistency';
  startKg: number;
  currentKg: number;
  targetKg: number | null;
  loggedDays: number;
  workoutDays: number;
}

export interface MySocial {
  profile: SocialProfile;
  progress: GoalProgress | null;
  savedCount: number;
}

export type BlogCategory = 'nutrition' | 'training' | 'health' | 'recipes' | 'motivation';
export type ArticleStatus = 'draft' | 'published' | 'archived';

export interface ArticleCard {
  id: string;
  title: string;
  summary: string;
  category: BlogCategory;
  coverId: string | null;
  author: Author & { title: string };
  status: ArticleStatus;
  pinned: boolean;
  readMinutes: number;
  likeCount: number;
  viewCount: number;
  saveCount: number;
  likedByMe: boolean;
  savedByMe: boolean;
  isMine: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Article extends ArticleCard {
  body: string;
}

export interface ArticleInput {
  title: string;
  summary: string;
  body: string;
  category: BlogCategory;
  status: 'draft' | 'published';
  coverImage?: string;
  coverMimeType?: 'image/jpeg';
  removeCover?: boolean;
}

// ------------------------------------------------------------------ administrare

export type ModerationFilter = 'pending' | 'reported' | 'removed' | 'all';
export type Audience = 'all' | 'user' | 'nutritionist';

export interface ModerationItem {
  id: string;
  author: { id: string; email: string; name: string };
  /** null = sfat text al echipei. */
  mediaId: string | null;
  kind: PostKind;
  caption: string;
  visibility: Visibility;
  status: 'published' | 'pending' | 'removed';
  moderation: { verdict?: 'approved' | 'unchecked'; relevant?: boolean; checkedAt?: string };
  removedReason: string | null;
  likeCount: number;
  reports: { reason: ReportReason; note: string; createdAt: string }[];
  createdAt: string;
}

export interface AdminUserDetail {
  user: AdminUser;
  activity: {
    activeSessions: number;
    posts: number;
    publicPosts: number;
    removedPosts: number;
    reportsAgainst: number;
    reportsMade: number;
    rejectedUploads: number;
    articles: number;
    aiChatWeek: number;
    aiPhotoWeek: number;
    appointments: number;
    failedLogins: number;
    lockedUntil: string | null;
  };
}
