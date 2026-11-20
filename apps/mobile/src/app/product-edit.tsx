import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type LabelDraft, type LogMeal, type Product } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Notice, parseNumber } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { pickImage } from '@/state/images';
import { setPendingProduct, getEditingProduct } from '@/state/pending';
import { useStyles, useTheme } from '@/theme';

const BARCODE = /^[0-9]{8,14}$/;
const fmt = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n).replace('.', ',');

/**
 * Produs propriu (de exemplu negasit la scanare): valorile de pe eticheta, la 100 g.
 * Eticheta poate fi citita de AI; utilizatorul verifica valorile inainte de salvare.
 */
export default function ProductEdit() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const params = useLocalSearchParams<{
    day?: string;
    meal?: LogMeal;
    barcode?: string;
    name?: string;
    brand?: string;
    edit?: string;
  }>();
  // Produsul deschis pentru modificare (din lista „Produsele mele”).
  const [editing] = useState<Product | null>(() => (params.edit ? getEditingProduct() : null));
  const [name, setName] = useState(editing?.name ?? params.name ?? '');
  const [brand, setBrand] = useState(editing?.brand ?? params.brand ?? '');
  const [barcode, setBarcode] = useState(editing?.barcode ?? params.barcode ?? '');
  const [kcal, setKcal] = useState(fmt(editing?.per100.kcal));
  const [protein, setProtein] = useState(fmt(editing?.per100.protein));
  const [carbs, setCarbs] = useState(fmt(editing?.per100.carbs));
  const [fat, setFat] = useState(fmt(editing?.per100.fat));
  const [serving, setServing] = useState(fmt(editing?.servingG));
  const [reading, setReading] = useState(false);
  const [readDone, setReadDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    label: {
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
    grid: { flexDirection: 'row', gap: th.spacing.sm },
    cell: { flex: 1 },
  }));

  const n = {
    kcal: parseNumber(kcal),
    protein: parseNumber(protein),
    carbs: parseNumber(carbs),
    fat: parseNumber(fat),
    serving: parseNumber(serving),
  };
  const macroSum = (n.protein ?? 0) + (n.carbs ?? 0) + (n.fat ?? 0);
  const macroKcal = (n.protein ?? 0) * 4 + (n.carbs ?? 0) * 4 + (n.fat ?? 0) * 9;
  const tooMuch = macroSum > 100.5;
  // Abatere mare intre calorii si macronutrienti: probabil o valoare citita gresit.
  const mismatch =
    n.kcal !== undefined &&
    macroSum > 0 &&
    Math.abs(n.kcal - macroKcal) > Math.max(40, n.kcal * 0.25);
  const valid =
    name.trim().length > 0 &&
    n.kcal !== undefined &&
    n.kcal <= 900 &&
    n.protein !== undefined &&
    n.carbs !== undefined &&
    n.fat !== undefined &&
    !tooMuch &&
    (barcode === '' || BARCODE.test(barcode)) &&
    (n.serving === undefined || (n.serving >= 1 && n.serving <= 2000));

  function fill(draft: LabelDraft) {
    if (draft.name && !name.trim()) setName(draft.name);
    if (draft.brand && !brand.trim()) setBrand(draft.brand);
    setKcal(fmt(draft.per100.kcal));
    setProtein(fmt(draft.per100.protein));
    setCarbs(fmt(draft.per100.carbs));
    setFat(fmt(draft.per100.fat));
    if (draft.servingG) setServing(fmt(draft.servingG));
  }

  async function readLabel(source: 'camera' | 'gallery') {
    if (!session) return;
    // Rezolutie mai mare decat pentru mese, ca cifrele mici de pe eticheta sa fie lizibile.
    const picked = await pickImage(source, { maxSide: 1600 });
    if (picked === 'denied') {
      toast(t('photo.permissionCamera'));
      return;
    }
    if (!picked) return;
    setReading(true);
    setError(null);
    try {
      fill(await api.products.readLabel(session.token, picked.base64, language));
      setReadDone(true);
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!session || !valid) return;
    setSaving(true);
    setError(null);
    const body = {
      name: name.trim(),
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(barcode ? { barcode } : {}),
      kcal: n.kcal!,
      protein: n.protein!,
      carbs: n.carbs!,
      fat: n.fat!,
      ...(n.serving ? { servingG: n.serving } : {}),
    };
    try {
      if (editing) {
        await api.products.update(session.token, editing.id, body);
        toast(t('quick.productSaved'));
      } else {
        const product = await api.products.create(session.token, body);
        // Cautarea deschide produsul direct la cantitate.
        if (params.day && params.meal) setPendingProduct(product);
        toast(t('quick.productSaved'));
      }
      router.back();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!editing) return;
    Alert.alert(t('quick.deleteProduct'), t('quick.deleteProductConfirm', { name: editing.name }), [
      { text: t('journal.cancel'), style: 'cancel' },
      {
        text: t('journal.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!session) return;
          try {
            await api.products.remove(session.token, editing.id);
            router.back();
          } catch (e) {
            toast(t(errorKey(e)));
          }
        },
      },
    ]);
  }

  const numberField = (label: string, value: string, set: (v: string) => void, suffix: string) => (
    <View style={s.cell}>
      <Field
        label={label}
        value={value}
        onChangeText={set}
        keyboardType="decimal-pad"
        suffix={suffix}
        maxLength={6}
      />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader
            title={editing ? t('quick.editProduct') : t('quick.newProduct')}
            subtitle={t('quick.productSubtitle')}
            back
          />

          {!editing ? (
            <View style={s.label}>
              <Ionicons name="scan" size={28} color={theme.colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[theme.font.heading, { color: theme.colors.primaryStrong }]}>
                  {t('quick.readLabel')}
                </Text>
                <Text style={theme.font.caption}>
                  {readDone ? t('quick.readLabelDone') : t('quick.readLabelHint')}
                </Text>
              </View>
            </View>
          ) : null}
          {!editing ? (
            reading ? (
              <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text style={theme.font.caption}>{t('quick.readingLabel')}</Text>
              </View>
            ) : (
              <View style={s.grid}>
                <View style={s.cell}>
                  <Button
                    title={t('photo.camera')}
                    icon="camera"
                    variant="secondary"
                    onPress={() => readLabel('camera')}
                  />
                </View>
                <View style={s.cell}>
                  <Button
                    title={t('quick.gallery')}
                    icon="images-outline"
                    variant="secondary"
                    onPress={() => readLabel('gallery')}
                  />
                </View>
              </View>
            )
          ) : null}

          <Card title={t('quick.productInfo')} icon="cube-outline">
            <Field
              label={t('quick.productName')}
              value={name}
              onChangeText={setName}
              placeholder={t('quick.productNamePlaceholder')}
              maxLength={120}
            />
            <Field
              label={t('quick.brandOptional')}
              value={brand}
              onChangeText={setBrand}
              maxLength={80}
            />
            <Field
              label={t('quick.barcodeOptional')}
              value={barcode}
              onChangeText={(v) => setBarcode(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={14}
              icon="barcode-outline"
              error={barcode && !BARCODE.test(barcode) ? t('quick.barcodeInvalid') : null}
            />
          </Card>

          <Card title={t('quick.per100Title')} icon="list-outline">
            <View style={s.grid}>
              {numberField(t('quick.energy'), kcal, setKcal, t('common.kcal'))}
              {numberField(t('onboarding.summary.protein'), protein, setProtein, t('common.g'))}
            </View>
            <View style={s.grid}>
              {numberField(t('onboarding.summary.carbs'), carbs, setCarbs, t('common.g'))}
              {numberField(t('onboarding.summary.fat'), fat, setFat, t('common.g'))}
            </View>
            <Field
              label={t('quick.servingOptional')}
              value={serving}
              onChangeText={setServing}
              keyboardType="decimal-pad"
              suffix={t('common.g')}
              maxLength={6}
              hint={<Text style={theme.font.caption}>{t('quick.servingFieldHint')}</Text>}
            />
            {tooMuch ? <Notice>{t('errors.productInvalid')}</Notice> : null}
            {!tooMuch && mismatch ? (
              <Notice tone="info">{t('quick.mismatch', { kcal: Math.round(macroKcal) })}</Notice>
            ) : null}
          </Card>

          {error ? <Notice>{error}</Notice> : null}
          <Button
            title={editing ? t('common.save') : t('quick.saveProduct')}
            icon="checkmark"
            disabled={!valid || saving}
            onPress={save}
          />
          {editing ? (
            <Pressable
              accessibilityRole="button"
              onPress={remove}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                alignSelf: 'center',
                padding: 8,
              }}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>
                {t('quick.deleteProduct')}
              </Text>
            </Pressable>
          ) : (
            <Text style={[theme.font.caption, { fontSize: 12, textAlign: 'center' }]}>
              {t('quick.privateNote')}
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
