import { Ionicons } from '@expo/vector-icons';
import { getRecipe, type MealSlot, type PlannedMeal } from '@movemeal/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import { useToast } from '@/components/toast';
import { IconCircle, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

/** Cel putin trei alternative pentru o masa din plan. */
export default function MealSwap() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { program, replaceMeal } = useNutrition();
  const params = useLocalSearchParams<{ weekday: string; slot: string }>();
  const weekday = Number(params.weekday);
  const slot = params.slot as MealSlot;
  const [options, setOptions] = useState<PlannedMeal[] | null>(null);
  const [error, setError] = useState(false);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    title: { ...th.font.title, flex: 1, fontSize: 22 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    current: { borderWidth: 2, borderColor: th.colors.primary },
  }));

  useEffect(() => {
    if (!session) return;
    api
      .mealAlternatives(session.token, weekday, slot)
      .then(setOptions)
      .catch(() => setError(true));
  }, [session, weekday, slot]);

  const current = program?.plan.days
    .find((d) => d.weekday === weekday)
    ?.meals.find((m) => m.slot === slot);

  function row(meal: PlannedMeal, isCurrent: boolean) {
    const recipe = getRecipe(meal.recipeId);
    if (!recipe) return null;
    return (
      <Pressable
        key={meal.recipeId}
        accessibilityRole="button"
        disabled={isCurrent}
        style={[s.option, isCurrent && s.current]}
        onPress={async () => {
          await replaceMeal(weekday, slot, meal.recipeId);
          toast(recipe.name[language]);
          router.back();
        }}
      >
        <IconCircle
          icon="restaurant"
          color={theme.colors.accent}
          background={theme.colors.accentSoft}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={theme.font.heading}>{recipe.name[language]}</Text>
          <Text style={theme.font.caption}>
            {meal.nutrients.kcal} kcal · P {Math.round(meal.nutrients.protein)} g ·{' '}
            {t('nutrition.minutes', { n: recipe.minutes })}
          </Text>
        </View>
        {isCurrent ? (
          <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
        ) : (
          <Ionicons name="swap-horizontal" size={20} color={theme.colors.textMuted} />
        )}
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" style={s.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('nutrition.alternativesTitle')}</Text>
        </View>
        <Text style={theme.font.caption}>
          {t(`workout.weekdays.${weekday}`)} · {t(`nutrition.slots.${slot}`)}
        </Text>
        {current ? row(current, true) : null}
        {error ? <Notice>{t('errors.network')}</Notice> : null}
        {!options && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {options?.map((m) => row(m, false))}
      </ScrollView>
    </SafeAreaView>
  );
}
