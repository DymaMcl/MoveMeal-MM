import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAppState } from '@/state/app-state';
import { colors } from '@/theme';

/** Punctul de intrare: trimite utilizatorul spre ecranul potrivit starii lui. */
export default function Index() {
  const { ready, session, profile } = useAppState();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!session) return <Redirect href="/welcome" />;
  if (!profile) return <Redirect href="/onboarding/personal" />;
  return <Redirect href="/home" />;
}
