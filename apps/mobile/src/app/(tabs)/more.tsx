import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Segmented } from '@/components/ui';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme, useThemeSettings, type ThemeMode } from '@/theme';

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
  const { t, language, setLanguage, formatWeeks } = useI18n();
  const theme = useTheme();
  const { mode, setMode } = useThemeSettings();
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
    label: {
      ...th.font.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    group: { gap: th.spacing.sm },
  }));

  if (!profile) return null;

  const themeOptions: {
    value: ThemeMode;
    label: string;
    icon: 'phone-portrait-outline' | 'sunny' | 'moon';
  }[] = [
    { value: 'system', label: t('settings.themeSystem'), icon: 'phone-portrait-outline' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon' },
  ];
  const languageOptions: { value: Language; label: string }[] = LANGUAGES.map((l) => ({
    value: l.value,
    label: l.label,
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={theme.font.title}>{t('tabs.more')}</Text>

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

        <Card title={t('settings.title')} icon="settings">
          <View style={s.group}>
            <Text style={s.label}>{t('settings.theme')}</Text>
            <Segmented options={themeOptions} value={mode} onChange={setMode} />
          </View>
          <View style={s.group}>
            <Text style={s.label}>{t('settings.language')}</Text>
            <Segmented options={languageOptions} value={language} onChange={setLanguage} />
          </View>
        </Card>

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
