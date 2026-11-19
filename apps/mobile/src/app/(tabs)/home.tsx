import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieRing } from '@/components/calorie-ring';
import { Card, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { colors, font, radius, spacing } from '@/theme';

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
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={styles.macro}>
      <View style={styles.macroHead}>
        <Text style={font.body}>{label}</Text>
        <Text style={font.caption}>
          {value} / {target} g
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={colors.accent} />
      <Text style={font.heading}>{value}</Text>
      <Text style={font.caption}>{label}</Text>
    </View>
  );
}

export default function Home() {
  const { t } = useI18n();
  const { profile, plan } = useAppState();
  if (!profile || !plan) return null;

  // Jurnalul alimentar va fi implementat in pagina „Calorii”; deocamdata nu exista inregistrari.
  const consumed = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={font.title}>
            {t(greetingKey(new Date().getHours()), { name: profile.name })}
          </Text>
          <Text style={[font.body, styles.muted]}>
            {t('home.dailyGoal', { kcal: plan.targetCalories })}
          </Text>
        </View>

        <Card>
          <View style={styles.ringRow}>
            <CalorieRing
              consumed={consumed.kcal}
              target={plan.targetCalories}
              remainingLabel={t('home.remaining')}
            />
          </View>
          <View style={styles.ringLegend}>
            <View style={styles.legendItem}>
              <Text style={font.caption}>{t('home.consumed')}</Text>
              <Text style={font.heading}>{consumed.kcal} kcal</Text>
            </View>
            <View style={styles.legendItem}>
              <Text style={font.caption}>{t('home.target')}</Text>
              <Text style={font.heading}>{plan.targetCalories} kcal</Text>
            </View>
          </View>
        </Card>

        <Card title={t('home.macros')}>
          <MacroBar
            label={t('onboarding.summary.protein')}
            value={consumed.proteinG}
            target={plan.macros.proteinG}
            color={colors.protein}
          />
          <MacroBar
            label={t('onboarding.summary.carbs')}
            value={consumed.carbsG}
            target={plan.macros.carbsG}
            color={colors.carbs}
          />
          <MacroBar
            label={t('onboarding.summary.fat')}
            value={consumed.fatG}
            target={plan.macros.fatG}
            color={colors.fat}
          />
        </Card>

        <Card title={t('home.activity')}>
          <View style={styles.stats}>
            <Stat icon="footsteps-outline" label={t('home.steps')} value="–" />
            <Stat icon="flame-outline" label={t('home.burned')} value="–" />
            <Stat icon="time-outline" label={t('home.activeMinutes')} value="–" />
          </View>
          <Text style={font.caption}>{t('home.activityHint')}</Text>
        </Card>

        <View style={styles.tip}>
          <Ionicons name="bulb-outline" size={22} color={colors.primaryDark} />
          <View style={styles.flex}>
            <Text style={[font.heading, { color: colors.primaryDark }]}>{t('home.tipTitle')}</Text>
            <Text style={font.body}>{t(`home.tips.${profile.goal}`)}</Text>
          </View>
        </View>

        <Notice tone="info">{t('common.disclaimer')}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  muted: { color: colors.textMuted, marginTop: spacing.xs },
  ringRow: { alignItems: 'center', paddingVertical: spacing.sm },
  ringLegend: { flexDirection: 'row', justifyContent: 'space-around' },
  legendItem: { alignItems: 'center' },
  macro: { gap: spacing.xs },
  macroHead: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.border },
  fill: { height: 8, borderRadius: radius.pill },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1, gap: 2 },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
});
