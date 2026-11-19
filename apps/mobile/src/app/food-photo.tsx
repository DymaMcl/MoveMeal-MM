import { Ionicons } from '@expo/vector-icons';
import { roundNutrients, scaleNutrients, type Nutrients } from '@movemeal/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
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
import { api, type LogMeal, type PhotoAnalysis } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, Notice, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isoDate } from '@/state/dates';
import { useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

/** Latura maxima a imaginii trimise (suficient pentru recunoastere, sub ~300 KB). */
const MAX_SIDE = 1280;
const MAX_GRAMS = 2000;
const STEP = 10;
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
  | { kind: 'analyzing'; uri: string }
  | { kind: 'result'; uri: string; analysis: PhotoAnalysis };

interface Choice {
  include: boolean;
  grams: number;
}

/** Recunoasterea alimentelor din fotografie (Google Gemini) si adaugarea lor in jurnal. */
export default function FoodPhoto() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { loadDay } = useNutrition();
  const params = useLocalSearchParams<{ day?: string; meal?: LogMeal }>();
  const day = params.day ?? isoDate(new Date());
  const [meal, setMeal] = useState<LogMeal>(
    params.meal && MEALS.includes(params.meal) ? params.meal : mealByHour(),
  );
  const [stage, setStage] = useState<Stage>({ kind: 'pick' });
  const [choices, setChoices] = useState<Choice[]>([]);
  const [saving, setSaving] = useState(false);
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
        setRemaining(s.remaining.photo);
      })
      .catch(() => setAvailable(false));
  }, [token]);

  async function pick(source: 'camera' | 'gallery') {
    if (!token) return;
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast(t('photo.permissionCamera'));
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    }
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setStage({ kind: 'analyzing', uri: asset.uri });

    try {
      // Imaginea se micsoreaza si se comprima pe telefon, apoi se trimite serverului.
      const context = ImageManipulator.manipulate(asset.uri);
      if (Math.max(asset.width, asset.height) > MAX_SIDE) {
        context.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
      }
      const image = await context.renderAsync();
      const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (!saved.base64) throw new Error('base64');

      const analysis = await api.ai.analyzePhoto(token, saved.base64, 'image/jpeg', language);
      setChoices(analysis.items.map((i) => ({ include: true, grams: i.grams })));
      setStage({ kind: 'result', uri: saved.uri, analysis });
      setRemaining((n) => (n === null ? n : Math.max(0, n - 1)));
    } catch (e) {
      toast(t(errorKey(e)));
      setStage({ kind: 'pick' });
    }
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
      await api.ai.logPhoto(token, analysis.id, { day, meal, items });
      await loadDay(day).catch(() => undefined);
      toast(t('photo.saved'));
      router.back();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    hero: {
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: th.spacing.lg,
    },
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
    overlayHint: { color: '#FFFFFFCC', fontSize: 13 },
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

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('photo.title')} subtitle={t('photo.subtitle')} back />

        {stage.kind === 'pick' ? (
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
              {available === null ? (
                <ActivityIndicator color={theme.colors.primary} />
              ) : (
                pickButtons
              )}
              <Card title={t('photo.tipsTitle')} icon="bulb-outline">
                {(['tip1', 'tip2', 'tip3'] as const).map((key) => (
                  <View key={key} style={s.tip}>
                    <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
                    <Text style={s.tipText}>{t(`photo.${key}`)}</Text>
                  </View>
                ))}
              </Card>
            </>
          )
        ) : null}

        {stage.kind === 'analyzing' ? (
          <View>
            <Image source={{ uri: stage.uri }} style={s.photo} resizeMode="cover" />
            <View style={s.overlay} accessibilityLiveRegion="polite">
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={s.overlayText}>{t('photo.analyzing')}</Text>
              <Text style={s.overlayHint}>{t('photo.analyzingHint')}</Text>
            </View>
          </View>
        ) : null}

        {stage.kind === 'result' && analysis ? (
          <>
            <Image source={{ uri: stage.uri }} style={s.photo} resizeMode="cover" />
            {!analysis.isFood ? (
              <>
                <Notice>{t('photo.notFood')}</Notice>
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
                  {analysis.items.map((item, i) => {
                    const choice = choices[i];
                    if (!choice) return null;
                    return (
                      <View key={item.index} style={[s.item, !choice.include && s.disabled]}>
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
                </Card>

                <Text style={theme.font.heading}>{t('photo.meal')}</Text>
                <Segmented
                  options={MEALS.map((m) => ({ value: m, label: t(`journal.meals.${m}`) }))}
                  value={meal}
                  onChange={setMeal}
                />
                <Text style={theme.font.caption}>{t('photo.disclaimer')}</Text>
                <Button
                  title={t('photo.save', { kcal: Math.round(total.kcal) })}
                  icon="checkmark"
                  disabled={saving || !choices.some((c) => c.include)}
                  onPress={save}
                />
                <Button
                  title={t('photo.retake')}
                  icon="camera-reverse-outline"
                  variant="ghost"
                  disabled={saving}
                  onPress={() => setStage({ kind: 'pick' })}
                />
              </>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
