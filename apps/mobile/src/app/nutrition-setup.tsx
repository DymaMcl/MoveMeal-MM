import {
  ALLERGENS,
  FOODS,
  normalize,
  type Allergen,
  type Budget,
  type Diet,
  type NutritionPreferences,
  foodName,
} from '@movemeal/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ApiError } from '@/api/client';
import { errorKey } from '@/api/errors';
import { Chips } from '@/components/chips';
import { useToast } from '@/components/toast';
import {
  Button,
  Field,
  Notice,
  OptionCard,
  Screen,
  StepIndicator,
  Subtitle,
  Title,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

type Step = 'diet' | 'allergens' | 'foods' | 'budget' | 'meals';
const STEPS: Step[] = ['diet', 'allergens', 'foods', 'budget', 'meals'];
const DIETS: Diet[] = ['omnivore', 'pescatarian', 'vegetarian', 'vegan'];
const BUDGETS: Budget[] = ['economic', 'balanced', 'flexible'];

export default function NutritionSetup() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { program, savePreferences } = useNutrition();
  const initial = program?.preferences;

  const [diet, setDiet] = useState<Diet>(initial?.diet ?? 'omnivore');
  const [allergens, setAllergens] = useState<Allergen[]>(initial?.allergens ?? []);
  const [excluded, setExcluded] = useState<string[]>(initial?.excludedFoods ?? []);
  const [preferred, setPreferred] = useState<string[]>(initial?.preferredFoods ?? []);
  const [budget, setBudget] = useState<Budget>(initial?.budget ?? 'balanced');
  const [meals, setMeals] = useState<3 | 4 | 5>(initial?.mealsPerDay ?? 3);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useStyles((th) => ({
    foods: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    food: {
      paddingHorizontal: 14,
      minHeight: 40,
      justifyContent: 'center',
      borderRadius: th.radius.pill,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    excluded: { borderColor: th.colors.danger, backgroundColor: th.colors.warningSoft },
    preferred: { borderColor: th.colors.primary, backgroundColor: th.colors.primarySoft },
    foodText: { fontWeight: '600', color: th.colors.text },
    legend: { flexDirection: 'row', gap: th.spacing.md },
  }));

  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  const visibleFoods = useMemo(() => {
    const q = normalize(query);
    return FOODS.filter(
      (f) => !q || normalize(f.name.ro).includes(q) || normalize(f.name.en).includes(q),
    ).sort((a, b) => foodName(a, language).localeCompare(foodName(b, language), language));
  }, [query, language]);

  /** Exclus → preferat → neutru. */
  function cycleFood(id: string) {
    if (excluded.includes(id)) {
      setExcluded((p) => p.filter((x) => x !== id));
      setPreferred((p) => [...p, id]);
    } else if (preferred.includes(id)) {
      setPreferred((p) => p.filter((x) => x !== id));
    } else {
      setExcluded((p) => [...p, id]);
    }
  }

  async function onNext() {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    const prefs: NutritionPreferences = {
      diet,
      allergens,
      excludedFoods: excluded,
      preferredFoods: preferred,
      budget,
      mealsPerDay: meals,
    };
    setBusy(true);
    setError(null);
    try {
      await savePreferences(prefs);
      toast(t('nutrition.title') + ' ✓');
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        // Se spune ce restrictie blocheaza planul si se ofera modificarea ei.
        const blocked = e.data.blockedBy as { kind: string; allergen?: string } | null;
        const reason = blocked
          ? t(`nutrition.setup.blockedBy.${blocked.kind}`, {
              allergen: blocked.allergen ? t(`nutrition.setup.allergens.${blocked.allergen}`) : '',
            })
          : t('nutrition.setup.blocked');
        setError(reason);
        if (blocked?.kind === 'allergen') setIndex(STEPS.indexOf('allergens'));
        else if (blocked?.kind === 'excluded_foods') setIndex(STEPS.indexOf('foods'));
        else if (blocked?.kind === 'budget') setIndex(STEPS.indexOf('budget'));
        else if (blocked?.kind === 'diet') setIndex(STEPS.indexOf('diet'));
      } else {
        setError(t(errorKey(e)));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title={isLast ? t('nutrition.setup.generate') : t('common.continue')}
            icon={isLast ? 'sparkles' : undefined}
            onPress={onNext}
            disabled={busy}
          />
          <Button
            title={t('common.back')}
            variant="ghost"
            onPress={() => (index === 0 ? router.back() : setIndex((i) => i - 1))}
          />
        </>
      }
    >
      <StepIndicator
        label={t('onboarding.step', { current: index + 1, total: STEPS.length })}
        current={index + 1}
        total={STEPS.length}
      />
      {error ? <Notice>{error}</Notice> : null}

      {step === 'diet' ? (
        <>
          <Title>{t('nutrition.setup.dietTitle')}</Title>
          {DIETS.map((d) => (
            <OptionCard
              key={d}
              title={t(`nutrition.setup.diets.${d}`)}
              hint={t(`nutrition.setup.diets.${d}Hint`)}
              icon={
                d === 'omnivore'
                  ? 'restaurant'
                  : d === 'pescatarian'
                    ? 'fish'
                    : d === 'vegetarian'
                      ? 'egg'
                      : 'leaf'
              }
              selected={diet === d}
              onPress={() => setDiet(d)}
            />
          ))}
        </>
      ) : null}

      {step === 'allergens' ? (
        <>
          <Title>{t('nutrition.setup.allergensTitle')}</Title>
          <Subtitle>{t('nutrition.setup.allergensHint')}</Subtitle>
          <Chips
            options={ALLERGENS.map((a) => ({
              value: a,
              label: t(`nutrition.setup.allergens.${a}`),
            }))}
            selected={allergens}
            onToggle={(a) =>
              setAllergens((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]))
            }
          />
        </>
      ) : null}

      {step === 'foods' ? (
        <>
          <Title>{t('nutrition.setup.foodsTitle')}</Title>
          <Subtitle>{t('nutrition.setup.foodsHint')}</Subtitle>
          <View style={s.legend}>
            <Text style={[theme.font.caption, { color: theme.colors.danger }]}>
              ● {t('nutrition.setup.excluded')}
            </Text>
            <Text style={[theme.font.caption, { color: theme.colors.primary }]}>
              ● {t('nutrition.setup.preferred')}
            </Text>
          </View>
          <Field
            label={t('nutrition.setup.searchFood')}
            value={query}
            onChangeText={setQuery}
            icon="search"
            autoCorrect={false}
          />
          <View style={s.foods}>
            {visibleFoods.map((f) => {
              const isExcluded = excluded.includes(f.id);
              const isPreferred = preferred.includes(f.id);
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  onPress={() => cycleFood(f.id)}
                  style={[s.food, isExcluded && s.excluded, isPreferred && s.preferred]}
                >
                  <Text style={s.foodText}>
                    {isExcluded ? '✕ ' : isPreferred ? '♥ ' : ''}
                    {foodName(f, language)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {step === 'budget' ? (
        <>
          <Title>{t('nutrition.setup.budgetTitle')}</Title>
          {BUDGETS.map((b) => (
            <OptionCard
              key={b}
              title={t(`nutrition.setup.budgets.${b}`)}
              hint={t(`nutrition.setup.budgets.${b}Hint`)}
              icon={b === 'economic' ? 'wallet' : b === 'balanced' ? 'scale' : 'diamond'}
              selected={budget === b}
              onPress={() => setBudget(b)}
            />
          ))}
        </>
      ) : null}

      {step === 'meals' ? (
        <>
          <Title>{t('nutrition.setup.mealsTitle')}</Title>
          {([3, 4, 5] as const).map((n) => (
            <OptionCard
              key={n}
              title={t('nutrition.setup.mealsHint', { n })}
              hint={t(`nutrition.setup.mealsDetail.${n}`)}
              icon="time"
              selected={meals === n}
              onPress={() => setMeals(n)}
            />
          ))}
          <Notice tone="info">{t('common.disclaimer')}</Notice>
        </>
      ) : null}
    </Screen>
  );
}
