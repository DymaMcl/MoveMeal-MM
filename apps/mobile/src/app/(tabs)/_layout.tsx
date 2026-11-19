import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'home', label: 'tabs.home', icon: 'home-outline' },
  { name: 'workout', label: 'tabs.workout', icon: 'barbell-outline' },
  { name: 'meals', label: 'tabs.meals', icon: 'restaurant-outline' },
  { name: 'calories', label: 'tabs.calories', icon: 'camera-outline' },
  { name: 'more', label: 'tabs.more', icon: 'menu-outline' },
];

export default function TabsLayout() {
  const { t } = useI18n();
  const { ready, session, profile } = useAppState();

  if (ready && !session) return <Redirect href="/welcome" />;
  if (ready && !profile) return <Redirect href="/onboarding/personal" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={tab.icon} color={color as string} size={size} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
