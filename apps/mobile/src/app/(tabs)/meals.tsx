import { Ionicons } from '@expo/vector-icons';
import { getRecipe, type PlannedMeal, type Weekday, recipeName } from '@movemeal/shared';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '@/components/toast';
import { Button, IconCircle, Notice } from '@/components/ui';
import { WeekStrip } from '@/components/week-strip';
import { useI18n } from '@/i18n';
import { currentWeek, isoDate, weekdayOf } from '@/state/dates';
import { SLOT_TO_LOG, useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';
import { MenuButton } from '@/components/app-menu';

function portionsLabel(t: (k: string, p?: Record<string, string | number>) => string, n: number) {
  return n === 1
    ? t('nutrition.portion')
    : t('nutrition.portions', { n: String(n).replace('.', ',') });
}

export default function Meals() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { status, program, log, loadDay, eatPlanned, regenerate, reload } = useNutrition();
  const week = useMemo(() => currentWeek(), []);
  const [selected, setSelected] = useState<Weekday>(weekdayOf(new Date()));
  const [busy, setBusy] = useState(false);
  const selectedDate = isoDate(week[selected]);

  // Jurnalul zilei selectate (pentru starea „Mancat” a meselor).
  useEffect(() => {
    if (program && !log[selectedDate] && selectedDate <= isoDate(new Date())) {
      loadDay(selectedDate).catch(() => undefined);
    }
  }, [program, log, selectedDate, loadDay]);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    title: { ...th.font.title, flex: 1 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    total: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: 4 },
    totalLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
    totalValue: { color: '#FFFFFF', fontSize: 32, fontWeight: '900' },
    totalMacros: { color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
    adjusted: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
    meal: {
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.lg,
      padding: th.spacing.md,
      gap: th.spacing.sm,
      borderWidth: th.scheme === 'dark' ? 1 : 0,
      borderColor: th.colors.border,
      ...th.elevation,
    },
    mealTop: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    slot: { ...th.font.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    name: { ...th.font.heading },
    meta: { ...th.font.caption },
    actions: { flexDirection: 'row', gap: th.spacing.sm },
    action: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      height: 40,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.surfaceAlt,
    },
    actionDone: { backgroundColor: th.colors.primarySoft },
    actionText: { fontWeight: '700', color: th.colors.text },
    empty: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: th.spacing.md },
    emptyTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 22 },
    emptyText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 21 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  }));

  if (status === 'idle' || status === 'loading') {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const header = (
    <View style={s.header}>
      <Text style={s.title}>{t('nutrition.title')}</Text>
      {program ? (
        <>
          <Pressable
            accessibilityLabel={t('nutrition.shopping')}
            style={s.iconButton}
            onPress={() => router.push('/shopping-list')}
          >
            <Ionicons name="cart-outline" size={20} color={theme.colors.primary} />
          </Pressable>
          <Pressable
            accessibilityLabel={t('nutrition.edit')}
            style={s.iconButton}
            onPress={() => router.push('/nutrition-setup')}
          >
            <Ionicons name="options-outline" size={20} color={theme.colors.primary} />
          </Pressable>
        </>
      ) : null}
      <MenuButton />
    </View>
  );

  if (status === 'error') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={s.content}>
          {header}
          <Notice>{t('errors.network')}</Notice>
          <Button title={t('common.retry')} icon="refresh" variant="secondary" onPress={reload} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={s.content}>
          {header}
          <LinearGradient
            colors={theme.gradients.warm}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.empty}
          >
            <IconCircle
              icon="nutrition"
              color="#FFFFFF"
              background="rgba(255,255,255,0.2)"
              size={56}
            />
            <Text style={s.emptyTitle}>{t('nutrition.emptyTitle')}</Text>
            <Text style={s.emptyText}>{t('nutrition.emptyText')}</Text>
          </LinearGradient>
          <Button
            title={t('nutrition.start')}
            icon="sparkles"
            onPress={() => router.push('/nutrition-setup')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const day = program.plan.days.find((d) => d.weekday === selected);
  const date = isoDate(week[selected]);
  const todayIso = isoDate(new Date());
  const logged = log[date] ?? [];
  const isEaten = (m: PlannedMeal) =>
    logged.some(
      (e) => e.source === 'recipe' && e.refId === m.recipeId && e.meal === SLOT_TO_LOG[m.slot],
    );

  async function onEat(meal: PlannedMeal) {
    try {
      await eatPlanned(date, meal.slot);
      toast(t('journal.added'));
    } catch {
      toast(t('errors.unknown'));
    }
  }

  function onRegenerate(weekday?: number) {
    const what = weekday === undefined ? t('nutrition.wholeWeek') : t('nutrition.thisDay');
    // Regenerarea inlocuieste planul: se cere confirmarea explicita.
    Alert.alert(t('nutrition.title'), t('nutrition.regenerateConfirm', { what }), [
      { text: t('journal.cancel'), style: 'cancel' },
      {
        text: t('common.continue'),
        onPress: async () => {
          setBusy(true);
          try {
            await regenerate(weekday);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        {header}
        <WeekStrip week={week} selected={selected} onSelect={setSelected} />

        {day ? (
          <>
            <LinearGradient
              colors={theme.gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.total}
            >
              <Text style={s.totalLabel}>
                {t(`workout.weekdays.${selected}`)} · {t('nutrition.dayTotal')}
              </Text>
              <Text style={s.totalValue}>
                {day.totals.kcal} {t('common.kcal')}
              </Text>
              {program.adjustedByNutritionistAt ? (
                <Text style={s.adjusted}>✓ {t('consult.adjustedBadge')}</Text>
              ) : null}
              <Text style={s.totalMacros}>
                {t('nutrition.target', { kcal: program.plan.targetKcal })} ·{' '}
                {t('common.proteinShort')} {Math.round(day.totals.protein)} {t('common.g')} ·{' '}
                {t('common.carbsShort')} {Math.round(day.totals.carbs)} {t('common.g')} ·{' '}
                {t('common.fatShort')} {Math.round(day.totals.fat)} {t('common.g')}
              </Text>
            </LinearGradient>

            {day.meals.map((meal) => {
              const recipe = getRecipe(meal.recipeId);
              if (!recipe) return null;
              const eaten = isEaten(meal);
              // „Mancat” se poate marca doar pentru zilele trecute sau de azi (jurnal pe 14 zile).
              const canEat = date <= todayIso;
              return (
                <View key={meal.slot} style={s.meal}>
                  <Pressable
                    style={s.mealTop}
                    onPress={() =>
                      router.push({
                        pathname: '/recipe/[id]',
                        params: {
                          id: meal.recipeId,
                          portions: String(meal.portions),
                          day: date,
                          slot: meal.slot,
                        },
                      })
                    }
                  >
                    <IconCircle
                      icon={
                        meal.slot === 'breakfast'
                          ? 'sunny'
                          : meal.slot.startsWith('snack')
                            ? 'cafe'
                            : 'restaurant'
                      }
                      color={theme.colors.accent}
                      background={theme.colors.accentSoft}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={s.slot}>{t(`nutrition.slots.${meal.slot}`)}</Text>
                      <Text style={s.name}>{recipeName(recipe, language)}</Text>
                      <Text style={s.meta}>
                        {portionsLabel(t, meal.portions)} · {meal.nutrients.kcal} {t('common.kcal')}{' '}
                        · {t('common.proteinShort')} {Math.round(meal.nutrients.protein)}{' '}
                        {t('common.g')} · {t('nutrition.minutes', { n: recipe.minutes })}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
                  </Pressable>
                  <View style={s.actions}>
                    <Pressable
                      accessibilityRole="button"
                      disabled={eaten || !canEat}
                      onPress={() => onEat(meal)}
                      style={[s.action, eaten && s.actionDone, !canEat && { opacity: 0.4 }]}
                    >
                      <Ionicons
                        name={eaten ? 'checkmark-circle' : 'checkmark'}
                        size={18}
                        color={eaten ? theme.colors.primaryStrong : theme.colors.text}
                      />
                      <Text style={[s.actionText, eaten && { color: theme.colors.primaryStrong }]}>
                        {eaten ? t('nutrition.eaten') : t('nutrition.eat')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        router.push({
                          pathname: '/meal-swap',
                          params: { weekday: String(selected), slot: meal.slot },
                        })
                      }
                      style={s.action}
                    >
                      <Ionicons name="swap-horizontal" size={18} color={theme.colors.text} />
                      <Text style={s.actionText}>{t('nutrition.swap')}</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}

            <Button
              title={t('nutrition.regenerateDay')}
              icon="refresh"
              variant="secondary"
              disabled={busy}
              onPress={() => onRegenerate(selected)}
            />
            <Button
              title={t('nutrition.regenerateWeek')}
              variant="ghost"
              disabled={busy}
              onPress={() => onRegenerate()}
            />
          </>
        ) : null}

        {program.plan.issues.map((issue) => (
          <Notice key={issue} tone="info">
            {t(`nutrition.issues.${issue}`)}
          </Notice>
        ))}
        <Notice tone="info">{t('common.disclaimer')}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}
