import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { GoalProgress, SocialProfile } from '@/api/client';
import { Avatar, ProgressRing, RoleBadge } from '@/components/social';
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
