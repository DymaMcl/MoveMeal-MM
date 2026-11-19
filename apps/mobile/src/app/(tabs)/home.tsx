import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieRing } from '@/components/calorie-ring';
import { Card, IconCircle, Notice, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return 'home.morning';
  if (hour >= 12 && hour < 18) return 'home.day';
  return 'home.evening';
}

function MacroBar({
  label,
  value,
  target,
  color,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
}) {
  const s = useStyles((th) => ({
    wrap: { gap: 6 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    label: { ...th.font.body, fontWeight: '600' },
    track: { height: 10, borderRadius: th.radius.pill, backgroundColor: th.colors.surfaceAlt },
    fill: { height: 10, borderRadius: th.radius.pill },
  }));
  const theme = useTheme();
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={s.labelRow}>
          <View style={[s.dot, { backgroundColor: color }]} />
          <Text style={s.label}>{label}</Text>
        </View>
        <Text style={theme.font.caption}>
          {value} / {target} g
        </Text>
      </View>
      <View style={s.track}>
        <View style={[s.fill, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function StatTile({
  icon,
  label,
  value,
  color,
  background,
}: {
  icon: IconName;
  label: string;
  value: string;
  color: string;
  background: string;
}) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    tile: {
      flex: 1,
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.lg,
      padding: th.spacing.md,
      gap: th.spacing.sm,
      borderWidth: th.scheme === 'dark' ? 1 : 0,
      borderColor: th.colors.border,
      ...th.elevation,
    },
    value: { ...th.font.heading, fontSize: 20 },
  }));
  return (
    <View style={s.tile}>
      <IconCircle icon={icon} color={color} background={background} size={38} />
      <Text style={s.value}>{value}</Text>
      <Text style={theme.font.caption}>{label}</Text>
    </View>
  );
}

export default function Home() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { profile, plan } = useAppState();
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    headerText: { flex: 1 },
    date: { ...th.font.caption, textTransform: 'capitalize', fontWeight: '600' },
    greeting: { ...th.font.title, fontSize: 24 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontWeight: '800', fontSize: 18 },
    hero: {
      borderRadius: th.radius.xl,
      padding: th.spacing.lg,
      alignItems: 'center',
      gap: th.spacing.md,
    },
    heroTitle: { color: 'rgba(255,255,255,0.9)', fontWeight: '700', fontSize: 15 },
    heroStats: { flexDirection: 'row', alignSelf: 'stretch' },
    heroStat: { flex: 1, alignItems: 'center', gap: 2 },
    heroDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
    heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
    heroValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
    sectionTitle: { ...th.font.heading, fontSize: 19, marginTop: th.spacing.sm },
    tiles: { flexDirection: 'row', gap: th.spacing.sm },
    tip: {
      flexDirection: 'row',
      gap: th.spacing.md,
      padding: th.spacing.md + 2,
      borderRadius: th.radius.lg,
      alignItems: 'flex-start',
    },
    tipTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, marginBottom: 4 },
    tipText: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 21 },
  }));

  if (!profile || !plan) return null;

  // Jurnalul alimentar va fi implementat in pagina „Calorii”; deocamdata nu exista inregistrari.
  const consumed = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const now = new Date();
  const date = now.toLocaleDateString(language === 'ro' ? 'ro-RO' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <View style={s.headerText}>
            <Text style={s.date}>{date}</Text>
            <Text style={s.greeting}>{t(greetingKey(now.getHours()), { name: profile.name })}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/more')}>
            <LinearGradient colors={theme.gradients.warm} style={s.avatar}>
              <Text style={s.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
            </LinearGradient>
          </Pressable>
        </View>

        <LinearGradient
          colors={theme.gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <Text style={s.heroTitle}>{t('home.dailyGoal', { kcal: plan.targetCalories })}</Text>
          <CalorieRing
            consumed={consumed.kcal}
            target={plan.targetCalories}
            label={`kcal ${t('home.remaining')}`}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.25)"
            textColor="#FFFFFF"
            mutedColor="rgba(255,255,255,0.8)"
          />
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroLabel}>{t('home.consumed')}</Text>
              <Text style={s.heroValue}>{consumed.kcal}</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <Text style={s.heroLabel}>{t('home.target')}</Text>
              <Text style={s.heroValue}>{plan.targetCalories}</Text>
            </View>
          </View>
        </LinearGradient>

        <Card title={t('home.macros')} icon="pie-chart">
          <MacroBar
            label={t('onboarding.summary.protein')}
            value={consumed.proteinG}
            target={plan.macros.proteinG}
            color={theme.colors.protein}
          />
          <MacroBar
            label={t('onboarding.summary.carbs')}
            value={consumed.carbsG}
            target={plan.macros.carbsG}
            color={theme.colors.carbs}
          />
          <MacroBar
            label={t('onboarding.summary.fat')}
            value={consumed.fatG}
            target={plan.macros.fatG}
            color={theme.colors.fat}
          />
        </Card>

        <Text style={s.sectionTitle}>{t('home.activity')}</Text>
        <View style={s.tiles}>
          <StatTile
            icon="footsteps"
            label={t('home.steps')}
            value="–"
            color={theme.colors.info}
            background={theme.colors.infoSoft}
          />
          <StatTile
            icon="flame"
            label={t('home.burned')}
            value="–"
            color={theme.colors.accent}
            background={theme.colors.accentSoft}
          />
          <StatTile
            icon="time"
            label={t('home.activeMinutes')}
            value="–"
            color={theme.colors.primary}
            background={theme.colors.primarySoft}
          />
        </View>
        <Text style={theme.font.caption}>{t('home.activityHint')}</Text>

        <LinearGradient
          colors={theme.gradients.warm}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.tip}
        >
          <IconCircle icon="bulb" color="#FFFFFF" background="rgba(255,255,255,0.2)" />
          <View style={{ flex: 1 }}>
            <Text style={s.tipTitle}>{t('home.tipTitle')}</Text>
            <Text style={s.tipText}>{t(`home.tips.${profile.goal}`)}</Text>
          </View>
        </LinearGradient>

        <Notice tone="info">{t('common.disclaimer')}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}
