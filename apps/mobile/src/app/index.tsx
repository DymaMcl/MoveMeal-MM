import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { WelcomeView, type WelcomeStage } from '@/components/welcome-view';
import { useAppState } from '@/state/app-state';

/** Cat timp ramane titlul „MoveMeal” in mijlocul ecranului la deschiderea aplicatiei. */
const SPLASH_MS = 4000;

/**
 * Punctul de intrare. La deschidere apare doar titlul, cateva secunde; apoi:
 * - fara cont conectat: titlul urca si apare panoul de bun venit;
 * - cu cont conectat: titlul dispare lin si se deschide pagina principala (sau chestionarul).
 */
export default function Index() {
  const { ready, session, profile } = useAppState();
  const role = session?.role;
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  let stage: WelcomeStage = 'splash';
  if (elapsed && ready) stage = session ? 'leaving' : 'welcome';

  const openApp = useCallback(() => {
    // Nutritionistul si administratorul fara profil personal ajung direct in panoul lor.
    if (profile) router.replace('/home');
    else if (role === 'nutritionist') router.replace('/panel');
    else if (role === 'admin') router.replace('/admin');
    else router.replace('/onboarding/personal');
  }, [profile, role]);

  return <WelcomeView stage={stage} animated onLeft={openApp} />;
}
