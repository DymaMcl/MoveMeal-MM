import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppMenuProvider } from '@/components/app-menu';
import { ToastProvider } from '@/components/toast';
import { I18nProvider } from '@/i18n';
import { AppStateProvider } from '@/state/app-state';
import { NutritionProvider } from '@/state/nutrition-state';
import { WorkoutProvider } from '@/state/workout-state';
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
            <WorkoutProvider>
              <NutritionProvider>
                <ToastProvider>
                  <AppMenuProvider>
                    <ThemedStack />
                  </AppMenuProvider>
                </ToastProvider>
              </NutritionProvider>
            </WorkoutProvider>
          </AppStateProvider>
        </I18nProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
