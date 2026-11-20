import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type NotificationItem, type NotificationKind } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader, useAppMenu } from '@/components/app-menu';
import { Notice, type IconName } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

const ICONS: Record<NotificationKind, IconName> = {
  appointment_requested: 'calendar-outline',
  appointment_confirmed: 'checkmark-circle-outline',
  appointment_rejected: 'close-circle-outline',
  appointment_rescheduled: 'swap-horizontal-outline',
  appointment_cancelled: 'calendar-clear-outline',
  plan_adjusted: 'nutrition-outline',
  access_granted: 'lock-open-outline',
  access_revoked: 'lock-closed-outline',
  post_approved: 'checkmark-done-outline',
  post_removed: 'eye-off-outline',
  announcement: 'megaphone-outline',
};

/** Pagina deschisa la atingerea notificarii (nutritionistul ajunge in panoul sau). */
function target(n: NotificationItem, staff: boolean): Href | null {
  const { kind } = n;
  if (kind === 'announcement') return null;
  if (kind === 'post_approved' || kind === 'post_removed') {
    return typeof n.payload.postId === 'string'
      ? { pathname: '/post/[id]', params: { id: n.payload.postId } }
      : '/community';
  }
  if (kind === 'plan_adjusted') return '/meals';
  if (staff && kind !== 'appointment_confirmed' && kind !== 'appointment_rejected') return '/panel';
  return '/nutritionist';
}

export default function Notifications() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const { refreshUnread } = useAppMenu();
  const token = session?.token;
  const locale = localeOf(language);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      api
        .notifications(token)
        .then(async (r) => {
          setItems(r.items);
          if (r.unread > 0) {
            await api.readNotifications(token);
            refreshUnread();
          }
        })
        .catch((e) => setError(t(errorKey(e))));
    }, [token, t, refreshUnread]),
  );

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.sm, paddingBottom: th.spacing.xl },
    item: {
      flexDirection: 'row',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    unread: { backgroundColor: th.colors.primarySoft },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surfaceAlt,
    },
    text: { ...th.font.body, fontSize: 15, lineHeight: 21 },
    note: { ...th.font.caption, fontStyle: 'italic', marginTop: 4 },
    time: { ...th.font.caption, marginTop: 4 },
  }));

  const staff = session?.role === 'nutritionist';

  function message(n: NotificationItem): string {
    const p = n.payload;
    return t(`notifications.kinds.${n.kind}`, {
      clientName: String(p.clientName ?? ''),
      nutritionistName: String(p.nutritionistName ?? ''),
      day: typeof p.day === 'string' ? formatDay(p.day, locale) : '',
      time: String(p.time ?? ''),
      title: String(p.title ?? ''),
    });
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('notifications.title')} back />
        {error ? <Notice>{error}</Notice> : null}
        {!items && !error ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : null}
        {items && items.length === 0 ? (
          <Text style={[theme.font.caption, { textAlign: 'center', marginTop: 40 }]}>
            {t('notifications.empty')}
          </Text>
        ) : null}
        {items?.map((n) => (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            style={({ pressed }) => [s.item, !n.read && s.unread, pressed && { opacity: 0.8 }]}
            onPress={() => {
              const href = target(n, staff);
              if (href) router.navigate(href);
            }}
          >
            <View style={s.icon}>
              <Ionicons name={ICONS[n.kind]} size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.text}>{message(n)}</Text>
              {n.kind === 'announcement' && typeof n.payload.body === 'string' ? (
                <Text style={[s.text, { marginTop: 4 }]}>{n.payload.body}</Text>
              ) : null}
              {n.kind === 'post_removed' && typeof n.payload.reason === 'string' ? (
                <Text style={s.note}>
                  {t('notifications.reason')}: „{n.payload.reason}”
                </Text>
              ) : null}
              {typeof n.payload.note === 'string' && n.payload.note ? (
                <Text style={s.note}>„{n.payload.note}”</Text>
              ) : null}
              <Text style={s.time}>
                {new Date(n.createdAt).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
