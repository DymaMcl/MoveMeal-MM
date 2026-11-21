import { Ionicons } from '@expo/vector-icons';
import { MenuButton } from '@/components/app-menu';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Measurement, type ProgressResponse } from '@/api/client';
import { errorKey } from '@/api/errors';
import { useToast } from '@/components/toast';
import {
  Button,
  Card,
  Field,
  Notice,
  parseNumber,
  Segmented,
  KeyboardScroll,
} from '@/components/ui';
import { WeightChart } from '@/components/weight-chart';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { currentWeek, isoDate } from '@/state/dates';
import { useWorkout } from '@/state/workout-state';
import { useStyles, useTheme } from '@/theme';

type Weeks = 4 | 8 | 12;

export default function Progress() {
  const { t, formatNumber } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session, profile, refreshProfile } = useAppState();
  const { program: workout, done } = useWorkout();
  const [weeks, setWeeks] = useState<Weeks>(4);
  const [measurements, setMeasurements] = useState<Measurement[] | null>(null);
  const [progress, setProgress] = useState<ProgressResponse | null>(null);
  const [weightText, setWeightText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    title: { ...th.font.title, flex: 1 },
    legend: { flexDirection: 'row', gap: th.spacing.md },
    stats: { flexDirection: 'row', gap: th.spacing.sm },
    stat: {
      flex: 1,
      padding: th.spacing.md,
      gap: 4,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    statValue: { fontSize: 26, fontWeight: '900', color: th.colors.text },
    row: { flexDirection: 'row', gap: th.spacing.sm },
  }));

  const load = useCallback(async () => {
    if (!session) return;
    try {
      const [m, p] = await Promise.all([
        api.measurements(session.token, weeks),
        api.progress(session.token),
      ]);
      setMeasurements(m);
      setProgress(p);
      setError(null);
    } catch (e) {
      setError(t(errorKey(e)));
    }
  }, [session, weeks, t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Antrenamentele efectuate saptamana aceasta (zile cu cel putin un exercitiu bifat) fata de cele planificate.
  const workoutsDone = useMemo(() => {
    const week = currentWeek().map(isoDate);
    const days = new Set([...done].map((k) => k.split('|')[0]).filter((d) => week.includes(d)));
    return days.size;
  }, [done]);
  const workoutsPlanned = workout?.plan.sessions.length ?? 0;

  async function saveWeight() {
    const kg = parseNumber(weightText);
    if (!session || kg === undefined || kg < 35 || kg > 250) {
      setError(t('onboarding.errors.range', { min: 35, max: 250 }));
      return;
    }
    setBusy(true);
    try {
      await api.saveMeasurement(session.token, isoDate(new Date()), Math.round(kg * 10) / 10);
      setWeightText('');
      toast(t('progress.weightSaved'));
      await load();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function decide(accept: boolean) {
    if (!session) return;
    setBusy(true);
    try {
      if (accept) {
        await api.acceptAdjustment(session.token);
        await refreshProfile();
        toast(t('progress.accepted'));
      } else {
        await api.rejectAdjustment(session.token);
      }
      await load();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const today = isoDate(new Date());
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - (weeks * 7 - 1));
  const analysis = progress?.analysis;
  const rate = (pct: number) => formatNumber(pct, 2);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardScroll contentContainerStyle={s.content}>
        <View style={s.header}>
          <Pressable accessibilityRole="button" style={s.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={s.title}>{t('progress.title')}</Text>
          <MenuButton />
        </View>

        {error ? <Notice>{error}</Notice> : null}

        <Card title={t('progress.weight')} icon="trending-down">
          <Segmented
            options={([4, 8, 12] as Weeks[]).map((w) => ({
              value: String(w),
              label: t('progress.weeks', { n: w }),
            }))}
            value={String(weeks)}
            onChange={(v) => setWeeks(Number(v) as Weeks)}
          />
          {!measurements ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : measurements.length === 0 ? (
            <Text style={theme.font.caption}>{t('progress.noWeights')}</Text>
          ) : (
            <>
              <WeightChart data={measurements} from={isoDate(fromDate)} to={today} />
              <View style={s.legend}>
                <Text style={[theme.font.caption, { color: theme.colors.accent }]}>
                  ● {t('progress.weight')}
                </Text>
                <Text style={[theme.font.caption, { color: theme.colors.primary }]}>
                  ━ {t('progress.average')}
                </Text>
              </View>
            </>
          )}
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Field
                label={t('progress.addWeight')}
                value={weightText}
                onChangeText={setWeightText}
                keyboardType="decimal-pad"
                suffix="kg"
                placeholder={profile ? String(profile.weightKg) : ''}
              />
            </View>
          </View>
          <Button
            title={t('common.save')}
            icon="save"
            onPress={saveWeight}
            disabled={busy || !weightText}
          />
        </Card>

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.statValue}>{progress ? `${progress.loggedDaysThisWeek}/7` : '–'}</Text>
            <Text style={theme.font.caption}>{t('progress.loggedDays')}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.statValue}>
              {workoutsPlanned ? `${workoutsDone}/${workoutsPlanned}` : '–'}
            </Text>
            <Text style={theme.font.caption}>{t('workout.title')}</Text>
          </View>
        </View>

        <Card title={t('progress.adjustmentTitle')} icon="options">
          {!analysis ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : analysis.status === 'insufficient_data' ? (
            <>
              <Text style={theme.font.heading}>{t('progress.insufficient')}</Text>
              <Text style={theme.font.caption}>
                {t('progress.insufficientHint', {
                  weights: analysis.weightEntries,
                  days: analysis.loggedDays,
                })}
              </Text>
            </>
          ) : analysis.status === 'on_track' ? (
            <Text style={theme.font.body}>
              {t('progress.onTrack', { rate: rate(analysis.weeklyChangePct) })}
            </Text>
          ) : analysis.status === 'at_limit' ? (
            <Text style={theme.font.body}>{t('progress.atLimit')}</Text>
          ) : (
            <>
              <Text style={theme.font.body}>
                {t('progress.proposal', {
                  rate: rate(analysis.weeklyChangePct),
                  from: analysis.currentTarget,
                  to: analysis.proposedTarget,
                })}
              </Text>
              <Button
                title={t('progress.accept')}
                icon="checkmark-circle"
                onPress={() => decide(true)}
                disabled={busy}
              />
              <Button
                title={t('progress.reject')}
                variant="ghost"
                onPress={() => decide(false)}
                disabled={busy}
              />
            </>
          )}
        </Card>
        <Notice tone="info">{t('common.disclaimer')}</Notice>
      </KeyboardScroll>
    </SafeAreaView>
  );
}
