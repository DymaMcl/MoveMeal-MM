import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import type { IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useTheme } from '@/theme';

const TABS: { name: string; label: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'home', label: 'tabs.home', icon: 'home-outline', iconActive: 'home' },
  { name: 'workout', label: 'tabs.workout', icon: 'barbell-outline', iconActive: 'barbell' },
  { name: 'meals', label: 'tabs.meals', icon: 'restaurant-outline', iconActive: 'restaurant' },
  { name: 'calories', label: 'tabs.calories', icon: 'camera-outline', iconActive: 'camera' },
  { name: 'community', label: 'tabs.community', icon: 'people-outline', iconActive: 'people' },
  { name: 'more', label: 'tabs.more', icon: 'grid-outline', iconActive: 'grid' },
];

export default function TabsLayout() {
  const { t } = useI18n();
  const theme = useTheme();
  const { ready, session, profile } = useAppState();

  if (ready && !session) return <Redirect href="/welcome" />;
  if (ready && !profile) return <Redirect href="/onboarding/personal" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
        },
        tabBarLabelStyle: { fontWeight: '600', fontSize: 11 },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? tab.iconActive : tab.icon}
                color={color as string}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
