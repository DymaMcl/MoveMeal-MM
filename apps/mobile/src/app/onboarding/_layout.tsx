import { Redirect, Stack } from 'expo-router';
import { useAppState } from '@/state/app-state';
import { colors } from '@/theme';

export default function OnboardingLayout() {
  const { ready, session } = useAppState();
  if (ready && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
    />
  );
}
