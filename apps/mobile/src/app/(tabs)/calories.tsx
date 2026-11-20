import { Ionicons } from '@expo/vector-icons';
import { foodName, getFood, getRecipe, recipeName } from '@movemeal/shared';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type FoodLogEntry, type LogMeal } from '@/api/client';
import { errorKey } from '@/api/errors';
import { CloseDaySheet, QuickActions, SaveMealSheet } from '@/components/quick-log';
import { ActionSheet } from '@/components/social';
import { CalorieRing } from '@/components/calorie-ring';
import { NutrientBar } from '@/components/nutrient-bar';
import { useToast } from '@/components/toast';
import { Card } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isoDate } from '@/state/dates';
import { sumEntries, useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';
import { MenuButton } from '@/components/app-menu';

/** Denumirea din catalog in limba aleasa; textul salvat pe server ramane rezerva. */
function entryName(
  e: FoodLogEntry,
  language: 'ro' | 'en' | 'ru',
  t: (key: string) => string,
): string {
  if (e.source === 'quick') return e.name || t('quick.defaultName');
  if (e.source === 'photo' || e.source === 'product') return e.name;
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
  const { plan, session } = useAppState();
  const { log, loadDay, deleteEntry, appendEntries } = useNutrition();
  const [offset, setOffset] = useState(0);
  const date = useMemo(() => shiftDays(new Date(), -offset), [offset]);
  const day = isoDate(date);
  const previousDay = isoDate(shiftDays(date, -1));
  const today = isoDate(new Date());
  const entries = log[day];
  const [menuMeal, setMenuMeal] = useState<LogMeal | null>(null);
  const [saveMeal, setSaveMeal] = useState<LogMeal | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [copying, setCopying] = useState(false);

  /** Copiaza o masa sau toata ziua; inregistrarile noi apar imediat in jurnal. */
  async function copy(body: { fromDay: string; toDay: string; fromMeal?: LogMeal }) {
    if (!session) return;
    setCopying(true);
    try {
      const copied = await api.copyLog(session.token, body);
      appendEntries(copied);
      toast(t('quick.copied', { n: copied.length }));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setCopying(false);
    }
  }

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
    emptyDay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.surfaceAlt,
    },
    copyButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.primary,
    },
    copyText: { color: th.colors.onPrimary, fontWeight: '800', fontSize: 13 },
    closeDay: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.primary,
    },
    closeTitle: { color: th.colors.onPrimary, fontWeight: '800', fontSize: 16 },
    closeHint: { color: th.colors.onPrimary, opacity: 0.85, fontSize: 13 },
  }));

  if (!plan) return null;
  const totals = sumEntries(entries);
  const mealEntries = (meal: LogMeal) => (entries ?? []).filter((e) => e.meal === meal);
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
      t('journal.deleteConfirm', { name: entryName(entry, language, t) }),
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
          <MenuButton />
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

        <QuickActions
          actions={[
            {
              key: 'photo',
              icon: 'camera-outline',
              label: t('quick.photo'),
              hint: t('journal.photoHint'),
              onPress: () => router.push({ pathname: '/food-photo', params: { day } }),
            },
            {
              key: 'describe',
              icon: 'chatbubble-ellipses-outline',
              label: t('quick.describe'),
              hint: t('quick.describeHint'),
              onPress: () =>
                router.push({ pathname: '/food-photo', params: { day, mode: 'text' } }),
            },
          ]}
        />

        {entries && entries.length === 0 && offset < EDITABLE_DAYS - 1 ? (
          <View style={s.emptyDay}>
            <Ionicons name="copy-outline" size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={theme.font.heading}>{t('quick.emptyDayTitle')}</Text>
              <Text style={theme.font.caption}>{t('quick.emptyDayHint')}</Text>
            </View>
            {copying ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Pressable
                accessibilityRole="button"
                style={s.copyButton}
                onPress={() => copy({ fromDay: previousDay, toDay: day })}
              >
                <Text style={s.copyText}>{t('quick.copyDay')}</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {MEALS.map((meal) => {
          const items = (entries ?? []).filter((e) => e.meal === meal);
          const kcal = Math.round(sumEntries(items).kcal);
          return (
            <Card key={meal}>
              <View style={s.sectionHead}>
                <Text style={[theme.font.heading, { flex: 1 }]}>{t(`journal.meals.${meal}`)}</Text>
                <Text style={s.sectionKcal}>
                  {kcal} {t('common.kcal')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('quick.mealOptions')}
                  hitSlop={10}
                  onPress={() => setMenuMeal(meal)}
                  style={{ paddingLeft: 8 }}
                >
                  <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </View>
              {items.map((e) => (
                <View key={e.id} style={s.entry}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.entryName}>{entryName(e, language, t)}</Text>
                    {e.source === 'quick' ? (
                      // Calorii introduse direct: fara cantitate, macronutrientii doar daca exista.
                      <Text style={theme.font.caption}>
                        {Math.round(e.kcal)} {t('common.kcal')}
                        {e.protein > 0
                          ? ` · ${t('common.proteinShort')} ${Math.round(e.protein)} ${t('common.g')}`
                          : ''}
                        {' · '}
                        {t('quick.quickTag')}
                      </Text>
                    ) : (
                      <Text style={theme.font.caption}>
                        {e.unit === 'g'
                          ? `${Math.round(e.amount)} ${t('common.g')}`
                          : e.amount === 1
                            ? t('nutrition.portion')
                            : t('nutrition.portions', {
                                n: String(e.amount).replace('.', ','),
                              })}{' '}
                        · {Math.round(e.kcal)} {t('common.kcal')} · {t('common.proteinShort')}{' '}
                        {Math.round(e.protein)} {t('common.g')}
                      </Text>
                    )}
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

        {entries && entries.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [s.closeDay, pressed && { opacity: 0.9 }]}
            onPress={() => setCloseOpen(true)}
          >
            <Ionicons name="flag-outline" size={22} color={theme.colors.onPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={s.closeTitle}>{t('quick.closeDay')}</Text>
              <Text style={s.closeHint}>{t('quick.closeDayHint')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.onPrimary} />
          </Pressable>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={menuMeal !== null}
        title={menuMeal ? t(`journal.meals.${menuMeal}`) : undefined}
        onClose={() => setMenuMeal(null)}
        options={
          menuMeal
            ? [
                ...(offset < EDITABLE_DAYS - 1
                  ? [
                      {
                        label: t('quick.copyFromPrevious'),
                        icon: 'arrow-undo-outline' as const,
                        onPress: () =>
                          copy({ fromDay: previousDay, toDay: day, fromMeal: menuMeal }),
                      },
                    ]
                  : []),
                ...(mealEntries(menuMeal).length && day !== today
                  ? [
                      {
                        label: t('quick.copyToToday'),
                        icon: 'today-outline' as const,
                        onPress: () => copy({ fromDay: day, toDay: today, fromMeal: menuMeal }),
                      },
                    ]
                  : []),
                ...(mealEntries(menuMeal).length
                  ? [
                      {
                        label: t('quick.saveAsMeal'),
                        icon: 'bookmark-outline' as const,
                        onPress: () => setSaveMeal(menuMeal),
                      },
                    ]
                  : []),
              ]
            : []
        }
      />

      <SaveMealSheet
        visible={saveMeal !== null}
        entries={saveMeal ? mealEntries(saveMeal) : []}
        defaultName={saveMeal ? t(`journal.meals.${saveMeal}`) : ''}
        onClose={() => setSaveMeal(null)}
      />

      <CloseDaySheet
        visible={closeOpen}
        entries={entries ?? []}
        onClose={() => setCloseOpen(false)}
      />
    </SafeAreaView>
  );
}
