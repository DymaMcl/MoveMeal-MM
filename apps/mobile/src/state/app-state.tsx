import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { calculateEnergyPlan, type EnergyPlan, type EnergyProfile } from '@movemeal/shared';
import { api, ApiError } from '@/api/client';

/**
 * Starea aplicatiei. Contul si profilul sunt pastrate pe server; pe telefon raman
 * tokenul sesiunii (stocare securizata) si o copie a profilului pentru pornire rapida.
 */

export interface Session {
  email: string;
  token: string;
}

export interface UserProfile extends EnergyProfile {
  name: string;
}

export type ProfileDraft = Partial<UserProfile>;

const KEYS = {
  token: 'movemeal.token',
  email: 'movemeal.email',
  profile: 'movemeal.profile',
} as const;

interface AppStateValue {
  ready: boolean;
  session: Session | null;
  profile: UserProfile | null;
  plan: EnergyPlan | null;
  draft: ProfileDraft;
  register: (email: string, password: string, healthDataConsent: boolean) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDraft: (patch: ProfileDraft) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

async function readProfileCache(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.profile);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
}

async function writeProfileCache(profile: UserProfile | null): Promise<void> {
  if (profile) await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
  else await AsyncStorage.removeItem(KEYS.profile);
}

export function isCompleteProfile(draft: ProfileDraft): draft is UserProfile {
  const base =
    !!draft.name &&
    draft.age !== undefined &&
    !!draft.sex &&
    draft.heightCm !== undefined &&
    draft.weightKg !== undefined &&
    !!draft.goal &&
    !!draft.activityLevel;
  if (!base) return false;
  if (draft.goal === 'lose' || draft.goal === 'gain') {
    return draft.targetWeightKg !== undefined && draft.weeks !== undefined;
  }
  return true;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({});

  const clearLocal = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.token),
      AsyncStorage.removeItem(KEYS.email),
      writeProfileCache(null),
    ]);
    setSession(null);
    setProfile(null);
    setDraft({});
  }, []);

  // La pornire: sesiunea salvata + copia profilului, apoi sincronizare cu serverul.
  useEffect(() => {
    (async () => {
      const [token, email, cached] = await Promise.all([
        SecureStore.getItemAsync(KEYS.token),
        AsyncStorage.getItem(KEYS.email),
        readProfileCache(),
      ]);
      if (token && email) {
        setSession({ token, email });
        setProfile(cached);
      }
      setReady(true);

      if (!token) return;
      try {
        const { profile: remote } = await api.getProfile(token);
        setProfile(remote);
        await writeProfileCache(remote);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await clearLocal();
        else if (error instanceof ApiError && error.status === 404) {
          setProfile(null);
          await writeProfileCache(null);
        }
        // Fara conexiune: se foloseste copia locala.
      }
    })();
  }, [clearLocal]);

  const startSession = useCallback(async (token: string, email: string) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.token, token),
      AsyncStorage.setItem(KEYS.email, email),
    ]);
    setSession({ token, email });
    try {
      const { profile: remote } = await api.getProfile(token);
      setProfile(remote);
      await writeProfileCache(remote);
    } catch {
      setProfile(null);
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, healthDataConsent: boolean) => {
      const res = await api.register(email, password, healthDataConsent);
      await startSession(res.token, res.user.email);
    },
    [startSession],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await startSession(res.token, res.user.email);
    },
    [startSession],
  );

  const signOut = useCallback(async () => {
    if (session) await api.logout(session.token).catch(() => undefined);
    await clearLocal();
  }, [session, clearLocal]);

  const updateDraft = useCallback((patch: ProfileDraft) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!session) throw new Error('Nu exista sesiune');
    if (!isCompleteProfile(draft)) throw new Error('Profil incomplet');
    const payload: UserProfile = { ...draft };
    if (payload.goal !== 'lose' && payload.goal !== 'gain') {
      delete payload.targetWeightKg;
      delete payload.weeks;
    }
    const { profile: saved } = await api.saveProfile(session.token, payload);
    await writeProfileCache(saved);
    setProfile(saved);
  }, [draft, session]);

  /** Porneste din nou chestionarul, cu valorile actuale precompletate. */
  const resetProfile = useCallback(() => {
    setDraft(profile ?? {});
    setProfile(null);
  }, [profile]);

  const plan = useMemo(() => (profile ? calculateEnergyPlan(profile) : null), [profile]);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      session,
      profile,
      plan,
      draft,
      register,
      signIn,
      signOut,
      updateDraft,
      completeOnboarding,
      resetProfile,
    }),
    [
      ready,
      session,
      profile,
      plan,
      draft,
      register,
      signIn,
      signOut,
      updateDraft,
      completeOnboarding,
      resetProfile,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState trebuie folosit in interiorul AppStateProvider');
  return ctx;
}
