import { Ionicons } from '@expo/vector-icons';
import {
  foodName,
  roundNutrients,
  scaleNutrients,
  searchFoods,
  type Nutrients,
} from '@movemeal/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type FoodLogEntry, type LogMeal, type PhotoAnalysis } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { SaveMealSheet } from '@/components/quick-log';
import { ActionSheet } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Card, Notice, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isoDate } from '@/state/dates';
import { pickImage, stashImage, type PickedImage } from '@/state/images';
import { useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

const MAX_GRAMS = 2000;
const STEP = 10;
const MAX_ITEMS = 12;
const MEALS: LogMeal[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Masa probabila dupa ora curenta. */
function mealByHour(hour = new Date().getHours()): LogMeal {
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

type Stage =
  | { kind: 'pick' }
  | { kind: 'analyzing' }
  | { kind: 'result'; analysis: PhotoAnalysis }
  | { kind: 'saved'; analysis: PhotoAnalysis; kcal: number };

interface Choice {
  include: boolean;
  grams: number;
}

/** Ce se corecteaza: alimentul cu indexul dat sau un aliment nou (index = null). */
interface Editing {
  index: number | null;
  text: string;
}

/** Recunoasterea alimentelor din fotografie (Google Gemini) si adaugarea lor in jurnal. */
export default function FoodPhoto() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { loadDay } = useNutrition();
  const params = useLocalSearchParams<{ day?: string; meal?: LogMeal; mode?: 'text' }>();
  /** Masa descrisa in cuvinte in loc de fotografie (aceeasi verificare a rezultatului). */
  const textMode = params.mode === 'text';
  const day = params.day ?? isoDate(new Date());
  const [meal, setMeal] = useState<LogMeal>(
    params.meal && MEALS.includes(params.meal) ? params.meal : mealByHour(),
  );
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [photo, setPhoto] = useState<PickedImage | null>(null);
  const [hint, setHint] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [reanalyze, setReanalyze] = useState(false);
  /** Inregistrarile salvate, ca masa sa poata fi pastrata si in „Mesele mele”. */
  const [savedEntries, setSavedEntries] = useState<FoodLogEntry[]>([]);
  const [saveMealOpen, setSaveMealOpen] = useState(false);
  /** null = se verifica; false = serviciul AI nu este configurat. */
  const [available, setAvailable] = useState<boolean | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const token = session?.token;

  useEffect(() => {
    if (!token) return;
    api.ai
      .status(token)
      .then((s) => {
        setAvailable(s.available);
        setRemaining(textMode ? s.remaining.chat : s.remaining.photo);
      })
      .catch(() => setAvailable(false));
  }, [token, textMode]);

  /** Analiza descrierii scrise sau dictate. */
  async function analyzeText() {
    if (!token || hint.trim().length < 2) return;
    setStage({ kind: 'analyzing' });
    try {
      const analysis = await api.ai.analyzeText(token, hint.trim(), language);
      setChoices(analysis.items.map((i) => ({ include: true, grams: i.grams })));
      setStage({ kind: 'result', analysis });
      setRemaining((n) => (n === null ? n : Math.max(0, n - 1)));
    } catch (e) {
      toast(t(errorKey(e)));
      setStage({ kind: 'pick' });
    }
  }

  async function analyze(image: PickedImage, description: string) {
    if (!token) return;
    setStage({ kind: 'analyzing' });
    try {
      const analysis = await api.ai.analyzePhoto(
        token,
        image.base64,
        'image/jpeg',
        language,
        description.trim() || undefined,
      );
      setChoices(analysis.items.map((i) => ({ include: true, grams: i.grams })));
      setStage({ kind: 'result', analysis });
      setRemaining((n) => (n === null ? n : Math.max(0, n - 1)));
    } catch (e) {
      toast(t(errorKey(e)));
      setStage({ kind: 'pick' });
    }
  }

  async function pick(source: 'camera' | 'gallery') {
    const picked = await pickImage(source);
    if (picked === 'denied') {
      toast(t('photo.permissionCamera'));
      return;
    }
    if (!picked) return;
    setPhoto(picked);
    await analyze(picked, hint);
  }

  const analysis = stage.kind === 'result' ? stage.analysis : null;

  const itemNutrients = useMemo(
    () =>
      analysis?.items.map((item, i) =>
        roundNutrients(scaleNutrients(item.per100, (choices[i]?.grams ?? item.grams) / 100)),
      ) ?? [],
    [analysis, choices],
  );

  const total = useMemo<Nutrients>(
    () =>
      itemNutrients.reduce(
        (sum, n, i) =>
          choices[i]?.include
            ? {
                kcal: sum.kcal + n.kcal,
                protein: sum.protein + n.protein,
                carbs: sum.carbs + n.carbs,
                fat: sum.fat + n.fat,
              }
            : sum,
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [itemNutrients, choices],
  );

  function update(index: number, change: Partial<Choice>) {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, ...change } : c)));
  }

  function setGrams(index: number, grams: number) {
    update(index, { grams: Math.min(MAX_GRAMS, Math.max(1, Math.round(grams))) });
  }

  /** Corectarea unui aliment: din catalog (instant) sau dupa denumire (estimata de AI). */
  async function applyEdit(change: { foodId?: string; name?: string }) {
    if (!token || !analysis || !editing) return;
    setEditBusy(true);
    try {
      const index = editing.index;
      const grams = index === null ? 100 : choices[index]?.grams;
      const next = await api.ai.editPhotoItem(token, analysis.id, {
        ...(index === null ? {} : { index }),
        ...change,
        ...(grams ? { grams } : {}),
        language,
      });
      setChoices((prev) =>
        next.items.map((item, i) =>
          i === index || i >= prev.length ? { include: true, grams: item.grams } : prev[i],
        ),
      );
      setStage({ kind: 'result', analysis: next });
      setEditing(null);
      toast(t(index === null ? 'photo.itemAdded' : 'photo.itemCorrected'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setEditBusy(false);
    }
  }

  async function save() {
    if (!token || !analysis) return;
    const items = choices
      .map((c, index) => ({ index, grams: c.grams, include: c.include }))
      .filter((c) => c.include)
      .map(({ index, grams }) => ({ index, grams }));
    if (!items.length) {
      toast(t('photo.selectOne'));
      return;
    }
    setSaving(true);
    try {
      setSavedEntries(await api.ai.logPhoto(token, analysis.id, { day, meal, items }));
      await loadDay(day).catch(() => undefined);
      toast(t('photo.saved'));
      setStage({ kind: 'saved', analysis, kcal: Math.round(total.kcal) });
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  const suggestions = useMemo(
    () => (editing && editing.text.trim().length >= 2 ? searchFoods(editing.text).slice(0, 6) : []),
    [editing],
  );

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    hero: { alignItems: 'center', gap: th.spacing.sm, paddingVertical: th.spacing.md },
    heroIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { ...th.font.body, textAlign: 'center' },
    caption: { ...th.font.caption, textAlign: 'center' },
    tip: { flexDirection: 'row', gap: th.spacing.sm, alignItems: 'flex-start' },
    tipText: { ...th.font.body, flex: 1, fontSize: 14 },
    hint: {
      minHeight: 48,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
      paddingVertical: th.spacing.sm,
      color: th.colors.text,
      fontSize: 15,
    },
    photo: {
      width: '100%',
      aspectRatio: 4 / 3,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.surfaceAlt,
    },
    overlay: {
      ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const),
      borderRadius: th.radius.lg,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
      gap: th.spacing.sm,
    },
    overlayText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
    overlayHint: { color: '#FFFFFFCC', fontSize: 13, textAlign: 'center', paddingHorizontal: 24 },
    dish: { ...th.font.title, fontSize: 22 },
    totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    totalKcal: { fontSize: 34, fontWeight: '900', color: th.colors.primary },
    macros: { ...th.font.caption },
    item: {
      gap: th.spacing.sm,
      paddingVertical: th.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: th.colors.border,
    },
    itemHead: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    itemName: { ...th.font.body, fontWeight: '700', flex: 1 },
    tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    tag: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      fontSize: 11,
      fontWeight: '800',
      overflow: 'hidden',
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    stepButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: th.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gramsInput: {
      minWidth: 72,
      height: 36,
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      textAlign: 'center',
      color: th.colors.text,
      fontSize: 15,
      fontWeight: '700',
      paddingVertical: 0,
    },
    itemKcal: { ...th.font.body, fontWeight: '800', marginLeft: 'auto' },
    disabled: { opacity: 0.45 },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: th.spacing.sm,
    },
    link: { ...th.font.body, color: th.colors.primary, fontWeight: '700', flex: 1 },
    suggestion: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      minHeight: 48,
      paddingHorizontal: th.spacing.sm,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surfaceAlt,
    },
    savedIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
    },
  }));

  const pickButtons = (
    <View style={{ gap: theme.spacing.sm }}>
      <Button title={t('photo.camera')} icon="camera" onPress={() => pick('camera')} />
      <Button
        title={t('photo.gallery')}
        icon="images-outline"
        variant="secondary"
        onPress={() => pick('gallery')}
      />
    </View>
  );

  const hintInput = (
    <View style={{ gap: 6 }}>
      <Text style={[theme.font.body, { fontWeight: '700' }]}>{t('photo.hintLabel')}</Text>
      <TextInput
        style={s.hint}
        value={hint}
        onChangeText={setHint}
        placeholder={t('photo.hintPlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        maxLength={200}
      />
      <Text style={[theme.font.caption, { fontSize: 12 }]}>{t('photo.hintHelp')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader
          title={textMode ? t('quick.describeTitle') : t('photo.title')}
          subtitle={textMode ? t('quick.describeSubtitle') : t('photo.subtitle')}
          back
        />

        {stage.kind === 'pick' && textMode ? (
          available === false ? (
            <>
              <Notice tone="info">{t('photo.unavailable')}</Notice>
              <Button
                title={t('photo.manual')}
                icon="search"
                onPress={() => router.replace({ pathname: '/food-search', params: { day, meal } })}
              />
            </>
          ) : (
            <>
              <View style={s.hero}>
                <View style={s.heroIcon}>
                  <Ionicons name="chatbubble-ellipses" size={38} color={theme.colors.primary} />
                </View>
                <Text style={s.center}>{t('quick.describeIntro')}</Text>
                {remaining !== null ? (
                  <Text style={s.caption}>{t('quick.describeRemaining', { n: remaining })}</Text>
                ) : null}
              </View>
              <TextInput
                style={[s.hint, { minHeight: 120, textAlignVertical: 'top', paddingTop: 12 }]}
                value={hint}
                onChangeText={setHint}
                placeholder={t('quick.describePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                maxLength={500}
                autoFocus
                accessibilityLabel={t('quick.describeTitle')}
              />
              <View style={s.tip}>
                <Ionicons name="mic-outline" size={18} color={theme.colors.primary} />
                <Text style={[s.tipText, { color: theme.colors.textMuted }]}>
                  {t('quick.dictateHint')}
                </Text>
              </View>
              {available === null ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                <Button
                  title={t('quick.analyze')}
                  icon="sparkles"
                  disabled={hint.trim().length < 2}
                  onPress={analyzeText}
                />
              )}
              <Card title={t('quick.examplesTitle')} icon="bulb-outline">
                {(['example1', 'example2', 'example3'] as const).map((key) => (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    style={s.tip}
                    onPress={() => setHint(t(`quick.${key}`))}
                  >
                    <Ionicons name="chatbox-outline" size={18} color={theme.colors.primary} />
                    <Text style={s.tipText}>{t(`quick.${key}`)}</Text>
                  </Pressable>
                ))}
              </Card>
            </>
          )
        ) : null}

        {stage.kind === 'analyzing' && !photo ? (
          <Card>
            <View style={{ alignItems: 'center', gap: 10, paddingVertical: 24 }}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={theme.font.heading}>{t('quick.analyzingText')}</Text>
              <Text style={[theme.font.caption, { textAlign: 'center' }]}>“{hint.trim()}”</Text>
            </View>
          </Card>
        ) : null}

        {stage.kind === 'pick' && !textMode ? (
          available === false ? (
            <>
              <Notice tone="info">{t('photo.unavailable')}</Notice>
              <Button
                title={t('photo.manual')}
                icon="search"
                onPress={() => router.replace({ pathname: '/food-search', params: { day, meal } })}
              />
            </>
          ) : (
            <>
              <View style={s.hero}>
                <View style={s.heroIcon}>
                  <Ionicons name="camera" size={40} color={theme.colors.primary} />
                </View>
                <Text style={s.center}>{t('photo.intro')}</Text>
                {remaining !== null ? (
                  <Text style={s.caption}>{t('photo.remaining', { n: remaining })}</Text>
                ) : null}
              </View>
              {hintInput}
              {available === null ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                pickButtons
              )}
              <Card title={t('photo.tipsTitle')} icon="bulb-outline">
                {(['tip1', 'tip2', 'tip3', 'tip4'] as const).map((key) => (
                  <View key={key} style={s.tip}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    <Text style={s.tipText}>{t(`photo.${key}`)}</Text>
                  </View>
                ))}
              </Card>
            </>
          )
        ) : null}

        {stage.kind === 'analyzing' && photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={s.photo} resizeMode="cover" />
            <View style={s.overlay} accessibilityLiveRegion="polite">
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={s.overlayText}>{t('photo.analyzing')}</Text>
              <Text style={s.overlayHint}>{t('photo.analyzingHint')}</Text>
            </View>
          </View>
        ) : null}

        {stage.kind === 'saved' ? (
          <>
            <View style={s.savedIcon}>
              <Ionicons name="checkmark-done" size={44} color={theme.colors.primary} />
            </View>
            <Text style={[theme.font.title, { textAlign: 'center', fontSize: 22 }]}>
              {t('photo.savedTitle', { kcal: stage.kcal })}
            </Text>
            {photo ? (
              <>
                <Text style={s.center}>{t('photo.shareHint')}</Text>
                <Image source={{ uri: photo.uri }} style={s.photo} resizeMode="cover" />
                <Button
                  title={t('photo.share')}
                  icon="share-social-outline"
                  onPress={() =>
                    router.replace({
                      pathname: '/post/new',
                      params: {
                        imageKey: stashImage(photo),
                        foodPhotoId: stage.analysis.id,
                        dish: stage.analysis.dish,
                        kcal: String(stage.kcal),
                      },
                    })
                  }
                />
              </>
            ) : null}
            {savedEntries.length ? (
              <Button
                title={t('quick.saveToMyMeals')}
                icon="bookmark-outline"
                variant="secondary"
                onPress={() => setSaveMealOpen(true)}
              />
            ) : null}
            <Button
              title={t('photo.done')}
              variant={photo ? 'ghost' : 'primary'}
              icon="checkmark"
              onPress={() => router.back()}
            />
            <SaveMealSheet
              visible={saveMealOpen}
              entries={savedEntries}
              defaultName={stage.analysis.dish}
              onClose={() => setSaveMealOpen(false)}
            />
          </>
        ) : null}

        {stage.kind === 'result' && analysis ? (
          <>
            {photo ? (
              <Image source={{ uri: photo.uri }} style={s.photo} resizeMode="cover" />
            ) : null}
            {!analysis.isFood ? (
              <>
                <Notice>{t('photo.notFood')}</Notice>
                {hintInput}
                {photo ? (
                  <Button
                    title={t('photo.reanalyze')}
                    icon="refresh"
                    disabled={!hint.trim()}
                    onPress={() => analyze(photo, hint)}
                  />
                ) : null}
                {pickButtons}
              </>
            ) : (
              <>
                <Card>
                  {analysis.dish ? <Text style={s.dish}>{analysis.dish}</Text> : null}
                  <Text style={theme.font.caption}>{t('photo.total')}</Text>
                  <View style={s.totalRow}>
                    <Text style={s.totalKcal}>{Math.round(total.kcal)}</Text>
                    <Text style={theme.font.heading}>{t('common.kcal')}</Text>
                  </View>
                  <Text style={s.macros}>
                    {t('common.proteinShort')} {Math.round(total.protein)} {t('common.g')} ·{' '}
                    {t('common.carbsShort')} {Math.round(total.carbs)} {t('common.g')} ·{' '}
                    {t('common.fatShort')} {Math.round(total.fat)} {t('common.g')}
                  </Text>
                </Card>

                <Card title={t('photo.found')} icon="restaurant-outline">
                  <Text style={[theme.font.caption, { fontSize: 12 }]}>{t('photo.editHint')}</Text>
                  {analysis.items.map((item, i) => {
                    const choice = choices[i];
                    if (!choice) return null;
                    return (
                      <View
                        key={`${item.index}-${item.name}`}
                        style={[s.item, !choice.include && s.disabled]}
                      >
                        <View style={s.itemHead}>
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: choice.include }}
                            accessibilityLabel={`${t('photo.include')}: ${item.name}`}
                            hitSlop={8}
                            onPress={() => update(i, { include: !choice.include })}
                          >
                            <Ionicons
                              name={choice.include ? 'checkbox' : 'square-outline'}
                              size={24}
                              color={theme.colors.primary}
                            />
                          </Pressable>
                          <Text style={s.itemName}>{item.name}</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('photo.correct', { name: item.name })}
                            hitSlop={8}
                            onPress={() => setEditing({ index: i, text: '' })}
                          >
                            <Ionicons
                              name="create-outline"
                              size={22}
                              color={theme.colors.primary}
                            />
                          </Pressable>
                        </View>
                        {item.foodId || item.confidence < 0.5 ? (
                          <View style={s.tags}>
                            {item.foodId ? (
                              <Text
                                style={[
                                  s.tag,
                                  {
                                    backgroundColor: theme.colors.primarySoft,
                                    color: theme.colors.primary,
                                  },
                                ]}
                              >
                                {t('photo.catalog')}
                              </Text>
                            ) : null}
                            {item.confidence < 0.5 ? (
                              <Text
                                style={[
                                  s.tag,
                                  {
                                    backgroundColor: theme.colors.warningSoft,
                                    color: theme.colors.warning,
                                  },
                                ]}
                              >
                                {t('photo.uncertain')}
                              </Text>
                            ) : null}
                          </View>
                        ) : null}
                        <View style={s.stepper}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('photo.decrease')}
                            style={s.stepButton}
                            disabled={!choice.include}
                            onPress={() => setGrams(i, choice.grams - STEP)}
                          >
                            <Ionicons name="remove" size={18} color={theme.colors.text} />
                          </Pressable>
                          <TextInput
                            style={s.gramsInput}
                            value={String(choice.grams)}
                            editable={choice.include}
                            keyboardType="number-pad"
                            maxLength={4}
                            selectTextOnFocus
                            onChangeText={(text) => {
                              const n = Number(text.replace(/\D/g, ''));
                              if (n > 0) setGrams(i, n);
                            }}
                          />
                          <Text style={theme.font.caption}>{t('common.g')}</Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('photo.increase')}
                            style={s.stepButton}
                            disabled={!choice.include}
                            onPress={() => setGrams(i, choice.grams + STEP)}
                          >
                            <Ionicons name="add" size={18} color={theme.colors.text} />
                          </Pressable>
                          <Text style={s.itemKcal}>
                            {Math.round(itemNutrients[i]?.kcal ?? 0)} {t('common.kcal')}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                  {analysis.items.length < MAX_ITEMS ? (
                    <Pressable
                      accessibilityRole="button"
                      style={s.linkRow}
                      onPress={() => setEditing({ index: null, text: '' })}
                    >
                      <Ionicons name="add-circle-outline" size={22} color={theme.colors.primary} />
                      <Text style={s.link}>{t('photo.addItem')}</Text>
                    </Pressable>
                  ) : null}
                </Card>

                {textMode ? null : reanalyze && photo ? (
                  <Card>
                    {hintInput}
                    <Button
                      title={t('photo.reanalyze')}
                      icon="refresh"
                      disabled={!hint.trim()}
                      onPress={() => {
                        setReanalyze(false);
                        analyze(photo, hint);
                      }}
                    />
                  </Card>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    style={s.linkRow}
                    onPress={() => setReanalyze(true)}
                  >
                    <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
                    <Text style={s.link}>{t('photo.wrongResult')}</Text>
                  </Pressable>
                )}

                <Text style={theme.font.heading}>{t('photo.meal')}</Text>
                <Segmented
                  options={MEALS.map((m) => ({ value: m, label: t(`journal.meals.${m}`) }))}
                  value={meal}
                  onChange={setMeal}
                />
                <Text style={theme.font.caption}>
                  {t(textMode ? 'quick.disclaimerText' : 'photo.disclaimer')}
                </Text>
                <Button
                  title={t('photo.save', { kcal: Math.round(total.kcal) })}
                  icon="checkmark"
                  disabled={saving || !choices.some((c) => c.include)}
                  onPress={save}
                />
                <Button
                  title={textMode ? t('quick.editText') : t('photo.retake')}
                  icon={textMode ? 'create-outline' : 'camera-reverse-outline'}
                  variant="ghost"
                  disabled={saving}
                  onPress={() => setStage({ kind: 'pick' })}
                />
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      <ActionSheet
        visible={editing !== null}
        title={
          editing?.index === null
            ? t('photo.addItem')
            : t('photo.correctTitle', { name: analysis?.items[editing?.index ?? 0]?.name ?? '' })
        }
        onClose={() => (editBusy ? undefined : setEditing(null))}
      >
        <Text style={theme.font.caption}>{t('photo.correctHint')}</Text>
        <TextInput
          style={s.hint}
          value={editing?.text ?? ''}
          onChangeText={(text) => setEditing((prev) => (prev ? { ...prev, text } : prev))}
          placeholder={t('photo.correctPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          maxLength={80}
          autoFocus
        />
        {suggestions.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            disabled={editBusy}
            style={({ pressed }) => [s.suggestion, pressed && { opacity: 0.8 }]}
            onPress={() => applyEdit({ foodId: f.id })}
          >
            <Ionicons name="book-outline" size={18} color={theme.colors.primary} />
            <Text style={[theme.font.body, { flex: 1 }]}>{foodName(f, language)}</Text>
            <Text style={theme.font.caption}>
              {f.kcal} {t('common.kcal')}/100 {t('common.g')}
            </Text>
          </Pressable>
        ))}
        {editBusy ? <ActivityIndicator color={theme.colors.primary} /> : null}
        <Button
          title={t('photo.estimateAi')}
          icon="sparkles-outline"
          variant="secondary"
          disabled={editBusy || (editing?.text.trim().length ?? 0) < 2}
          onPress={() => editing && applyEdit({ name: editing.text.trim() })}
        />
      </ActionSheet>
    </SafeAreaView>
  );
}
