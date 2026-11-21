import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getTrophy, type TrophyTier } from '@movemeal/shared';
import type { GoalProgress, SocialProfile, TrophyStatus } from '@/api/client';
import { Avatar, ProgressRing, RoleBadge } from '@/components/social';
import type { IconName } from '@/components/ui';
import { formatNumber, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

/** Antetul profilului: fotografia, numele, descrierea si cifrele principale. */
export function ProfileHero({
  profile,
  stats,
  onAvatarPress,
  action,
}: {
  profile: SocialProfile;
  stats: { label: string; value: number; onPress?: () => void }[];
  onAvatarPress?: () => void;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    hero: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: th.spacing.md },
    top: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    avatarRing: {
      padding: 3,
      borderRadius: 48,
      backgroundColor: 'rgba(255,255,255,0.35)',
    },
    camera: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { color: '#FFFFFF', fontWeight: '900', fontSize: 22 },
    bio: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 },
    stats: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderRadius: th.radius.lg,
      paddingVertical: th.spacing.sm + 2,
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statValue: { color: '#FFFFFF', fontWeight: '900', fontSize: 20 },
    statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  }));
  return (
    <LinearGradient
      colors={theme.gradients.hero}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={s.hero}
    >
      <View style={s.top}>
        <Pressable
          accessibilityRole={onAvatarPress ? 'button' : undefined}
          accessibilityLabel={onAvatarPress ? t('profile.changePhoto') : undefined}
          disabled={!onAvatarPress}
          onPress={onAvatarPress}
        >
          <View style={s.avatarRing}>
            <Avatar name={profile.displayName} avatarId={profile.avatarId} size={84} />
          </View>
          {onAvatarPress ? (
            <View style={s.camera}>
              <Ionicons name="camera" size={16} color={theme.colors.primary} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.name} numberOfLines={2}>
            {profile.displayName}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <RoleBadge role={profile.role} />
          </View>
        </View>
        {action}
      </View>
      {profile.bio ? <Text style={s.bio}>{profile.bio}</Text> : null}
      <View style={s.stats}>
        {stats.map((st) => (
          <Pressable
            key={st.label}
            style={s.stat}
            disabled={!st.onPress}
            onPress={st.onPress}
            accessibilityRole={st.onPress ? 'button' : 'text'}
          >
            <Text style={s.statValue}>{st.value}</Text>
            <Text style={s.statLabel}>{st.label}</Text>
          </Pressable>
        ))}
      </View>
    </LinearGradient>
  );
}

/** Cat din obiectiv a atins utilizatorul (pentru ceilalti: doar procentul si obiectivul). */
export function GoalCard({
  progress,
  detail,
  hidden,
}: {
  progress: { pct: number; kind: 'weight' | 'consistency'; goal: string };
  /** Detaliile (greutatea etc.) apar doar in profilul propriu. */
  detail?: GoalProgress | null;
  /** Profilul propriu: progresul este ascuns celorlalti. */
  hidden?: boolean;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    pct: { fontSize: 22, fontWeight: '900', color: th.colors.text },
    title: { ...th.font.heading },
    text: { ...th.font.caption, fontSize: 14 },
  }));
  const kg = (n: number) => `${formatNumber(n, language, 1)} ${t('common.kg')}`;
  let text: string;
  if (detail && detail.kind === 'weight' && detail.targetKg !== null) {
    text = t('profile.weightDetail', {
      start: kg(detail.startKg),
      current: kg(detail.currentKg),
      target: kg(detail.targetKg),
    });
  } else if (detail) {
    text = t('profile.consistencyDetail', {
      logged: detail.loggedDays,
      workouts: detail.workoutDays,
    });
  } else {
    text = t(`profile.kind.${progress.kind}`);
  }
  return (
    <View style={s.card}>
      <ProgressRing
        pct={progress.pct}
        color={theme.colors.primary}
        trackColor={theme.colors.surfaceAlt}
      >
        <Text style={s.pct}>{progress.pct}%</Text>
      </ProgressRing>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title}>{t(`profile.goals.${progress.goal}`)}</Text>
        <Text style={s.text}>{text}</Text>
        {hidden ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="eye-off-outline" size={14} color={theme.colors.textMuted} />
            <Text style={[theme.font.caption, { fontSize: 12 }]}>
              {t('profile.progressHidden')}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const TIER_COLORS: Record<TrophyTier, { color: string; soft: string }> = {
  gold: { color: '#D97706', soft: 'rgba(217, 119, 6, 0.14)' },
  silver: { color: '#64748B', soft: 'rgba(100, 116, 139, 0.16)' },
  bronze: { color: '#B45309', soft: 'rgba(180, 83, 9, 0.14)' },
};

/**
 * Trofeele pentru provocari. In profilul propriu apar toate (cele neobtinute estompate, cu
 * progresul); la ceilalti utilizatori doar cele obtinute.
 */
export function TrophyShelf({ trophies, own }: { trophies: TrophyStatus[]; own: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    item: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      padding: th.spacing.sm + 2,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    medal: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...th.font.body, fontWeight: '800', fontSize: 13, lineHeight: 17 },
    sub: { ...th.font.caption, fontSize: 11, lineHeight: 15 },
  }));
  const list = own ? trophies : trophies.filter((x) => x.earned);
  if (!list.length) return null;
  const earned = trophies.filter((x) => x.earned).length;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={s.head}>
        <Ionicons name="trophy-outline" size={20} color={theme.colors.primary} />
        <Text style={[theme.font.heading, { flex: 1 }]}>{t('trophies.title')}</Text>
        {own ? (
          <Text style={theme.font.caption}>
            {earned}/{trophies.length}
          </Text>
        ) : null}
      </View>
      <View style={s.grid}>
        {list.map((trophy) => {
          const def = getTrophy(trophy.id);
          const tier = TIER_COLORS[def?.tier ?? 'bronze'];
          return (
            <View
              key={trophy.id}
              style={[s.item, trophy.earned && { borderColor: tier.color }]}
              accessibilityLabel={`${t(`trophies.${trophy.id}.title`)}: ${t(`trophies.${trophy.id}.desc`)}`}
            >
              <View
                style={[
                  s.medal,
                  { backgroundColor: trophy.earned ? tier.color : theme.colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name={(def?.icon ?? 'trophy') as IconName}
                  size={22}
                  color={trophy.earned ? '#FFFFFF' : theme.colors.textMuted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[s.title, !trophy.earned && { color: theme.colors.textMuted }]}
                  numberOfLines={2}
                >
                  {t(`trophies.${trophy.id}.title`)}
                </Text>
                <Text style={s.sub} numberOfLines={2}>
                  {trophy.earned
                    ? t(`trophies.tiers.${def?.tier ?? 'bronze'}`)
                    : `${trophy.progress}/${trophy.goal} · ${t(`trophies.${trophy.id}.short`)}`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
