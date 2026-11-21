import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import type { IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

interface MenuContextValue {
  open: () => void;
  /** Numarul notificarilor necitite (afisat pe butonul meniului). */
  unread: number;
  refreshUnread: () => void;
}

const MenuContext = createContext<MenuContextValue>({
  open: () => undefined,
  unread: 0,
  refreshUnread: () => undefined,
});

export const useAppMenu = () => useContext(MenuContext);

interface MenuItem {
  key: string;
  label: string;
  icon: IconName;
  href: Href;
  /** Calea folosita pentru evidentierea elementului curent. */
  path: string;
  badge?: number;
}

/** Meniul cu toate paginile, deschis din butonul cu 3 linii din dreapta sus. */
export function AppMenuProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { session, profile, signOut } = useAppState();
  const [visible, setVisible] = useState(false);
  const [unread, setUnread] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const panelWidth = Math.min(340, width * 0.86);

  const token = session?.token;
  const refreshUnread = useCallback(() => {
    if (!token) return;
    api
      .notifications(token)
      .then((r) => setUnread(r.unread))
      .catch(() => undefined);
  }, [token]);

  // Numarul notificarilor se actualizeaza la schimbarea paginii.
  useEffect(() => {
    if (token) refreshUnread();
    else setUnread(0);
  }, [token, pathname, refreshUnread]);

  const open = useCallback(() => {
    setVisible(true);
    refreshUnread();
    slide.setValue(0);
    Animated.timing(slide, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [slide, refreshUnread]);

  const close = useCallback(
    (then?: () => void) => {
      Animated.timing(slide, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        then?.();
      });
    },
    [slide],
  );

  const role = session?.role ?? 'user';
  const sections = useMemo(() => {
    const main: MenuItem[] = [
      { key: 'home', label: t('menu.home'), icon: 'home-outline', href: '/home', path: '/home' },
      {
        key: 'workout',
        label: t('menu.workout'),
        icon: 'barbell-outline',
        href: '/workout',
        path: '/workout',
      },
      {
        key: 'meals',
        label: t('menu.meals'),
        icon: 'restaurant-outline',
        href: '/meals',
        path: '/meals',
      },
      {
        key: 'calories',
        label: t('menu.calories'),
        icon: 'calculator-outline',
        href: '/calories',
        path: '/calories',
      },
      {
        key: 'activity',
        label: t('menu.activity'),
        icon: 'flame-outline',
        href: '/activity',
        path: '/activity',
      },
      {
        key: 'fasting',
        label: t('menu.fasting'),
        icon: 'timer-outline',
        href: '/fasting',
        path: '/fasting',
      },
      {
        key: 'foodPhoto',
        label: t('menu.foodPhoto'),
        icon: 'camera-outline',
        href: '/food-photo',
        path: '/food-photo',
      },
      {
        key: 'community',
        label: t('menu.community'),
        icon: 'people-outline',
        href: '/community',
        path: '/community',
      },
      {
        key: 'blog',
        label: t('menu.blog'),
        icon: 'newspaper-outline',
        href: '/blog',
        path: '/blog',
      },
      {
        key: 'progress',
        label: t('menu.progress'),
        icon: 'stats-chart-outline',
        href: '/progress',
        path: '/progress',
      },
    ];
    const support: MenuItem[] = [
      {
        key: 'nutritionist',
        label: t('menu.nutritionist'),
        icon: 'medkit-outline',
        href: '/nutritionist',
        path: '/nutritionist',
      },
      {
        key: 'assistant',
        label: t('menu.assistant'),
        icon: 'chatbubbles-outline',
        href: '/assistant',
        path: '/assistant',
      },
      {
        key: 'body',
        label: t('menu.bodyCheck'),
        icon: 'speedometer-outline',
        href: '/body-check',
        path: '/body-check',
      },
      {
        key: 'notifications',
        label: t('menu.notifications'),
        icon: 'notifications-outline',
        href: '/notifications',
        path: '/notifications',
        badge: unread,
      },
    ];
    const staff: MenuItem[] = [];
    if (role === 'nutritionist') {
      staff.push({
        key: 'panel',
        label: t('menu.nutritionistPanel'),
        icon: 'clipboard-outline',
        href: '/panel',
        path: '/panel',
      });
    }
    if (role === 'admin') {
      staff.push({
        key: 'admin',
        label: t('menu.adminPanel'),
        icon: 'shield-checkmark-outline',
        href: '/admin',
        path: '/admin',
      });
    }
    const account: MenuItem[] = [
      {
        key: 'profile',
        label: t('menu.profile'),
        icon: 'person-circle-outline',
        href: '/more',
        path: '/more',
      },
      {
        key: 'settings',
        label: t('menu.settings'),
        icon: 'settings-outline',
        href: '/settings',
        path: '/settings',
      },
    ];
    return [
      ...(staff.length ? [{ title: t('menu.staff'), items: staff }] : []),
      { title: t('menu.main'), items: main },
      { title: t('menu.support'), items: support },
      { title: t('menu.account'), items: account },
    ];
  }, [t, role, unread]);

  const s = useStyles((th) => ({
    backdrop: { flex: 1, backgroundColor: 'rgba(5, 10, 25, 0.45)' },
    panel: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: 0,
      backgroundColor: th.colors.background,
      borderLeftWidth: 1,
      borderLeftColor: th.colors.border,
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      paddingHorizontal: th.spacing.lg,
      paddingBottom: th.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: th.colors.border,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: th.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: th.colors.onPrimary, fontWeight: '900', fontSize: 20 },
    name: { ...th.font.heading },
    email: { ...th.font.caption },
    role: {
      alignSelf: 'flex-start',
      marginTop: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.primary,
    },
    roleText: { color: th.colors.primary, fontSize: 11, fontWeight: '800' },
    close: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surfaceAlt,
    },
    list: { paddingVertical: th.spacing.sm, paddingBottom: th.spacing.xl },
    section: {
      ...th.font.caption,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: th.spacing.lg,
      paddingTop: th.spacing.md,
      paddingBottom: th.spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      marginHorizontal: th.spacing.sm,
      paddingHorizontal: th.spacing.md,
      minHeight: 48,
      borderRadius: th.radius.md,
    },
    itemActive: { backgroundColor: th.colors.primarySoft },
    itemText: { ...th.font.body, fontWeight: '600', flex: 1 },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: th.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
    logout: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      marginHorizontal: th.spacing.sm,
      marginTop: th.spacing.md,
      paddingHorizontal: th.spacing.md,
      minHeight: 48,
    },
  }));

  const go = (href: Href) => close(() => router.navigate(href));
  const name = profile?.name ?? session?.email.split('@')[0] ?? '';

  return (
    <MenuContext.Provider value={{ open, unread, refreshUnread }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => close()}
      >
        <Animated.View style={[s.backdrop, { opacity: slide }]}>
          <Pressable
            style={{ flex: 1 }}
            accessibilityLabel={t('menu.close')}
            onPress={() => close()}
          />
        </Animated.View>
        <Animated.View
          style={[
            s.panel,
            {
              width: panelWidth,
              paddingTop: insets.top + 12,
              transform: [
                {
                  translateX: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [panelWidth, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.head}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={s.email} numberOfLines={1}>
                {session?.email}
              </Text>
              {role !== 'user' ? (
                <View style={s.role}>
                  <Text style={s.roleText}>{t(`roles.${role}`)}</Text>
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('menu.close')}
              style={s.close}
              onPress={() => close()}
            >
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 24 }]}>
            {sections.map((section) => (
              <View key={section.title}>
                <Text style={s.section}>{section.title}</Text>
                {section.items.map((item) => {
                  const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
                  return (
                    <Pressable
                      key={item.key}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        s.item,
                        active && s.itemActive,
                        pressed && { opacity: 0.7 },
                      ]}
                      onPress={() => go(item.href)}
                    >
                      <Ionicons
                        name={item.icon}
                        size={22}
                        color={active ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <Text
                        style={[s.itemText, active && { color: theme.colors.primary }]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.badge ? (
                        <View style={s.badge}>
                          <Text style={s.badgeText}>{item.badge > 99 ? '99+' : item.badge}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [s.logout, pressed && { opacity: 0.7 }]}
              onPress={() =>
                close(async () => {
                  await signOut();
                  router.replace('/welcome');
                })
              }
            >
              <Ionicons name="log-out-outline" size={22} color={theme.colors.danger} />
              <Text style={[s.itemText, { color: theme.colors.danger }]}>{t('menu.logout')}</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </Modal>
    </MenuContext.Provider>
  );
}

/** Butonul cu 3 linii; punctul rosu arata notificarile necitite. */
export function MenuButton({ light = false }: { light?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const { open, unread } = useAppMenu();
  const s = useStyles((th) => ({
    button: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    dot: {
      position: 'absolute',
      top: 8,
      right: 9,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: th.colors.danger,
      borderWidth: 2,
      borderColor: th.colors.surface,
    },
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('menu.open')}
      hitSlop={6}
      onPress={open}
      style={({ pressed }) => [
        s.button,
        light && { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'transparent' },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name="menu" size={24} color={light ? '#FFFFFF' : theme.colors.text} />
      {unread > 0 ? <View style={s.dot} /> : null}
    </Pressable>
  );
}

/** Antetul paginilor: buton inapoi (optional), titlu si butonul meniului in dreapta. */
export function ScreenHeader({
  title,
  subtitle,
  back = false,
  onBack,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
}) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surfaceAlt,
    },
    text: { flex: 1 },
    title: { ...th.font.title, fontSize: 24 },
    subtitle: { ...th.font.caption, marginTop: 2 },
  }));
  return (
    <View style={s.row}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          style={s.back}
          onPress={() =>
            onBack ? onBack() : router.canGoBack() ? router.back() : router.replace('/')
          }
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
      ) : null}
      <View style={s.text}>
        <Text style={s.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      </View>
      <MenuButton />
    </View>
  );
}
