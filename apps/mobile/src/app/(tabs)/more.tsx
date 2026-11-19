import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/app-menu';
import { Button, Card } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: th.spacing.md,
      paddingVertical: 6,
    },
    value: { ...th.font.body, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  }));
  return (
    <View style={s.row}>
      <Text style={theme.font.caption}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export default function More() {
  const { t, formatWeeks } = useI18n();
  const theme = useTheme();
  const { profile, session, signOut, resetProfile } = useAppState();
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    profile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.lg,
      borderRadius: th.radius.xl,
    },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 24 },
    name: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
    email: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  }));

  if (!profile) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('menu.profile')} />

        <LinearGradient
          colors={theme.gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.profile}
        >
          <View style={s.avatar}>
            <Text style={s.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{profile.name}</Text>
            <Text style={s.email}>{session?.email ?? ''}</Text>
          </View>
        </LinearGradient>

        <Card title={t('more.profile')} icon="person">
          <Row label={t('onboarding.personal.age')} value={`${profile.age} ${t('common.years')}`} />
          <Row
            label={t('onboarding.body.height')}
            value={`${profile.heightCm} ${t('common.cm')}`}
          />
          <Row
            label={t('onboarding.body.weight')}
            value={`${profile.weightKg} ${t('common.kg')}`}
          />
          <Row label={t('onboarding.goal.title')} value={t(`onboarding.goal.${profile.goal}`)} />
          {profile.targetWeightKg !== undefined ? (
            <Row
              label={t('onboarding.target.title')}
              value={`${profile.targetWeightKg} ${t('common.kg')} · ${formatWeeks(profile.weeks ?? 0)}`}
            />
          ) : null}
          <Row
            label={t('onboarding.activity.title')}
            value={t(`onboarding.activity.${profile.activityLevel}`)}
          />
        </Card>

        <Button
          title={t('progress.open')}
          icon="stats-chart"
          variant="secondary"
          onPress={() => router.push('/progress')}
        />

        <Button
          title={t('settings.title')}
          icon="settings-outline"
          variant="secondary"
          onPress={() => router.push('/settings')}
        />

        <Button
          title={t('more.resetProfile')}
          icon="refresh"
          variant="secondary"
          onPress={async () => {
            resetProfile();
            router.replace('/onboarding/personal');
          }}
        />
        <Button
          title={t('more.logout')}
          icon="log-out-outline"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/welcome');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
