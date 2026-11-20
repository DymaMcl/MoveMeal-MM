import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
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
import { api, ApiError, type ProfileResponse, type Role } from '@/api/client';

/**
 * Starea aplicatiei. Contul si profilul sunt pastrate pe server; pe telefon raman
 * tokenul sesiunii (stocare securizata) si o copie a profilului pentru pornire rapida.
 */

export interface Session {
  email: string;
  token: string;
  /** Rolul contului: utilizator, nutritionist sau administrator. */
  role: Role;
}

/** Cine a stabilit tinta calorica (null = calculul automat din profil). */
export interface TargetSource {
  adjustedBy: 'adjustment' | 'nutritionist' | null;
  nutritionistNote: string | null;
}

export interface UserProfile extends EnergyProfile {
  name: string;
}

export type ProfileDraft = Partial<UserProfile>;

const KEYS = {
  token: 'movemeal.token',
  email: 'movemeal.email',
  profile: 'movemeal.profile',
  role: 'movemeal.role',
} as const;

const isRole = (value: unknown): value is Role =>
  value === 'user' || value === 'nutritionist' || value === 'admin';

interface AppStateValue {
  ready: boolean;
  session: Session | null;
  profile: UserProfile | null;
  plan: EnergyPlan | null;
  targetSource: TargetSource;
  draft: ProfileDraft;
  register: (email: string, password: string, healthDataConsent: boolean) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDraft: (patch: ProfileDraft) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => void;
  refreshProfile: () => Promise<void>;
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
  /** Planul caloric primit de la server (include o eventuala ajustare acceptata). */
  const [serverPlan, setServerPlan] = useState<EnergyPlan | null>(null);
  const [targetSource, setTargetSource] = useState<TargetSource>({
    adjustedBy: null,
    nutritionistNote: null,
  });

  const applyRemote = useCallback(async (remote: ProfileResponse) => {
    setProfile(remote.profile);
    setServerPlan(remote.plan);
    setTargetSource({
      adjustedBy: remote.adjustedBy ?? (remote.adjusted ? 'adjustment' : null),
      nutritionistNote: remote.nutritionistNote ?? null,
    });
    await writeProfileCache(remote.profile);
  }, []);

  const clearLocal = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.token),
      AsyncStorage.removeItem(KEYS.email),
      AsyncStorage.removeItem(KEYS.role),
      writeProfileCache(null),
    ]);
    setSession(null);
    setProfile(null);
    setServerPlan(null);
    setDraft({});
  }, []);

  // La pornire: sesiunea salvata + copia profilului, apoi sincronizare cu serverul.
  useEffect(() => {
    (async () => {
      const [token, email, cached, storedRole] = await Promise.all([
        SecureStore.getItemAsync(KEYS.token),
        AsyncStorage.getItem(KEYS.email),
        readProfileCache(),
        AsyncStorage.getItem(KEYS.role),
      ]);
      if (token && email) {
        setSession({ token, email, role: isRole(storedRole) ? storedRole : 'user' });
        setProfile(cached);
      }
      setReady(true);

      if (!token) return;
      try {
        // Rolul poate fi schimbat intre timp de administrator.
        const me = await api.me(token);
        setSession((prev) => (prev ? { ...prev, role: me.role } : prev));
        await AsyncStorage.setItem(KEYS.role, me.role);
        await applyRemote(await api.getProfile(token));
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) await clearLocal();
        else if (error instanceof ApiError && error.status === 404) {
          setProfile(null);
          await writeProfileCache(null);
        }
        // Fara conexiune: se foloseste copia locala.
      }
    })();
  }, [clearLocal, applyRemote]);

  const startSession = useCallback(
    async (token: string, email: string, role: Role) => {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.token, token),
        AsyncStorage.setItem(KEYS.email, email),
        AsyncStorage.setItem(KEYS.role, role),
      ]);
      setSession({ token, email, role });
      try {
        await applyRemote(await api.getProfile(token));
      } catch {
        setProfile(null);
      }
    },
    [applyRemote],
  );

  const register = useCallback(
    async (email: string, password: string, healthDataConsent: boolean) => {
      const res = await api.register(email, password, healthDataConsent);
      await startSession(res.token, res.user.email, res.user.role ?? 'user');
    },
    [startSession],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await api.login(email, password);
      await startSession(res.token, res.user.email, res.user.role ?? 'user');
    },
    [startSession],
  );

  const signOut = useCallback(async () => {
    if (session) await api.logout(session.token).catch(() => undefined);
    // Fotografiile vazute in cont nu raman in cache pentru urmatorul utilizator al telefonului.
    await Promise.all([Image.clearMemoryCache(), Image.clearDiskCache()]).catch(() => undefined);
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
    await applyRemote(await api.saveProfile(session.token, payload));
  }, [draft, session, applyRemote]);

  /** Porneste din nou chestionarul, cu valorile actuale precompletate. */
  const resetProfile = useCallback(() => {
    setDraft(profile ?? {});
    setProfile(null);
    setServerPlan(null);
  }, [profile]);

  /** Reincarca profilul si tinta de pe server (de exemplu dupa acceptarea unei ajustari). */
  const refreshProfile = useCallback(async () => {
    if (!session) return;
    await applyRemote(await api.getProfile(session.token));
  }, [session, applyRemote]);

  // Fara conexiune se foloseste calculul local, cu aceleasi formule ca serverul.
  const plan = useMemo(
    () => serverPlan ?? (profile ? calculateEnergyPlan(profile) : null),
    [serverPlan, profile],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      session,
      profile,
      plan,
      targetSource,
      draft,
      register,
      signIn,
      signOut,
      updateDraft,
      completeOnboarding,
      resetProfile,
      refreshProfile,
    }),
    [
      ready,
      session,
      profile,
      plan,
      targetSource,
      draft,
      register,
      signIn,
      signOut,
      updateDraft,
      completeOnboarding,
      resetProfile,
      refreshProfile,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState trebuie folosit in interiorul AppStateProvider');
  return ctx;
}
