import AsyncStorage from '@react-native-async-storage/async-storage';
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

/**
 * Starea locala a aplicatiei. Pana la conectarea la server (NestJS),
 * sesiunea si profilul sunt pastrate doar pe dispozitiv.
 */

export interface Session {
  email: string;
  healthDataConsent: boolean;
  createdAt: string;
}

export interface UserProfile extends EnergyProfile {
  name: string;
}

export type ProfileDraft = Partial<UserProfile>;

const KEYS = {
  session: 'movemeal.session',
  profile: 'movemeal.profile',
} as const;

interface AppStateValue {
  ready: boolean;
  session: Session | null;
  profile: UserProfile | null;
  plan: EnergyPlan | null;
  draft: ProfileDraft;
  signIn: (email: string, healthDataConsent?: boolean) => Promise<void>;
  signOut: () => Promise<void>;
  updateDraft: (patch: ProfileDraft) => void;
  completeOnboarding: () => Promise<void>;
  resetProfile: () => Promise<void>;
}

const AppStateContext = createContext<AppStateValue | null>(null);

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
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

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        readJson<Session>(KEYS.session),
        readJson<UserProfile>(KEYS.profile),
      ]);
      setSession(s);
      setProfile(p);
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (email: string, healthDataConsent = true) => {
    const next: Session = { email, healthDataConsent, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEYS.session, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await AsyncStorage.multiRemove([KEYS.session, KEYS.profile]);
    setSession(null);
    setProfile(null);
    setDraft({});
  }, []);

  const updateDraft = useCallback((patch: ProfileDraft) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const completeOnboarding = useCallback(async () => {
    if (!isCompleteProfile(draft)) throw new Error('Profil incomplet');
    const next: UserProfile = { ...draft };
    if (next.goal !== 'lose' && next.goal !== 'gain') {
      delete next.targetWeightKg;
      delete next.weeks;
    }
    await AsyncStorage.setItem(KEYS.profile, JSON.stringify(next));
    setProfile(next);
  }, [draft]);

  const resetProfile = useCallback(async () => {
    await AsyncStorage.removeItem(KEYS.profile);
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
