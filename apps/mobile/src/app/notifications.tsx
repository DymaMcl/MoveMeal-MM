import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  api,
  type NewsItem,
  type NotificationItem,
  type NotificationKind,
  type NotificationSection,
} from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader, useAppMenu } from '@/components/app-menu';
import { timeAgo } from '@/components/social';
import { Notice, type IconName } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

const SECTIONS: NotificationSection[] = ['community', 'news', 'personal'];

const SECTION_ICONS: Record<NotificationSection, IconName> = {
  community: 'people-outline',
  news: 'sparkles-outline',
  personal: 'person-outline',
};

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
  post_liked: 'heart',
  new_follower: 'person-add',
  trophy: 'trophy',
  announcement: 'megaphone-outline',
};

/** Culorile insignelor din „Ce e nou?”: functiile aplicatiei (rosu) si trofeele (auriu). */
const FEATURE = { color: '#E11D48', soft: 'rgba(225, 29, 72, 0.12)' };
const TROPHY = { color: '#D97706', soft: 'rgba(217, 119, 6, 0.14)' };

/** Pagina deschisa la atingerea notificarii (nutritionistul ajunge in panoul sau). */
function target(n: NotificationItem, staff: boolean): Href | null {
  const { kind, payload } = n;
  if (kind === 'announcement') return null;
  if (kind === 'trophy') return '/more';
  if (kind === 'new_follower') {
    return typeof payload.userId === 'string'
      ? { pathname: '/user/[id]', params: { id: payload.userId } }
      : null;
  }
  if (kind === 'post_approved' || kind === 'post_removed' || kind === 'post_liked') {
    return typeof payload.postId === 'string'
      ? { pathname: '/post/[id]', params: { id: payload.postId } }
      : '/community';
  }
  if (kind === 'plan_adjusted') return '/meals';
  if (staff && kind !== 'appointment_confirmed' && kind !== 'appointment_rejected') return '/panel';
  return '/nutritionist';
}

/** Un element din „Ce e nou?”: noutatile aplicatiei si notificarile personale (trofee, anunturi). */
type NewsEntry =
  | { type: 'news'; item: NewsItem; at: string }
  | { type: 'notification'; item: NotificationItem; at: string };

export default function Notifications() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const { refreshUnread } = useAppMenu();
  const token = session?.token;
  const locale = localeOf(language);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [counts, setCounts] = useState<Record<NotificationSection, number>>({
    community: 0,
    news: 0,
    personal: 0,
  });
  const [section, setSection] = useState<NotificationSection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      Promise.all([api.notifications(token), api.news(token, language)])
        .then(([r, n]) => {
          setItems(r.items);
          setNews(n);
          setCounts(r.sections);
          // Se deschide sectiunea cu noutati necitite (altfel comunitatea).
          setSection(
            (current) => current ?? SECTIONS.find((x) => r.sections[x] > 0) ?? 'community',
          );
        })
        .catch((e) => setError(t(errorKey(e))));
    }, [token, language, t]),
  );

  // Sectiunea deschisa este marcata ca citita (dupa ce utilizatorul a vazut-o).
  useEffect(() => {
    if (!token || !section || counts[section] === 0) return;
    const timer = setTimeout(() => {
      api
        .readNotifications(token, section)
        .then(() => {
          setCounts((c) => ({ ...c, [section]: 0 }));
          refreshUnread();
        })
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [token, section, counts, refreshUnread]);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.sm, paddingBottom: th.spacing.xl },
    tabs: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.surfaceAlt,
      marginBottom: th.spacing.sm,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      minHeight: 42,
      paddingHorizontal: 6,
      borderRadius: th.radius.pill,
    },
    tabActive: { backgroundColor: th.colors.surface, ...th.elevation },
    tabText: { fontSize: 13, fontWeight: '700' },
    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      backgroundColor: th.colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
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
    bold: { fontWeight: '800' },
    note: { ...th.font.caption, fontStyle: 'italic', marginTop: 4 },
    time: { ...th.font.caption, marginTop: 4 },
    card: {
      padding: th.spacing.md,
      gap: 8,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    label: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    labelBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    labelText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
    newDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 'auto' },
    cardTitle: { ...th.font.heading, fontSize: 17 },
    empty: { alignItems: 'center', gap: th.spacing.sm, paddingVertical: th.spacing.xl },
  }));

  const staff = session?.role === 'nutritionist';

  function message(n: NotificationItem): string {
    const p = n.payload;
    return t(`notifications.kinds.${n.kind}`, {
      clientName: String(p.clientName ?? ''),
      nutritionistName: String(p.nutritionistName ?? ''),
      name: String(p.name ?? ''),
      trophy: typeof p.trophyId === 'string' ? t(`trophies.${p.trophyId}.title`) : '',
      day: typeof p.day === 'string' ? formatDay(p.day, locale) : '',
      time: String(p.time ?? ''),
      title: String(p.title ?? ''),
    });
  }

  const newsEntries = useMemo<NewsEntry[]>(
    () =>
      [
        ...news.map((item) => ({ type: 'news' as const, item, at: item.createdAt })),
        ...(items ?? [])
          .filter((n) => n.section === 'news')
          .map((item) => ({ type: 'notification' as const, item, at: item.createdAt })),
      ].sort((a, b) => b.at.localeCompare(a.at)),
    [news, items],
  );

  const list = (items ?? []).filter((n) => n.section === section);

  /** Insigna din „Ce e nou?”: functie a aplicatiei (rosu, bifa) sau trofeu (auriu, cupa). */
  const label = (kind: 'feature' | 'challenge' | 'trophy' | 'announcement', fresh: boolean) => {
    const style =
      kind === 'feature'
        ? {
            ...FEATURE,
            icon: 'checkmark-done' as IconName,
            text: t('notifications.labels.feature'),
          }
        : kind === 'announcement'
          ? {
              color: theme.colors.primary,
              soft: theme.colors.primarySoft,
              icon: 'megaphone' as IconName,
              text: t('notifications.labels.announcement'),
            }
          : {
              ...TROPHY,
              icon: (kind === 'trophy' ? 'trophy' : 'medal') as IconName,
              text: t(`notifications.labels.${kind}`),
            };
    return (
      <View style={s.label}>
        <View style={[s.labelBadge, { backgroundColor: style.color }]}>
          <Ionicons name={style.icon} size={15} color="#FFFFFF" />
        </View>
        <Text style={[s.labelText, { color: style.color }]}>{style.text}</Text>
        {fresh ? <View style={[s.newDot, { backgroundColor: style.color }]} /> : null}
      </View>
    );
  };

  const time = (iso: string) => <Text style={s.time}>{timeAgo(iso, t, language)}</Text>;

  const emptyState = (key: NotificationSection) => (
    <View style={s.empty}>
      <Ionicons name={SECTION_ICONS[key]} size={40} color={theme.colors.textMuted} />
      <Text style={[theme.font.caption, { textAlign: 'center' }]}>
        {t(`notifications.empty.${key}`)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('notifications.title')} back />

        <View style={s.tabs} accessibilityRole="tablist">
          {SECTIONS.map((key) => {
            const active = key === section;
            const color = active ? theme.colors.text : theme.colors.textMuted;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSection(key)}
                style={[s.tab, active && s.tabActive]}
              >
                <Text style={[s.tabText, { color }]} numberOfLines={1}>
                  {t(`notifications.tabs.${key}`)}
                </Text>
                {counts[key] > 0 ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{counts[key] > 9 ? '9+' : counts[key]}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {error ? <Notice>{error}</Notice> : null}
        {!items && !error ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : null}

        {items && section === 'news'
          ? newsEntries.length === 0
            ? emptyState('news')
            : newsEntries.map((entry) => {
                if (entry.type === 'news') {
                  const n = entry.item;
                  return (
                    <View key={`news-${n.id}`} style={s.card}>
                      {label(n.kind, n.unread)}
                      <Text style={s.cardTitle}>{n.title}</Text>
                      <Text style={s.text}>{n.body}</Text>
                      {time(n.createdAt)}
                    </View>
                  );
                }
                const n = entry.item;
                const trophy = n.kind === 'trophy';
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="button"
                    onPress={() => {
                      const href = target(n, staff);
                      if (href) router.navigate(href);
                    }}
                    style={({ pressed }) => [
                      s.card,
                      trophy && { backgroundColor: TROPHY.soft, borderColor: TROPHY.color },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    {label(trophy ? 'trophy' : 'announcement', !n.read)}
                    <Text style={s.cardTitle}>
                      {trophy ? message(n) : String(n.payload.title ?? '')}
                    </Text>
                    {trophy && typeof n.payload.trophyId === 'string' ? (
                      <Text style={s.text}>{t(`trophies.${n.payload.trophyId}.desc`)}</Text>
                    ) : null}
                    {!trophy && typeof n.payload.body === 'string' ? (
                      <Text style={s.text}>{n.payload.body}</Text>
                    ) : null}
                    {time(n.createdAt)}
                  </Pressable>
                );
              })
          : null}

        {items && section && section !== 'news'
          ? list.length === 0
            ? emptyState(section)
            : list.map((n) => {
                const social = n.kind === 'post_liked' || n.kind === 'new_follower';
                return (
                  <Pressable
                    key={n.id}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      s.item,
                      !n.read && s.unread,
                      pressed && { opacity: 0.8 },
                    ]}
                    onPress={() => {
                      const href = target(n, staff);
                      if (href) router.navigate(href);
                    }}
                  >
                    <View
                      style={[s.icon, n.kind === 'post_liked' && { backgroundColor: FEATURE.soft }]}
                    >
                      <Ionicons
                        name={ICONS[n.kind]}
                        size={20}
                        color={n.kind === 'post_liked' ? FEATURE.color : theme.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      {social ? (
                        <Text style={s.text}>
                          <Text style={s.bold}>{String(n.payload.name ?? '')}</Text>{' '}
                          {t(`notifications.actions.${n.kind}`)}
                        </Text>
                      ) : (
                        <Text style={s.text}>{message(n)}</Text>
                      )}
                      {n.kind === 'post_removed' && typeof n.payload.reason === 'string' ? (
                        <Text style={s.note}>
                          {t('notifications.reason')}: „{n.payload.reason}”
                        </Text>
                      ) : null}
                      {typeof n.payload.note === 'string' && n.payload.note ? (
                        <Text style={s.note}>„{n.payload.note}”</Text>
                      ) : null}
                      {social ? (
                        time(n.createdAt)
                      ) : (
                        <Text style={s.time}>
                          {new Date(n.createdAt).toLocaleString(locale, {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })
          : null}
      </ScrollView>
    </SafeAreaView>
  );
}
