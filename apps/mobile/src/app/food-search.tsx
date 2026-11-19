import { Ionicons } from '@expo/vector-icons';
import {
  FOODS,
  foodNutrients,
  getFood,
  roundNutrients,
  searchFoods,
  type Food,
  foodName,
} from '@movemeal/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type LogMeal } from '@/api/client';
import { errorKey } from '@/api/errors';
import { useToast } from '@/components/toast';
import { Button, Field, Notice, parseNumber, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

/** Cautarea unui aliment si adaugarea lui in jurnal, la masa aleasa. */
export default function FoodSearch() {
  const { t, language, formatNumber } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { addEntry } = useNutrition();
  const params = useLocalSearchParams<{ day: string; meal: LogMeal }>();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [food, setFood] = useState<Food | null>(null);
  const [unit, setUnit] = useState<'g' | 'piece'>('g');
  const [amountText, setAmountText] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      paddingHorizontal: th.spacing.lg,
      paddingTop: th.spacing.md,
    },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    title: { ...th.font.heading, fontSize: 20, flex: 1 },
    search: { paddingHorizontal: th.spacing.lg, paddingTop: th.spacing.md },
    list: { padding: th.spacing.lg, gap: th.spacing.sm, paddingBottom: th.spacing.xl },
    section: { ...th.font.caption, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surface,
    },
    panel: {
      margin: th.spacing.lg,
      padding: th.spacing.lg,
      gap: th.spacing.md,
      borderRadius: th.radius.xl,
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    values: { flexDirection: 'row', justifyContent: 'space-between' },
    value: { alignItems: 'center', flex: 1 },
    valueNumber: { fontSize: 20, fontWeight: '800', color: th.colors.text },
  }));

  useEffect(() => {
    if (!session) return;
    api
      .recentFoods(session.token)
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [session]);

  // Alimentele folosite recent si frecvent apar primele.
  const sections = useMemo(() => {
    if (query.trim()) {
      const found = searchFoods(query);
      const recentFound = found.filter((f) => recent.includes(f.id));
      const others = found.filter((f) => !recent.includes(f.id));
      return { recent: recentFound, results: others };
    }
    return {
      recent: recent.map((id) => getFood(id)).filter((f): f is Food => !!f),
      results: [...FOODS].sort((a, b) =>
        foodName(a, language).localeCompare(foodName(b, language), language),
      ),
    };
  }, [query, recent, language]);

  const amount = parseNumber(amountText) ?? 0;
  const grams = food ? (unit === 'piece' ? amount * (food.pieceGrams ?? 0) : amount) : 0;
  const preview = food ? roundNutrients(foodNutrients(food, grams)) : null;

  /**
   * Alimentele care se numara (oua, fructe, felii de paine) pornesc de la 1 bucata cu greutatea
   * medie standard, ca utilizatorul sa nu fie nevoit sa cantareasca fiecare bucata.
   */
  function select(f: Food) {
    setFood(f);
    setUnit(f.pieceGrams ? 'piece' : 'g');
    setAmountText(f.pieceGrams ? '1' : '100');
    setError(null);
  }

  async function onAdd() {
    if (!food || grams <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await addEntry({
        day: params.day,
        meal: params.meal,
        source: 'food',
        refId: food.id,
        amount: Math.round(grams),
      });
      toast(t('journal.added'));
      router.back();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const renderFood = (f: Food) => (
    <Pressable key={f.id} accessibilityRole="button" style={s.row} onPress={() => select(f)}>
      <View style={{ flex: 1 }}>
        <Text style={theme.font.body}>{foodName(f, language)}</Text>
        <Text style={theme.font.caption}>
          {f.kcal} {t('common.kcal')} · {t('common.proteinShort')} {formatNumber(f.protein, 1)}{' '}
          {t('common.g')} · {t('journal.per100')}
          {f.pieceGrams ? ` · ${t('journal.pieceShort', { grams: f.pieceGrams })}` : ''}
        </Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
    </Pressable>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          style={s.back}
          onPress={() => (food ? setFood(null) : router.back())}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>
          {t('journal.searchTitle', { meal: t(`journal.meals.${params.meal}`) })}
        </Text>
      </View>

      {food && preview ? (
        <View style={s.panel}>
          <Text style={theme.font.title}>{foodName(food, language)}</Text>
          {food.pieceGrams ? (
            <Segmented
              options={[
                { value: 'piece', label: t('journal.pieces') },
                { value: 'g', label: t('journal.grams') },
              ]}
              value={unit}
              onChange={(u) => {
                setUnit(u);
                setAmountText(u === 'piece' ? '1' : String(food.pieceGrams ?? 100));
              }}
            />
          ) : null}
          <Field
            label={t('journal.amount')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            suffix={unit === 'g' ? 'g' : t('journal.pieces')}
            hint={
              food.pieceGrams ? (
                <Text style={theme.font.caption}>
                  {t('journal.pieceHint', { grams: food.pieceGrams })}
                  {unit === 'piece' && amount > 0 && amount !== 1
                    ? ` · ${String(amount).replace('.', ',')} × ${food.pieceGrams} ${t('common.g')} = ${Math.round(grams)} ${t('common.g')}`
                    : ''}
                </Text>
              ) : undefined
            }
          />
          <View style={s.values}>
            <View style={s.value}>
              <Text style={s.valueNumber}>{preview.kcal}</Text>
              <Text style={theme.font.caption}>{t('common.kcal')}</Text>
            </View>
            <View style={s.value}>
              <Text style={[s.valueNumber, { color: theme.colors.protein }]}>
                {formatNumber(preview.protein, 1)}
              </Text>
              <Text style={theme.font.caption}>{t('onboarding.summary.protein')}</Text>
            </View>
            <View style={s.value}>
              <Text style={[s.valueNumber, { color: theme.colors.carbs }]}>
                {formatNumber(preview.carbs, 1)}
              </Text>
              <Text style={theme.font.caption}>{t('onboarding.summary.carbs')}</Text>
            </View>
            <View style={s.value}>
              <Text style={[s.valueNumber, { color: theme.colors.fat }]}>
                {formatNumber(preview.fat, 1)}
              </Text>
              <Text style={theme.font.caption}>{t('onboarding.summary.fat')}</Text>
            </View>
          </View>
          {error ? <Notice>{error}</Notice> : null}
          <Button
            title={t('journal.addToLog')}
            icon="add-circle"
            onPress={onAdd}
            disabled={busy || grams <= 0}
          />
        </View>
      ) : (
        <>
          <View style={s.search}>
            <Field
              label=""
              value={query}
              onChangeText={setQuery}
              placeholder={t('journal.searchPlaceholder')}
              icon="search"
              autoCorrect={false}
              autoFocus
            />
          </View>
          <FlatList
            data={[
              ...(sections.recent.length ? [{ key: 'h-recent', title: t('journal.recent') }] : []),
              ...sections.recent.map((f) => ({ key: `r-${f.id}`, food: f })),
              ...(sections.results.length
                ? [{ key: 'h-results', title: t('journal.results') }]
                : []),
              ...sections.results.map((f) => ({ key: f.id, food: f })),
            ]}
            keyExtractor={(item) => item.key}
            contentContainerStyle={s.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={theme.font.caption}>{t('journal.noResults')}</Text>}
            renderItem={({ item }) =>
              'title' in item ? <Text style={s.section}>{item.title}</Text> : renderFood(item.food!)
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}
