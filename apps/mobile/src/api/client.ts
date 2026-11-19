import type { EnergyPlan, EnergyProfile } from '@movemeal/shared';
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
    throw new ApiError(res.status, message);
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
};
