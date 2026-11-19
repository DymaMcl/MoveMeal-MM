import { Ionicons } from '@expo/vector-icons';
import { foodName, getFood, getRecipe, recipeName } from '@movemeal/shared';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { FoodLogEntry, LogMeal } from '@/api/client';
import { CalorieRing } from '@/components/calorie-ring';
import { NutrientBar } from '@/components/nutrient-bar';
import { useToast } from '@/components/toast';
import { Card } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isoDate } from '@/state/dates';
import { sumEntries, useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

/** Denumirea din catalog in limba aleasa; textul salvat pe server ramane rezerva. */
function entryName(e: FoodLogEntry, language: 'ro' | 'en' | 'ru'): string {
  if (e.source === 'food') {
    const food = getFood(e.refId);
    return food ? foodName(food, language) : e.name;
  }
  const recipe = getRecipe(e.refId);
  return recipe ? recipeName(recipe, language) : e.name;
}

const MEALS: LogMeal[] = ['breakfast', 'lunch', 'dinner', 'snack'];
/** Jurnalul poate fi completat sau corectat pentru ultimele 14 zile. */
const EDITABLE_DAYS = 14;

function shiftDays(date: Date, delta: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

export default function Calories() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { plan } = useAppState();
  const { log, loadDay, deleteEntry } = useNutrition();
  const [offset, setOffset] = useState(0);
  const date = useMemo(() => shiftDays(new Date(), -offset), [offset]);
  const day = isoDate(date);
  const entries = log[day];

  useEffect(() => {
    if (!entries) loadDay(day).catch(() => undefined);
  }, [day, entries, loadDay]);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    title: { ...th.font.title, flex: 1 },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    dayNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    dayLabel: { ...th.font.heading, textTransform: 'capitalize' },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.xl,
    },
    heroStat: { gap: 2 },
    heroLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 13 },
    heroValue: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
    sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionKcal: { ...th.font.caption, fontWeight: '700' },
    entry: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: th.colors.border,
    },
    entryName: { ...th.font.body, fontWeight: '600' },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    addText: { color: th.colors.primary, fontWeight: '700' },
    photo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: th.colors.primary,
      backgroundColor: th.colors.primarySoft,
    },
  }));

  if (!plan) return null;
  const totals = sumEntries(entries);
  const target = plan.targetCalories;
  const dayLabel =
    offset === 0
      ? t('journal.today')
      : offset === 1
        ? t('journal.yesterday')
        : date.toLocaleDateString(localeOf(language), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          });

  function confirmDelete(entry: FoodLogEntry) {
    Alert.alert(
      t('journal.title'),
      t('journal.deleteConfirm', { name: entryName(entry, language) }),
      [
        { text: t('journal.cancel'), style: 'cancel' },
        {
          text: t('journal.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry);
            toast(t('journal.delete') + ' ✓');
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.header}>
          <Text style={s.title}>{t('journal.title')}</Text>
        </View>

        <View style={s.dayNav}>
          <Pressable
            accessibilityRole="button"
            style={[s.round, offset >= EDITABLE_DAYS - 1 && { opacity: 0.3 }]}
            disabled={offset >= EDITABLE_DAYS - 1}
            onPress={() => setOffset((o) => o + 1)}
          >
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={s.dayLabel}>{dayLabel}</Text>
          <Pressable
            accessibilityRole="button"
            style={[s.round, offset === 0 && { opacity: 0.3 }]}
            disabled={offset === 0}
            onPress={() => setOffset((o) => o - 1)}
          >
            <Ionicons name="chevron-forward" size={20} color={theme.colors.text} />
          </Pressable>
        </View>

        <LinearGradient
          colors={theme.gradients.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <CalorieRing
            consumed={totals.kcal}
            target={target}
            size={120}
            stroke={10}
            label={`${t('common.kcal')} ${t('home.remaining')}`}
            color="#FFFFFF"
            trackColor="rgba(255,255,255,0.25)"
            textColor="#FFFFFF"
            mutedColor="rgba(255,255,255,0.8)"
          />
          <View style={{ gap: 10 }}>
            <View style={s.heroStat}>
              <Text style={s.heroLabel}>{t('journal.consumed')}</Text>
              <Text style={s.heroValue}>
                {Math.round(totals.kcal)} {t('common.kcal')}
              </Text>
            </View>
            <View style={s.heroStat}>
              <Text style={s.heroLabel}>{t('home.target')}</Text>
              <Text style={s.heroValue}>
                {target} {t('common.kcal')}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <Card title={t('home.macros')} icon="pie-chart">
          <NutrientBar
            label={t('onboarding.summary.protein')}
            value={totals.protein}
            target={plan.macros.proteinG}
            unit={t('common.g')}
            color={theme.colors.protein}
          />
          <NutrientBar
            label={t('onboarding.summary.carbs')}
            value={totals.carbs}
            target={plan.macros.carbsG}
            unit={t('common.g')}
            color={theme.colors.carbs}
          />
          <NutrientBar
            label={t('onboarding.summary.fat')}
            value={totals.fat}
            target={plan.macros.fatG}
            unit={t('common.g')}
            color={theme.colors.fat}
          />
        </Card>

        <Pressable
          accessibilityRole="button"
          style={s.photo}
          onPress={() => Alert.alert(t('journal.photo'), t('journal.photoSoon'))}
        >
          <Ionicons name="camera" size={28} color={theme.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[theme.font.heading, { color: theme.colors.primaryStrong }]}>
              {t('journal.photo')}
            </Text>
            <Text style={theme.font.caption}>{t('journal.photoSoon')}</Text>
          </View>
        </Pressable>

        {MEALS.map((meal) => {
          const items = (entries ?? []).filter((e) => e.meal === meal);
          const kcal = Math.round(sumEntries(items).kcal);
          return (
            <Card key={meal}>
              <View style={s.sectionHead}>
                <Text style={theme.font.heading}>{t(`journal.meals.${meal}`)}</Text>
                <Text style={s.sectionKcal}>
                  {kcal} {t('common.kcal')}
                </Text>
              </View>
              {items.map((e) => (
                <View key={e.id} style={s.entry}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryName}>{entryName(e, language)}</Text>
                    <Text style={theme.font.caption}>
                      {e.unit === 'g'
                        ? `${Math.round(e.amount)} ${t('common.g')}`
                        : e.amount === 1
                          ? t('nutrition.portion')
                          : t('nutrition.portions', { n: String(e.amount).replace('.', ',') })}{' '}
                      · {Math.round(e.kcal)} {t('common.kcal')} · {t('common.proteinShort')}{' '}
                      {Math.round(e.protein)} {t('common.g')}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('journal.delete')}
                    hitSlop={10}
                    onPress={() => confirmDelete(e)}
                  >
                    <Ionicons name="trash-outline" size={20} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                style={s.add}
                onPress={() => router.push({ pathname: '/food-search', params: { day, meal } })}
              >
                <Ionicons name="add-circle" size={22} color={theme.colors.primary} />
                <Text style={s.addText}>{t('journal.add')}</Text>
              </Pressable>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
