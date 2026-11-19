import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { I18nProvider } from '@/i18n';
import { AppStateProvider } from '@/state/app-state';
import { ThemeProvider, useTheme } from '@/theme';

function ThemedStack() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <I18nProvider>
          <AppStateProvider>
            <ThemedStack />
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
