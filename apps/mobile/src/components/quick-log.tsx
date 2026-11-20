import { Ionicons } from '@expo/vector-icons';
import { projectDay, type Nutrients } from '@movemeal/shared';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api, type FoodLogEntry, type LogMeal } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ActionSheet } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Field, Notice, parseNumber, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { sumEntries, useNutrition } from '@/state/nutrition-state';
import { useStyles, useTheme } from '@/theme';

/** Caloriile si macronutrientii, pe o linie (folosit la cantitate si la mesele salvate). */
export function NutrientValues({ values }: { values: Nutrients }) {
  const { t, formatNumber } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    cell: { alignItems: 'center', flex: 1, gap: 2 },
    number: { fontSize: 20, fontWeight: '800', color: th.colors.text },
  }));
  const cells: { value: string; label: string; color: string }[] = [
    { value: String(Math.round(values.kcal)), label: t('common.kcal'), color: theme.colors.text },
    {
      value: formatNumber(values.protein, 1),
      label: t('onboarding.summary.protein'),
      color: theme.colors.protein,
    },
    {
      value: formatNumber(values.carbs, 1),
      label: t('onboarding.summary.carbs'),
      color: theme.colors.carbs,
    },
    {
      value: formatNumber(values.fat, 1),
      label: t('onboarding.summary.fat'),
      color: theme.colors.fat,
    },
  ];
  return (
    <View style={s.row}>
      {cells.map((c) => (
        <View key={c.label} style={s.cell}>
          <Text style={[s.number, { color: c.color }]}>{c.value}</Text>
          <Text style={theme.font.caption}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Butoanele mari pentru adaugarea rapida (scanare, descriere, calorii). */
export function QuickActions({
  actions,
}: {
  actions: { key: string; icon: IconName; label: string; hint: string; onPress: () => void }[];
}) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: { flexDirection: 'row', gap: th.spacing.sm },
    tile: {
      flex: 1,
      gap: 6,
      paddingVertical: th.spacing.md,
      paddingHorizontal: th.spacing.sm,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: th.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontSize: 14, fontWeight: '800', color: th.colors.primaryStrong, textAlign: 'center' },
    hint: { fontSize: 11, color: th.colors.textMuted, textAlign: 'center', lineHeight: 14 },
  }));
  return (
    <View style={s.row}>
      {actions.map((a) => (
        <Pressable
          key={a.key}
          accessibilityRole="button"
          accessibilityHint={a.hint}
          onPress={a.onPress}
          style={({ pressed }) => [s.tile, pressed && { opacity: 0.8 }]}
        >
          <View style={s.icon}>
            <Ionicons name={a.icon} size={22} color={theme.colors.primary} />
          </View>
          <Text style={s.label} numberOfLines={1}>
            {a.label}
          </Text>
          <Text style={s.hint} numberOfLines={2}>
            {a.hint}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Calorii introduse direct (restaurant, masa in oras), cu macronutrienti optionali. */
export function QuickAddSheet({
  visible,
  day,
  meal,
  onClose,
  onAdded,
}: {
  visible: boolean;
  day: string;
  meal: LogMeal;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { appendEntries } = useNutrition();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName('');
    setKcal('');
    setProtein('');
    setCarbs('');
    setFat('');
    setError(null);
  }, [visible]);

  const k = parseNumber(kcal);
  const p = parseNumber(protein);
  const c = parseNumber(carbs);
  const f = parseNumber(fat);
  const macroKcal = (p ?? 0) * 4 + (c ?? 0) * 4 + (f ?? 0) * 9;
  const macrosTooHigh = k !== undefined && macroKcal > k * 1.15 + 20;
  const valid = k !== undefined && k >= 1 && k <= 5000 && !macrosTooHigh;

  async function save() {
    if (!session || !valid) return;
    setBusy(true);
    setError(null);
    try {
      const entry = await api.quickAdd(session.token, {
        day,
        meal,
        kcal: Math.round(k!),
        ...(name.trim() ? { name: name.trim() } : {}),
        ...(p !== undefined ? { protein: p } : {}),
        ...(c !== undefined ? { carbs: c } : {}),
        ...(f !== undefined ? { fat: f } : {}),
      });
      appendEntries([entry]);
      toast(t('journal.added'));
      onAdded();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionSheet
      visible={visible}
      title={t('quick.quickTitle', { meal: t(`journal.meals.${meal}`) })}
      onClose={() => (busy ? undefined : onClose())}
    >
      <View style={{ gap: 12 }}>
        <Field
          label={t('quick.kcal')}
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
          suffix={t('common.kcal')}
          placeholder="450"
          autoFocus
          maxLength={4}
        />
        <Field
          label={t('quick.nameOptional')}
          value={name}
          onChangeText={setName}
          placeholder={t('quick.namePlaceholder')}
          maxLength={60}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(
            [
              ['protein', protein, setProtein],
              ['carbs', carbs, setCarbs],
              ['fat', fat, setFat],
            ] as const
          ).map(([key, value, set]) => (
            <View key={key} style={{ flex: 1 }}>
              <Field
                label={t(`onboarding.summary.${key}`)}
                value={value}
                onChangeText={set}
                keyboardType="decimal-pad"
                suffix={t('common.g')}
                maxLength={5}
              />
            </View>
          ))}
        </View>
        {macrosTooHigh ? (
          <Notice>{t('errors.macrosExceed')}</Notice>
        ) : (
          <Text style={[theme.font.caption, { fontSize: 12 }]}>{t('quick.quickHint')}</Text>
        )}
        {error ? <Notice>{error}</Notice> : null}
        <Button
          title={t('journal.addToLog')}
          icon="flash"
          disabled={!valid || busy}
          onPress={save}
        />
      </View>
    </ActionSheet>
  );
}

/** Salvarea alimentelor unei mese din jurnal ca „masa mea”. */
export function SaveMealSheet({
  visible,
  entries,
  defaultName,
  onClose,
}: {
  visible: boolean;
  entries: FoodLogEntry[];
  defaultName: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setName(defaultName);
  }, [visible, defaultName]);

  const total = sumEntries(entries);

  async function save() {
    if (!session || !name.trim()) return;
    setBusy(true);
    try {
      await api.savedMeals.create(
        session.token,
        name.trim(),
        entries.map((e) => e.id),
      );
      toast(t('quick.mealSaved'));
      onClose();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionSheet
      visible={visible}
      title={t('quick.saveMealTitle')}
      onClose={() => (busy ? undefined : onClose())}
    >
      <View style={{ gap: 12 }}>
        <Text style={theme.font.caption}>
          {t('quick.saveMealHint', { n: entries.length, kcal: Math.round(total.kcal) })}
        </Text>
        <Field
          label={t('quick.mealName')}
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoFocus
        />
        <Button
          title={t('quick.saveMeal')}
          icon="bookmark"
          disabled={busy || !name.trim()}
          onPress={save}
        />
      </View>
    </ActionSheet>
  );
}

/** Bilantul zilei si prognoza „daca fiecare zi ar fi ca azi”. */
export function CloseDaySheet({
  visible,
  entries,
  onClose,
}: {
  visible: boolean;
  entries: FoodLogEntry[];
  onClose: () => void;
}) {
  const { t, formatNumber } = useI18n();
  const theme = useTheme();
  const { session, profile, plan } = useAppState();
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Ultima cantarire; fara cantariri se foloseste greutatea din profil.
  useEffect(() => {
    if (!visible || !session || !profile) return;
    setLoading(true);
    api
      .measurements(session.token, 4)
      .then((list) => setWeightKg(list.at(-1)?.weightKg ?? profile.weightKg))
      .catch(() => setWeightKg(profile.weightKg))
      .finally(() => setLoading(false));
  }, [visible, session, profile]);

  const s = useStyles((th) => ({
    hero: {
      alignItems: 'center',
      gap: 4,
      padding: th.spacing.lg,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.primarySoft,
    },
    big: { fontSize: 40, fontWeight: '900', color: th.colors.primaryStrong },
    label: { ...th.font.caption, textAlign: 'center' },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    rowLabel: { ...th.font.body, color: th.colors.textMuted },
    rowValue: { ...th.font.body, fontWeight: '800' },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: th.radius.pill,
    },
  }));

  if (!profile || !plan) return null;
  const total = sumEntries(entries);
  const projection =
    weightKg === null
      ? null
      : projectDay({
          consumedKcal: total.kcal,
          targetKcal: plan.targetCalories,
          tdee: plan.tdee,
          weightKg,
          sex: profile.sex,
        });
  const kg = (n: number) => `${formatNumber(n, 1)} ${t('common.kg')}`;
  const signedKg = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${kg(Math.abs(n))}`;

  // Directia schimbarii comparata cu obiectivul (slabire / crestere / mentinere).
  let tone: 'good' | 'warn' = 'good';
  if (projection?.status === 'ok') {
    const goal = profile.goal;
    if (goal === 'lose' && projection.changeKg > 0) tone = 'warn';
    if ((goal === 'gain' || goal === 'muscle') && projection.changeKg < 0) tone = 'warn';
    if (goal === 'maintain' && Math.abs(projection.changeKg) > 1) tone = 'warn';
  }

  return (
    <ActionSheet visible={visible} title={t('quick.closeDayTitle')} onClose={onClose}>
      <View style={{ gap: 14 }}>
        {loading || !projection ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : projection.status === 'empty' ? (
          <Notice tone="info">{t('quick.closeDayEmpty')}</Notice>
        ) : projection.status === 'below_minimum' ? (
          <Notice>
            {t('quick.closeDayBelow', {
              kcal: Math.round(total.kcal),
              min: projection.minimumKcal,
            })}
          </Notice>
        ) : (
          <>
            <View style={s.hero}>
              <Text style={s.label}>
                {t('quick.projectionLead', { weeks: projection.days / 7 })}
              </Text>
              <Text style={s.big}>{kg(projection.projectedKg)}</Text>
              <Text style={[theme.font.heading, { color: theme.colors.primary }]}>
                {signedKg(projection.changeKg)}
              </Text>
            </View>
            <View
              style={[
                s.badge,
                {
                  backgroundColor:
                    tone === 'good' ? theme.colors.primarySoft : theme.colors.warningSoft,
                },
              ]}
            >
              <Ionicons
                name={tone === 'good' ? 'checkmark-circle' : 'alert-circle'}
                size={18}
                color={tone === 'good' ? theme.colors.primary : theme.colors.warning}
              />
              <Text
                style={{
                  fontWeight: '700',
                  color: tone === 'good' ? theme.colors.primary : theme.colors.warning,
                }}
              >
                {t(`quick.verdict.${projection.verdict}`)}
              </Text>
            </View>
            <View>
              <View style={s.row}>
                <Text style={s.rowLabel}>{t('journal.consumed')}</Text>
                <Text style={s.rowValue}>
                  {Math.round(total.kcal)} {t('common.kcal')}
                </Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>{t('home.target')}</Text>
                <Text style={s.rowValue}>
                  {plan.targetCalories} {t('common.kcal')}
                </Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>{t('quick.maintenance')}</Text>
                <Text style={s.rowValue}>
                  {plan.tdee} {t('common.kcal')}
                </Text>
              </View>
              <View style={s.row}>
                <Text style={s.rowLabel}>{t('quick.balance')}</Text>
                <Text style={s.rowValue}>
                  {projection.balanceKcal > 0 ? '+' : projection.balanceKcal < 0 ? '−' : ''}
                  {Math.abs(projection.balanceKcal)} {t('common.kcal')}
                </Text>
              </View>
            </View>
            <Text style={[theme.font.caption, { fontSize: 12 }]}>{t('quick.projectionNote')}</Text>
          </>
        )}
        <Button title={t('photo.done')} icon="checkmark" onPress={onClose} />
      </View>
    </ActionSheet>
  );
}
