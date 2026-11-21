import { getRecipe, recipeName } from '@movemeal/shared';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CalorieRing } from '@/components/calorie-ring';
import { Card, IconCircle, Notice, type IconName } from '@/components/ui';
import { formatNumber, localeOf, useI18n } from '@/i18n';
import { StepsSheet } from '@/components/steps';
import { api, type ActivityDay, type Appointment, type ProgressResponse } from '@/api/client';
import { useAppState } from '@/state/app-state';
import { formatDay, isoDate, weekdayOf } from '@/state/dates';
import { SLOT_TO_LOG, sumEntries, useNutrition } from '@/state/nutrition-state';
import { isDone, useWorkout } from '@/state/workout-state';
import { useStyles, useTheme } from '@/theme';
import { MenuButton } from '@/components/app-menu';

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
  unit,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  unit: string;
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
          {value} / {target} {unit}
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
  onPress,
}: {
  icon: IconName;
  label: string;
  value: string;
  color: string;
  background: string;
  onPress?: () => void;
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
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.tile, pressed && { opacity: 0.85 }]}
    >
      <IconCircle icon={icon} color={color} background={background} size={38} />
      <Text style={s.value}>{value}</Text>
      <Text style={theme.font.caption}>{label}</Text>
    </Pressable>
  );
}

export default function Home() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { profile, plan, session, targetSource } = useAppState();
  const { program: nutrition, log, waterToday, addWater } = useNutrition();
  const { program: workout, done } = useWorkout();
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [nextConsultation, setNextConsultation] = useState<Appointment | null>(null);
  /** Pasii de azi (null = inca neintrodusi). */
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  /** Arderea zilei (activitati, pasi, antrenament). */
  const [activity, setActivity] = useState<ActivityDay | null>(null);

  // Ajustarea propusa (daca exista) se reincarca la fiecare intoarcere pe pagina.
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      const today = isoDate(new Date());
      api
        .steps(session.token, 1)
        .then((days) => setStepsToday(days.find((d) => d.day === today)?.steps ?? null))
        .catch(() => undefined);
      api
        .activity(session.token, today)
        .then(setActivity)
        .catch(() => undefined);
      api
        .progress(session.token)
        .then(setProgress)
        .catch(() => undefined);
      api
        .appointments(session.token)
        .then((list) =>
          setNextConsultation(
            list
              .filter((a) => !a.past && (a.status === 'confirmed' || a.status === 'requested'))
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null,
          ),
        )
        .catch(() => undefined);
    }, [session]),
  );
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
    mealRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    waterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    waterTrack: { height: 10, borderRadius: 5, backgroundColor: th.colors.surfaceAlt },
    waterFill: { height: 10, borderRadius: 5, backgroundColor: th.colors.info },
    waterButton: {
      paddingHorizontal: 14,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      backgroundColor: th.colors.infoSoft,
    },
    waterButtonText: { color: th.colors.info, fontWeight: '800', textAlign: 'center' },
    waterButtons: { flexDirection: 'row', gap: th.spacing.sm },
    waterButtonMinus: { flex: 1, backgroundColor: th.colors.surfaceAlt },
    waterButtonMinusText: { color: th.colors.textMuted },
    progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  }));

  if (!profile || !plan) return null;

  const now = new Date();
  const today = isoDate(now);
  const todayEntries = log[today] ?? [];
  const totals = sumEntries(todayEntries);
  const consumed = {
    kcal: Math.round(totals.kcal),
    proteinG: Math.round(totals.protein),
    carbsG: Math.round(totals.carbs),
    fatG: Math.round(totals.fat),
  };
  const weekday = weekdayOf(now);
  const todaySession = workout?.plan.sessions.find((x) => x.weekday === weekday);
  const workoutDone = todaySession
    ? todaySession.exercises.filter((p) => isDone(done, today, p.exerciseId)).length
    : 0;
  const todayMeals = nutrition?.plan.days.find((d) => d.weekday === weekday)?.meals ?? [];
  const waterGoal = 2000;
  const date = now.toLocaleDateString(localeOf(language), {
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
          <MenuButton />
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
            label={`${t('common.kcal')} ${t('home.remaining')}`}
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

        {targetSource.adjustedBy === 'nutritionist' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/nutritionist')}>
            <Card title={t('consult.adjustedHome')} icon="medkit-outline">
              {targetSource.nutritionistNote ? (
                <Text style={theme.font.body}>{targetSource.nutritionistNote}</Text>
              ) : null}
            </Card>
          </Pressable>
        ) : null}

        {nextConsultation ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/nutritionist')}>
            <Card title={t('consult.nextConsultation')} icon="calendar-outline">
              <Text style={theme.font.body}>
                {t('consult.when', {
                  day: formatDay(nextConsultation.day, localeOf(language), true),
                  time: nextConsultation.time,
                })}{' '}
                · {t(`consult.status.${nextConsultation.status}`)}
              </Text>
            </Card>
          </Pressable>
        ) : null}

        {progress?.analysis.status === 'adjust' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/progress')}>
            <Notice tone="info">
              {t('progress.proposal', {
                rate: String(progress.analysis.weeklyChangePct).replace('.', ','),
                from: progress.analysis.currentTarget,
                to: progress.analysis.proposedTarget,
              })}
            </Notice>
          </Pressable>
        ) : null}

        <Card title={t('home.macros')} icon="pie-chart">
          <MacroBar
            unit={t('common.g')}
            label={t('onboarding.summary.protein')}
            value={consumed.proteinG}
            target={plan.macros.proteinG}
            color={theme.colors.protein}
          />
          <MacroBar
            unit={t('common.g')}
            label={t('onboarding.summary.carbs')}
            value={consumed.carbsG}
            target={plan.macros.carbsG}
            color={theme.colors.carbs}
          />
          <MacroBar
            unit={t('common.g')}
            label={t('onboarding.summary.fat')}
            value={consumed.fatG}
            target={plan.macros.fatG}
            color={theme.colors.fat}
          />
        </Card>

        <Card title={t('workout.title')} icon="barbell">
          <Pressable accessibilityRole="button" onPress={() => router.push('/workout')}>
            {todaySession ? (
              <>
                <Text style={theme.font.heading}>
                  {t(`workout.templates.${todaySession.template}`)}
                </Text>
                <Text style={theme.font.caption}>
                  {t('workout.progress', {
                    done: workoutDone,
                    total: todaySession.exercises.length,
                  })}
                </Text>
              </>
            ) : (
              <Text style={theme.font.body}>
                {workout ? t('workout.restDay') : t('workout.create')}
              </Text>
            )}
          </Pressable>
        </Card>

        <Card title={t('nutrition.title')} icon="restaurant">
          {todayMeals.length ? (
            todayMeals.map((m) => {
              const recipe = getRecipe(m.recipeId);
              const eaten = todayEntries.some(
                (e) =>
                  e.source === 'recipe' && e.refId === m.recipeId && e.meal === SLOT_TO_LOG[m.slot],
              );
              return (
                <Pressable
                  key={m.slot}
                  accessibilityRole="button"
                  onPress={() => router.push('/meals')}
                  style={s.mealRow}
                >
                  <IconCircle
                    icon={eaten ? 'checkmark' : 'ellipse-outline'}
                    size={28}
                    color={eaten ? theme.colors.onPrimary : theme.colors.textMuted}
                    background={eaten ? theme.colors.primary : theme.colors.surfaceAlt}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={theme.font.caption}>{t(`nutrition.slots.${m.slot}`)}</Text>
                    <Text style={theme.font.body}>
                      {recipe ? recipeName(recipe, language) : ''}
                    </Text>
                  </View>
                  <Text style={theme.font.caption}>
                    {m.nutrients.kcal} {t('common.kcal')}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.push('/meals')}>
              <Text style={theme.font.body}>{t('nutrition.emptyTitle')}</Text>
            </Pressable>
          )}
        </Card>

        <Card title={t('water.title')} icon="water">
          <View style={s.waterRow}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={theme.font.heading}>
                {waterToday} {t('common.ml')}{' '}
                <Text style={theme.font.caption}>{t('water.goal', { goal: waterGoal })}</Text>
              </Text>
              <View style={s.waterTrack}>
                <View
                  style={[
                    s.waterFill,
                    { width: `${Math.min(100, (waterToday / waterGoal) * 100)}%` },
                  ]}
                />
              </View>
            </View>
          </View>
          <View style={s.waterButtons}>
            {/* −250 ml corecteaza o apasare din greseala; valoarea nu coboara sub 0. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('water.remove')}
              disabled={waterToday === 0}
              onPress={() => addWater(-250)}
              style={[s.waterButton, s.waterButtonMinus, waterToday === 0 && { opacity: 0.4 }]}
            >
              <Text style={[s.waterButtonText, s.waterButtonMinusText]}>{t('water.remove')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('water.add')}
              onPress={() => addWater(250)}
              style={[s.waterButton, { flex: 1 }]}
            >
              <Text style={s.waterButtonText}>{t('water.add')}</Text>
            </Pressable>
          </View>
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/progress')}
          style={s.progressRow}
        >
          <IconCircle
            icon="stats-chart"
            color={theme.colors.primary}
            background={theme.colors.primarySoft}
          />
          <Text style={[theme.font.heading, { flex: 1 }]}>{t('progress.open')}</Text>
          <IconCircle
            icon="chevron-forward"
            color={theme.colors.textMuted}
            background="transparent"
            size={28}
          />
        </Pressable>

        <Text style={s.sectionTitle}>{t('home.activity')}</Text>
        <View style={s.tiles}>
          <StatTile
            icon="footsteps"
            label={t('home.steps')}
            value={stepsToday === null ? t('steps.add') : formatNumber(stepsToday, language, 0)}
            onPress={() => setStepsOpen(true)}
            color={theme.colors.info}
            background={theme.colors.infoSoft}
          />
          <StatTile
            icon="flame"
            label={
              activity?.goalKcal
                ? t('home.burnedOfGoal', { goal: activity.goalKcal })
                : t('home.burned')
            }
            value={activity ? `${activity.totalKcal}` : '–'}
            onPress={() => router.push('/activity')}
            color={theme.colors.accent}
            background={theme.colors.accentSoft}
          />
          <StatTile
            icon="time"
            label={t('home.activeMinutes')}
            value={activity ? `${activity.items.reduce((sum, i) => sum + i.minutes, 0)}` : '–'}
            onPress={() => router.push('/activity')}
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
      <StepsSheet
        visible={stepsOpen}
        onClose={() => setStepsOpen(false)}
        onSaved={(steps) => {
          setStepsToday(steps);
          if (session)
            api
              .activity(session.token)
              .then(setActivity)
              .catch(() => undefined);
        }}
      />
    </SafeAreaView>
  );
}
