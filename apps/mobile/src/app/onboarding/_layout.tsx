import { Redirect, Stack } from 'expo-router';
import { useAppState } from '@/state/app-state';
import { useTheme } from '@/theme';

export default function OnboardingLayout() {
  const { ready, session } = useAppState();
  const theme = useTheme();
  if (ready && !session) return <Redirect href="/welcome" />;
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    />
  );
}
