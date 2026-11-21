import { movingAverage7 } from '@movemeal/shared';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type ClientDetail } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { AppointmentCard } from '@/components/appointment-card';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Notice, parseNumber, KeyboardScroll } from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Datele unui client (doar cu acordul lui) si ajustarea planului de catre nutritionist. */
export default function ClientScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const token = session?.token;
  const locale = localeOf(language);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = useCallback((c: ClientDetail) => {
    setClient(c);
    setTarget(String(c.plan.targetCalories));
    setNote(c.nutritionistNote ?? '');
  }, []);

  useEffect(() => {
    if (!token || !id) return;
    api.panel
      .client(token, id)
      .then(apply)
      .catch((e) => setError(t(errorKey(e))));
  }, [token, id, t, apply]);

  const value = parseNumber(target);
  const targetError =
    client && (value === undefined || value < client.minCalories || value > client.maxCalories)
      ? t('panel.limits', { min: client.minCalories, max: client.maxCalories })
      : null;

  async function save(calorieTarget: number | null) {
    if (!token || !id) return;
    setBusy(true);
    try {
      apply(await api.panel.adjustClient(token, id, calorieTarget, note));
      toast(t('panel.adjusted'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: th.spacing.md },
    label: { ...th.font.caption },
    value: { ...th.font.body, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
    big: { fontSize: 30, fontWeight: '900', color: th.colors.primary },
    logRow: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    logDay: { ...th.font.caption, width: 86, textTransform: 'capitalize' },
    track: {
      flex: 1,
      height: 10,
      borderRadius: 5,
      backgroundColor: th.colors.surfaceAlt,
      overflow: 'hidden',
    },
    fill: { height: 10, borderRadius: 5, backgroundColor: th.colors.primary },
    logValue: { ...th.font.caption, width: 72, textAlign: 'right', color: th.colors.text },
    note: {
      minHeight: 90,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      padding: th.spacing.md,
      color: th.colors.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
  }));

  const Row = ({ label, value: v }: { label: string; value: string }) => (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{v}</Text>
    </View>
  );

  const chart =
    client && client.weights.length > 0
      ? movingAverage7(client.weights.map((w) => ({ day: w.day, kg: w.weightKg }))).map((m) => ({
          day: m.day,
          weightKg: m.kg,
          waistCm: null,
          average7: m.avg,
        }))
      : [];
  const avgKcal =
    client && client.foodLog.length
      ? Math.round(client.foodLog.reduce((sum, d) => sum + d.kcal, 0) / client.foodLog.length)
      : 0;
  const sourceKey =
    client?.adjustedBy === 'nutritionist'
      ? 'panel.targetByYou'
      : client?.adjustedBy === 'adjustment'
        ? 'panel.targetByAdjustment'
        : 'panel.targetAuto';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardScroll contentContainerStyle={s.content}>
        <ScreenHeader title={client?.profile.name ?? ''} back />
        {error ? <Notice>{error}</Notice> : null}
        {!client && !error ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : null}

        {client ? (
          <>
            <Card title={t('panel.tabs.profile')} icon="person-outline">
              <Row
                label={t('onboarding.personal.age')}
                value={`${client.profile.age} ${t('common.years')}`}
              />
              <Row
                label={t('onboarding.body.height')}
                value={`${client.profile.heightCm} ${t('common.cm')}`}
              />
              <Row
                label={t('onboarding.body.weight')}
                value={`${client.profile.weightKg} ${t('common.kg')}`}
              />
              <Row
                label={t('onboarding.goal.title')}
                value={t(`onboarding.goal.${client.profile.goal}`)}
              />
              {client.profile.targetWeightKg !== undefined ? (
                <Row
                  label={t('onboarding.target.title')}
                  value={`${client.profile.targetWeightKg} ${t('common.kg')}`}
                />
              ) : null}
              <Row
                label={t('onboarding.activity.title')}
                value={t(`onboarding.activity.${client.profile.activityLevel}`)}
              />
            </Card>

            <Card title={t('panel.target')} icon="flame-outline">
              <Text style={s.big}>
                {client.plan.targetCalories} {t('common.kcal')}
              </Text>
              <Text style={theme.font.caption}>
                {t(sourceKey)} · {t('common.proteinShort')} {client.plan.macros.proteinG}{' '}
                {t('common.g')} · {t('common.carbsShort')} {client.plan.macros.carbsG}{' '}
                {t('common.g')} · {t('common.fatShort')} {client.plan.macros.fatG} {t('common.g')}
              </Text>
            </Card>

            <Card title={t('panel.weights')} icon="trending-down-outline">
              {chart.length > 0 ? (
                <WeightChart data={chart} from={chart[0].day} to={chart[chart.length - 1].day} />
              ) : (
                <Text style={theme.font.caption}>{t('panel.noData')}</Text>
              )}
            </Card>

            <Card title={t('panel.foodLog')} icon="restaurant-outline">
              {client.foodLog.length === 0 ? (
                <Text style={theme.font.caption}>{t('panel.noData')}</Text>
              ) : (
                <>
                  {client.foodLog.map((d) => (
                    <View key={d.day} style={s.logRow}>
                      <Text style={s.logDay}>{formatDay(d.day, locale)}</Text>
                      <View style={s.track}>
                        <View
                          style={[
                            s.fill,
                            {
                              width: `${Math.min(d.kcal / client.plan.targetCalories, 1) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                      <Text style={s.logValue}>
                        {d.kcal} {t('common.kcal')}
                      </Text>
                    </View>
                  ))}
                  <Text style={theme.font.caption}>{t('panel.average', { kcal: avgKcal })}</Text>
                </>
              )}
            </Card>

            <Card title={t('panel.mealPlan')} icon="nutrition-outline">
              {client.mealPlan ? (
                <>
                  {client.mealPlan.diet ? (
                    <Row
                      label={t('panel.diet')}
                      value={t(`nutrition.setup.diets.${client.mealPlan.diet}`)}
                    />
                  ) : null}
                  <Row
                    label={t('panel.allergens')}
                    value={
                      client.mealPlan.allergens.length
                        ? client.mealPlan.allergens
                            .map((a) => t(`nutrition.setup.allergens.${a}`))
                            .join(', ')
                        : '—'
                    }
                  />
                  {client.mealPlan.adjustedAt ? (
                    <Text style={[theme.font.caption, { color: theme.colors.primary }]}>
                      {t('consult.adjustedBadge')}
                    </Text>
                  ) : null}
                </>
              ) : (
                <Text style={theme.font.caption}>{t('panel.noMealPlan')}</Text>
              )}
            </Card>

            <Card title={t('panel.adjustTitle')} icon="create-outline">
              <Field
                label={t('panel.newTarget')}
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
                suffix={t('common.kcal')}
                error={targetError}
                hint={
                  targetError ? null : (
                    <Text style={theme.font.caption}>
                      {t('panel.limits', { min: client.minCalories, max: client.maxCalories })}
                    </Text>
                  )
                }
              />
              <Text style={[theme.font.caption, { fontWeight: '700' }]}>{t('panel.note')}</Text>
              <TextInput
                style={s.note}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={1000}
              />
              <Button
                title={t('panel.apply')}
                icon="checkmark-done"
                disabled={!!targetError || busy}
                onPress={() => save(Math.round(value!))}
              />
              {client.adjustedBy === 'nutritionist' ? (
                <Button
                  title={t('panel.resetAuto')}
                  variant="ghost"
                  disabled={busy}
                  onPress={() => save(null)}
                />
              ) : null}
            </Card>

            {client.appointments.length > 0 ? (
              <>
                <Text style={theme.font.heading}>{t('panel.consultations')}</Text>
                {client.appointments.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} title={a.clientName} />
                ))}
              </>
            ) : null}
          </>
        ) : null}
      </KeyboardScroll>
    </SafeAreaView>
  );
}
