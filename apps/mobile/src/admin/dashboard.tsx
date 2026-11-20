import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { api, type AdminStats } from '@/api/client';
import { errorKey } from '@/api/errors';
import { Card, Notice, type IconName } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';
import type { AdminTab } from './types';

export function StatTile({
  label,
  value,
  icon,
  tone,
  onPress,
}: {
  label: string;
  value: number | string;
  icon: IconName;
  tone?: 'warning' | 'danger';
  onPress?: () => void;
}) {
  const theme = useTheme();
  const color =
    tone === 'danger'
      ? theme.colors.danger
      : tone === 'warning'
        ? theme.colors.warning
        : theme.colors.primary;
  const s = useStyles((th) => ({
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: th.spacing.md - 2,
      borderRadius: th.radius.md,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
      gap: 4,
    },
    value: { fontSize: 24, fontWeight: '900', color: th.colors.text },
    label: { ...th.font.caption, fontSize: 12 },
  }));
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [s.tile, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[s.value, tone && { color }]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </Pressable>
  );
}

/** Grafic cu bare pentru ultimele 14 zile: conturi noi si conturi active. */
function ActivityChart({ series }: { series: AdminStats['series'] }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const max = Math.max(1, ...series.map((d) => Math.max(d.active, d.signups)));
  const height = 120;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 3 }}>
        {series.map((d) => (
          <View
            key={d.day}
            style={{ flex: 1, height, justifyContent: 'flex-end', alignItems: 'center' }}
            accessible
            accessibilityLabel={`${d.day}: ${t('admin.chartActive')} ${d.active}, ${t('admin.chartNew')} ${d.signups}`}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1, height }}>
              <View
                style={{
                  width: 7,
                  height: Math.max(2, (d.active / max) * height),
                  borderRadius: 3,
                  backgroundColor: theme.colors.primary,
                }}
              />
              <View
                style={{
                  width: 7,
                  height: Math.max(2, (d.signups / max) * height),
                  borderRadius: 3,
                  backgroundColor: theme.colors.warning,
                }}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[series[0], series[series.length - 1]].map((d, i) =>
          d ? (
            <Text key={i} style={[theme.font.caption, { fontSize: 11 }]}>
              {new Date(`${d.day}T12:00:00`).toLocaleDateString(localeOf(language), {
                day: 'numeric',
                month: 'short',
              })}
            </Text>
          ) : null,
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        {[
          { color: theme.colors.primary, label: t('admin.chartActive') },
          { color: theme.colors.warning, label: t('admin.chartNew') },
        ].map((l) => (
          <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: l.color }} />
            <Text style={[theme.font.caption, { fontSize: 12 }]}>{l.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function DashboardSection({
  token,
  onNavigate,
}: {
  token: string;
  onNavigate: (tab: AdminTab, filter?: string) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.admin
        .stats(token)
        .then(setStats)
        .catch((e) => setError(t(errorKey(e))));
    }, [token, t]),
  );

  const s = useStyles((th) => ({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    alert: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      padding: th.spacing.md - 2,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.warningSoft,
    },
    alertText: { ...th.font.body, color: th.colors.warning, flex: 1, fontWeight: '700' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: 6,
    },
  }));

  if (error) return <Notice>{error}</Notice>;
  if (!stats) return <ActivityIndicator color={theme.colors.primary} />;
  const toReview = stats.content.pending + stats.content.reported;

  return (
    <>
      {toReview > 0 ? (
        <Pressable
          accessibilityRole="button"
          style={s.alert}
          onPress={() => onNavigate('moderation', stats.content.pending ? 'pending' : 'reported')}
        >
          <Ionicons name="alert-circle" size={22} color={theme.colors.warning} />
          <Text style={s.alertText}>
            {t('admin.reviewAlert', {
              pending: stats.content.pending,
              reported: stats.content.reported,
            })}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.warning} />
        </Pressable>
      ) : null}

      <Card title={t('admin.accounts')} icon="people-outline">
        <View style={s.grid}>
          <StatTile
            label={t('admin.total')}
            value={stats.users.total}
            icon="people-outline"
            onPress={() => onNavigate('users')}
          />
          <StatTile
            label={t('admin.activeToday')}
            value={stats.users.activeToday}
            icon="pulse-outline"
          />
          <StatTile
            label={t('admin.newToday')}
            value={stats.users.newToday}
            icon="person-add-outline"
          />
          <StatTile
            label={t('admin.activeWeek')}
            value={stats.users.activeThisWeek}
            icon="calendar-outline"
          />
          <StatTile
            label={t('admin.newWeek')}
            value={stats.users.newThisWeek}
            icon="trending-up-outline"
          />
          <StatTile
            label={t('admin.blocked')}
            value={stats.users.blocked}
            icon="ban-outline"
            tone={stats.users.blocked ? 'danger' : undefined}
            onPress={() => onNavigate('users', 'blocked')}
          />
        </View>
        <Text style={theme.font.caption}>
          {t('roles.user')}: {stats.users.users} · {t('roles.nutritionist')}:{' '}
          {stats.users.nutritionists} · {t('roles.admin')}: {stats.users.admins}
        </Text>
      </Card>

      <Card title={t('admin.activity14')} icon="bar-chart-outline">
        <ActivityChart series={stats.series} />
      </Card>

      <Card title={t('admin.community')} icon="images-outline">
        <View style={s.grid}>
          <StatTile
            label={t('admin.publicPosts')}
            value={stats.content.publicPosts}
            icon="globe-outline"
          />
          <StatTile
            label={t('admin.postsWeek')}
            value={stats.content.postsThisWeek}
            icon="add-circle-outline"
          />
          <StatTile
            label={t('admin.pending')}
            value={stats.content.pending}
            icon="time-outline"
            tone={stats.content.pending ? 'warning' : undefined}
            onPress={() => onNavigate('moderation', 'pending')}
          />
          <StatTile
            label={t('admin.reported')}
            value={stats.content.reported}
            icon="flag-outline"
            tone={stats.content.reported ? 'danger' : undefined}
            onPress={() => onNavigate('moderation', 'reported')}
          />
          <StatTile
            label={t('admin.removedPosts')}
            value={stats.content.removed}
            icon="eye-off-outline"
          />
          <StatTile
            label={t('admin.postLikes')}
            value={stats.content.postLikes}
            icon="heart-outline"
          />
        </View>
      </Card>

      <Card title={t('admin.aiModeration')} icon="shield-checkmark-outline">
        <View style={s.grid}>
          <StatTile
            label={t('admin.approved7')}
            value={stats.moderation.approved}
            icon="checkmark-circle-outline"
          />
          <StatTile
            label={t('admin.rejected7')}
            value={stats.moderation.rejected}
            icon="close-circle-outline"
            tone={stats.moderation.rejected ? 'danger' : undefined}
          />
        </View>
        {stats.moderation.reasons.map((r) => (
          <View key={r.reason} style={s.row}>
            <Ionicons name="remove-circle-outline" size={16} color={theme.colors.textMuted} />
            <Text style={[theme.font.body, { flex: 1 }]}>
              {t(`admin.rejectReasons.${r.reason}`)}
            </Text>
            <Text style={[theme.font.body, { fontWeight: '800' }]}>{r.count}</Text>
          </View>
        ))}
      </Card>

      <Card title={t('admin.ai')} icon="sparkles-outline">
        <View style={s.grid}>
          <StatTile
            label={t('admin.chatToday')}
            value={stats.ai.chatToday}
            icon="chatbubbles-outline"
          />
          <StatTile
            label={t('admin.chatWeek')}
            value={stats.ai.chatWeek}
            icon="chatbubbles-outline"
          />
          <StatTile
            label={t('admin.photoToday')}
            value={stats.ai.photoToday}
            icon="camera-outline"
          />
          <StatTile label={t('admin.photoWeek')} value={stats.ai.photoWeek} icon="camera-outline" />
        </View>
      </Card>

      <Card title={t('admin.blog')} icon="newspaper-outline">
        <View style={s.grid}>
          <StatTile
            label={t('admin.articles')}
            value={stats.content.articles}
            icon="document-text-outline"
            onPress={() => onNavigate('articles')}
          />
          <StatTile label={t('admin.drafts')} value={stats.content.drafts} icon="create-outline" />
          <StatTile
            label={t('admin.articleViews')}
            value={stats.content.articleViews}
            icon="eye-outline"
          />
          <StatTile
            label={t('admin.articleLikes')}
            value={stats.content.articleLikes}
            icon="heart-outline"
          />
        </View>
        {stats.topArticles.length ? (
          <Text style={[theme.font.heading, { marginTop: 4 }]}>{t('admin.topArticles')}</Text>
        ) : null}
        {stats.topArticles.map((a, i) => (
          <View key={a.id} style={s.row}>
            <Text
              style={[
                theme.font.body,
                { fontWeight: '900', color: theme.colors.primary, width: 20 },
              ]}
            >
              {i + 1}
            </Text>
            <Text style={[theme.font.body, { flex: 1 }]} numberOfLines={1}>
              {a.title}
            </Text>
            <Ionicons name="eye-outline" size={14} color={theme.colors.textMuted} />
            <Text style={theme.font.caption}>{a.views}</Text>
          </View>
        ))}
      </Card>

      <Card title={t('admin.appointments')} icon="calendar-outline">
        <View style={s.grid}>
          {(['requested', 'confirmed', 'rejected', 'cancelled'] as const).map((k) => (
            <StatTile
              key={k}
              label={t(`consult.status.${k}`)}
              value={stats.appointments[k]}
              icon="calendar-outline"
            />
          ))}
        </View>
      </Card>
    </>
  );
}
