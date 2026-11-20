import { Ionicons } from '@expo/vector-icons';
import {
  FOODS,
  foodName,
  foodNutrients,
  getFood,
  roundNutrients,
  scaleNutrients,
  searchFoods,
  type Food,
  type Nutrients,
} from '@movemeal/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { api, type LogMeal, type Product, type SavedMeal } from '@/api/client';
import { errorKey } from '@/api/errors';
import { NutrientValues, QuickActions, QuickAddSheet } from '@/components/quick-log';
import { ActionSheet } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Field, Notice, parseNumber, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useNutrition } from '@/state/nutrition-state';
import { setEditingProduct, takePendingProduct } from '@/state/pending';
import { useStyles, useTheme } from '@/theme';

type Tab = 'foods' | 'meals' | 'products';

/** Ce se adauga: un aliment din catalog sau un produs (cod de bare / produs propriu). */
type Selected = { kind: 'food'; food: Food } | { kind: 'product'; product: Product };

/** Unitatea: grame, bucati (alimente care se numara) sau portii de pe ambalaj. */
type Unit = 'g' | 'piece' | 'serving';

/** Adaugarea in jurnal: cautare in catalog, mesele salvate, produse si actiunile rapide. */
export default function FoodSearch() {
  const { t, language, formatNumber } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { addEntry, appendEntries } = useNutrition();
  const params = useLocalSearchParams<{ day: string; meal: LogMeal }>();
  const token = session?.token;
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [unit, setUnit] = useState<Unit>('g');
  const [amountText, setAmountText] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [meals, setMeals] = useState<SavedMeal[] | null>(null);
  const [openMeal, setOpenMeal] = useState<SavedMeal | null>(null);
  const [mealMenu, setMealMenu] = useState<SavedMeal | null>(null);
  const [renaming, setRenaming] = useState<{ meal: SavedMeal; name: string } | null>(null);
  const [products, setProducts] = useState<{ mine: Product[]; recent: Product[] } | null>(null);

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
    top: { paddingHorizontal: th.spacing.lg, paddingTop: th.spacing.md, gap: th.spacing.md },
    list: { padding: th.spacing.lg, gap: th.spacing.sm, paddingBottom: th.spacing.xl },
    section: { ...th.font.caption, fontWeight: '800', textTransform: 'uppercase', marginTop: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    thumb: {
      width: 44,
      height: 44,
      borderRadius: th.radius.sm,
      backgroundColor: th.colors.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    rowTitle: { ...th.font.body, fontWeight: '600' },
    panel: {
      margin: th.spacing.lg,
      padding: th.spacing.lg,
      gap: th.spacing.md,
      borderRadius: th.radius.xl,
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    empty: { alignItems: 'center', gap: th.spacing.sm, padding: th.spacing.xl },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: { ...th.font.caption, textAlign: 'center' },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.primarySoft,
      color: th.colors.primary,
      fontSize: 11,
      fontWeight: '800',
      overflow: 'hidden',
      alignSelf: 'flex-start',
    },
    itemLine: { ...th.font.body, fontSize: 14 },
  }));

  useEffect(() => {
    if (!token) return;
    api
      .recentFoods(token)
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [token]);

  const loadMeals = useCallback(() => {
    if (!token) return;
    api.savedMeals
      .list(token)
      .then(setMeals)
      .catch(() => setMeals([]));
  }, [token]);

  const loadProducts = useCallback(() => {
    if (!token) return;
    api.products
      .lists(token)
      .then(setProducts)
      .catch(() => setProducts({ mine: [], recent: [] }));
  }, [token]);

  // Produsul scanat sau adaugat pe ecranul deschis deasupra se deschide direct la cantitate.
  useFocusEffect(
    useCallback(() => {
      const pending = takePendingProduct();
      if (pending) {
        setTab('products');
        selectProduct(pending);
      }
      loadMeals();
      loadProducts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loadMeals, loadProducts]),
  );

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
  let grams = 0;
  let preview: Nutrients | null = null;
  if (selected?.kind === 'food') {
    const piece = selected.food.pieceGrams ?? 0;
    grams = unit === 'piece' ? amount * piece : amount;
    preview = roundNutrients(foodNutrients(selected.food, grams));
  } else if (selected?.kind === 'product') {
    const serving = selected.product.servingG ?? 0;
    grams = unit === 'serving' ? amount * serving : amount;
    preview = roundNutrients(scaleNutrients(selected.product.per100, grams / 100));
  }

  /**
   * Alimentele care se numara (oua, fructe, felii de paine) pornesc de la 1 bucata cu greutatea
   * medie standard; produsele cu portie pe ambalaj pornesc de la o portie.
   */
  function selectFood(f: Food) {
    setSelected({ kind: 'food', food: f });
    setUnit(f.pieceGrams ? 'piece' : 'g');
    setAmountText(f.pieceGrams ? '1' : '100');
    setError(null);
  }

  function selectProduct(p: Product) {
    setSelected({ kind: 'product', product: p });
    setUnit(p.servingG ? 'serving' : 'g');
    setAmountText(p.servingG ? '1' : '100');
    setError(null);
  }

  async function onAdd() {
    if (!selected || grams <= 0 || !token) return;
    setBusy(true);
    setError(null);
    try {
      if (selected.kind === 'food') {
        await addEntry({
          day: params.day,
          meal: params.meal,
          source: 'food',
          refId: selected.food.id,
          amount: Math.round(grams),
        });
      } else {
        const entry = await api.logProduct(token, {
          day: params.day,
          meal: params.meal,
          productId: selected.product.id,
          grams: Math.max(1, Math.round(grams)),
        });
        appendEntries([entry]);
      }
      toast(t('journal.added'));
      router.back();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function logMeal(meal: SavedMeal) {
    if (!token) return;
    setBusy(true);
    try {
      const entries = await api.savedMeals.log(token, meal.id, params.day, params.meal);
      appendEntries(entries);
      toast(t('quick.mealLogged', { name: meal.name }));
      setOpenMeal(null);
      router.back();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function renameMeal() {
    if (!token || !renaming || !renaming.name.trim()) return;
    try {
      await api.savedMeals.rename(token, renaming.meal.id, renaming.name.trim());
      setRenaming(null);
      loadMeals();
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  function deleteMeal(meal: SavedMeal) {
    Alert.alert(t('quick.deleteMealTitle'), t('quick.deleteMealConfirm', { name: meal.name }), [
      { text: t('journal.cancel'), style: 'cancel' },
      {
        text: t('journal.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.savedMeals.remove(token, meal.id);
            loadMeals();
          } catch (e) {
            toast(t(errorKey(e)));
          }
        },
      },
    ]);
  }

  const mealLabel = t(`journal.meals.${params.meal}`);

  const renderFood = (f: Food) => (
    <Pressable key={f.id} accessibilityRole="button" style={s.row} onPress={() => selectFood(f)}>
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

  const renderProduct = (p: Product, editable: boolean) => (
    <Pressable
      key={`${editable ? 'm' : 'r'}-${p.id}`}
      accessibilityRole="button"
      style={s.row}
      onPress={() => selectProduct(p)}
    >
      <View style={s.thumb}>
        {p.imageUrl ? (
          <Image
            source={{ uri: p.imageUrl }}
            style={{ width: 44, height: 44 }}
            contentFit="cover"
          />
        ) : (
          <Ionicons
            name={p.barcode ? 'barcode-outline' : 'cube-outline'}
            size={22}
            color={theme.colors.primary}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle} numberOfLines={2}>
          {p.name}
        </Text>
        <Text style={theme.font.caption} numberOfLines={1}>
          {p.brand ? `${p.brand} · ` : ''}
          {Math.round(p.per100.kcal)} {t('common.kcal')} · {t('journal.per100')}
        </Text>
      </View>
      {editable ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('quick.editProduct')}
          hitSlop={10}
          onPress={() => {
            setEditingProduct(p);
            router.push({
              pathname: '/product-edit',
              params: { day: params.day, meal: params.meal, edit: '1' },
            });
          }}
        >
          <Ionicons name="create-outline" size={22} color={theme.colors.textMuted} />
        </Pressable>
      ) : (
        <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
      )}
    </Pressable>
  );

  const emptyState = (icon: 'bookmark-outline' | 'cube-outline', title: string, text: string) => (
    <View style={s.empty}>
      <View style={s.emptyIcon}>
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>
      <Text style={theme.font.heading}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
    </View>
  );

  // -------------------------------------------------------------- cantitatea

  if (selected && preview) {
    const isFood = selected.kind === 'food';
    const title = isFood ? foodName(selected.food, language) : selected.product.name;
    const piece = isFood ? selected.food.pieceGrams : undefined;
    const serving = !isFood ? selected.product.servingG : null;
    return (
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            style={s.back}
            onPress={() => setSelected(null)}
          >
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('journal.searchTitle', { meal: mealLabel })}</Text>
        </View>
        <View style={s.panel}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            {!isFood && selected.product.imageUrl ? (
              <Image
                source={{ uri: selected.product.imageUrl }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 10,
                  backgroundColor: theme.colors.surfaceAlt,
                }}
                transition={200}
                contentFit="cover"
              />
            ) : null}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[theme.font.title, { fontSize: 22 }]}>{title}</Text>
              {!isFood ? (
                <Text style={s.pill}>
                  {selected.product.source === 'off' ? t('quick.sourceOff') : t('quick.sourceMine')}
                </Text>
              ) : null}
            </View>
          </View>
          {piece || serving ? (
            <Segmented
              options={[
                piece
                  ? { value: 'piece' as Unit, label: t('journal.pieces') }
                  : { value: 'serving' as Unit, label: t('quick.servings') },
                { value: 'g' as Unit, label: t('journal.grams') },
              ]}
              value={unit}
              onChange={(u) => {
                setUnit(u);
                setAmountText(u === 'g' ? String(piece ?? serving ?? 100) : '1');
              }}
            />
          ) : null}
          <Field
            label={t('journal.amount')}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            suffix={
              unit === 'g'
                ? t('common.g')
                : unit === 'piece'
                  ? t('journal.pieces')
                  : t('quick.servings')
            }
            hint={
              piece || serving ? (
                <Text style={theme.font.caption}>
                  {piece
                    ? t('journal.pieceHint', { grams: piece })
                    : t('quick.servingHint', { grams: formatNumber(serving ?? 0, 0) })}
                  {unit !== 'g' && amount > 0 && amount !== 1
                    ? ` · ${String(amount).replace('.', ',')} × ${piece ?? serving} ${t('common.g')} = ${Math.round(grams)} ${t('common.g')}`
                    : ''}
                </Text>
              ) : undefined
            }
          />
          <NutrientValues values={preview} />
          {error ? <Notice>{error}</Notice> : null}
          <Button
            title={t('journal.addToLog')}
            icon="add-circle"
            onPress={onAdd}
            disabled={busy || grams <= 0}
          />
        </View>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------- listele

  type Row =
    | { key: string; title: string }
    | { key: string; food: Food }
    | { key: string; product: Product; editable: boolean }
    | { key: string; meal: SavedMeal }
    | { key: string; empty: 'meals' | 'products' }
    | { key: string; addProduct: true }
    | { key: string; loading: true };

  let rows: Row[] = [];
  if (tab === 'foods') {
    rows = [
      ...(sections.recent.length ? [{ key: 'h-recent', title: t('journal.recent') }] : []),
      ...sections.recent.map((f) => ({ key: `r-${f.id}`, food: f })),
      ...(sections.results.length ? [{ key: 'h-results', title: t('journal.results') }] : []),
      ...sections.results.map((f) => ({ key: f.id, food: f })),
    ];
  } else if (tab === 'meals') {
    rows =
      meals === null
        ? [{ key: 'loading', loading: true }]
        : meals.length
          ? meals.map((m) => ({ key: m.id, meal: m }))
          : [{ key: 'empty', empty: 'meals' }];
  } else {
    rows =
      products === null
        ? [{ key: 'loading', loading: true }]
        : [
            { key: 'add', addProduct: true },
            ...(products.recent.length ? [{ key: 'h-recent', title: t('journal.recent') }] : []),
            ...products.recent.map((p) => ({ key: `r-${p.id}`, product: p, editable: false })),
            ...(products.mine.length ? [{ key: 'h-mine', title: t('quick.myProducts') }] : []),
            ...products.mine.map((p) => ({ key: `m-${p.id}`, product: p, editable: true })),
            ...(!products.recent.length && !products.mine.length
              ? [{ key: 'empty', empty: 'products' as const }]
              : []),
          ];
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={s.back}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>{t('journal.searchTitle', { meal: mealLabel })}</Text>
      </View>

      <View style={s.top}>
        <QuickActions
          actions={[
            {
              key: 'scan',
              icon: 'barcode-outline',
              label: t('quick.scan'),
              hint: t('quick.scanHint'),
              onPress: () =>
                router.push({
                  pathname: '/barcode',
                  params: { day: params.day, meal: params.meal },
                }),
            },
            {
              key: 'describe',
              icon: 'chatbubble-ellipses-outline',
              label: t('quick.describe'),
              hint: t('quick.describeHint'),
              onPress: () =>
                router.push({
                  pathname: '/food-photo',
                  params: { day: params.day, meal: params.meal, mode: 'text' },
                }),
            },
            {
              key: 'quick',
              icon: 'flash-outline',
              label: t('quick.quick'),
              hint: t('quick.quickShort'),
              onPress: () => setQuickOpen(true),
            },
          ]}
        />
        <Segmented
          options={[
            { value: 'foods' as Tab, label: t('quick.tabFoods'), icon: 'nutrition-outline' },
            { value: 'meals' as Tab, label: t('quick.tabMeals'), icon: 'bookmark-outline' },
            { value: 'products' as Tab, label: t('quick.tabProducts'), icon: 'barcode-outline' },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'foods' ? (
          <Field
            label=""
            value={query}
            onChangeText={setQuery}
            placeholder={t('journal.searchPlaceholder')}
            icon="search"
            autoCorrect={false}
          />
        ) : null}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={s.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={theme.font.caption}>{t('journal.noResults')}</Text>}
        renderItem={({ item }) => {
          if ('title' in item) return <Text style={s.section}>{item.title}</Text>;
          if ('food' in item) return renderFood(item.food);
          if ('product' in item) return renderProduct(item.product, item.editable);
          if ('loading' in item) return <ActivityIndicator color={theme.colors.primary} />;
          if ('addProduct' in item) {
            return (
              <Button
                title={t('quick.addProduct')}
                icon="add"
                variant="secondary"
                onPress={() =>
                  router.push({
                    pathname: '/product-edit',
                    params: { day: params.day, meal: params.meal },
                  })
                }
              />
            );
          }
          if ('empty' in item) {
            return item.empty === 'meals'
              ? emptyState('bookmark-outline', t('quick.noMealsTitle'), t('quick.noMeals'))
              : emptyState('cube-outline', t('quick.noProductsTitle'), t('quick.noProducts'));
          }
          const m = item.meal;
          return (
            <Pressable
              accessibilityRole="button"
              style={s.row}
              onPress={() => setOpenMeal(m)}
              onLongPress={() => setMealMenu(m)}
            >
              <View style={s.thumb}>
                <Ionicons name="bookmark" size={20} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle} numberOfLines={1}>
                  {m.name}
                </Text>
                <Text style={theme.font.caption} numberOfLines={1}>
                  {Math.round(m.total.kcal)} {t('common.kcal')} ·{' '}
                  {t('quick.itemsCount', { n: m.items.length })}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('quick.mealOptions')}
                hitSlop={10}
                onPress={() => setMealMenu(m)}
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textMuted} />
              </Pressable>
            </Pressable>
          );
        }}
      />

      <QuickAddSheet
        visible={quickOpen}
        day={params.day}
        meal={params.meal}
        onClose={() => setQuickOpen(false)}
        onAdded={() => {
          setQuickOpen(false);
          router.back();
        }}
      />

      <ActionSheet
        visible={openMeal !== null}
        title={openMeal?.name}
        onClose={() => (busy ? undefined : setOpenMeal(null))}
      >
        {openMeal ? (
          <View style={{ gap: 12 }}>
            <NutrientValues values={openMeal.total} />
            <View style={{ gap: 6 }}>
              {openMeal.items.map((item, i) => (
                <View key={`${item.refId}-${i}`} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={[s.itemLine, { flex: 1 }]} numberOfLines={1}>
                    {item.source === 'food'
                      ? (() => {
                          const food = getFood(item.refId);
                          return food ? foodName(food, language) : item.name;
                        })()
                      : item.name || t('quick.defaultName')}
                  </Text>
                  <Text style={theme.font.caption}>
                    {item.unit === 'g'
                      ? `${Math.round(item.amount)} ${t('common.g')}`
                      : `${String(item.amount).replace('.', ',')} ${t('quick.portionShort')}`}{' '}
                    · {Math.round(item.kcal)} {t('common.kcal')}
                  </Text>
                </View>
              ))}
            </View>
            <Button
              title={t('quick.logMeal', { meal: mealLabel })}
              icon="add-circle"
              disabled={busy}
              onPress={() => logMeal(openMeal)}
            />
          </View>
        ) : null}
      </ActionSheet>

      <ActionSheet
        visible={mealMenu !== null}
        title={mealMenu?.name}
        onClose={() => setMealMenu(null)}
        options={
          mealMenu
            ? [
                {
                  label: t('quick.renameMeal'),
                  icon: 'create-outline',
                  onPress: () => setRenaming({ meal: mealMenu, name: mealMenu.name }),
                },
                {
                  label: t('quick.deleteMeal'),
                  icon: 'trash-outline',
                  danger: true,
                  onPress: () => deleteMeal(mealMenu),
                },
              ]
            : []
        }
      />

      <ActionSheet
        visible={renaming !== null}
        title={t('quick.renameMeal')}
        onClose={() => setRenaming(null)}
      >
        <View style={{ gap: 12 }}>
          <Field
            label={t('quick.mealName')}
            value={renaming?.name ?? ''}
            onChangeText={(name) => setRenaming((r) => (r ? { ...r, name } : r))}
            maxLength={60}
            autoFocus
          />
          <Button
            title={t('common.save')}
            icon="checkmark"
            disabled={!renaming?.name.trim()}
            onPress={renameMeal}
          />
        </View>
      </ActionSheet>
    </SafeAreaView>
  );
}
