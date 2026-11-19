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
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  let stage: WelcomeStage = 'splash';
  if (elapsed && ready) stage = session ? 'leaving' : 'welcome';

  const openApp = useCallback(() => {
    router.replace(profile ? '/home' : '/onboarding/personal');
  }, [profile]);

  return <WelcomeView stage={stage} animated onLeft={openApp} />;
}
