import { Ionicons } from '@expo/vector-icons';
import {
  ACTIVITIES,
  activityKcal,
  calculateEnergyPlan,
  exerciseMinutes,
  getActivity,
  type ActivityDefinition,
  type LossApproach,
} from '@movemeal/shared';
import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type ActivityDay } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { ActionSheet } from '@/components/social';
import { StepsSheet } from '@/components/steps';
import { useToast } from '@/components/toast';
import {
  Button,
  Card,
  Field,
  IconCircle,
  KeyboardScroll,
  Notice,
  type IconName,
} from '@/components/ui';
import { formatNumber, localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isoDate } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

const CATEGORIES = ['cardio', 'gym', 'sport', 'daily'] as const;
const APPROACHES: LossApproach[] = ['diet', 'mixed', 'exercise'];
const APPROACH_ICONS: Record<LossApproach, IconName> = {
  diet: 'restaurant',
  mixed: 'git-merge',
  exercise: 'bicycle',
};
const PRESETS = [15, 30, 45, 60, 90];

/** Miscarea zilei: activitati, pasi, antrenament, fata de arderea propusa la slabire. */
export default function ActivityScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session, profile } = useAppState();
  const [data, setData] = useState<ActivityDay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<ActivityDefinition | null>(null);
  const [approachOpen, setApproachOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    api
      .activity(session.token)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(t(errorKey(e))));
  }, [session, t]);

  useFocusEffect(load);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: 48 },
    hero: { borderRadius: th.radius.lg, padding: th.spacing.lg, gap: th.spacing.sm },
    heroLabel: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', fontSize: 14 },
    big: { fontSize: 46, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
    unit: { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
    track: {
      height: 10,
      borderRadius: 5,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
    },
    fill: { height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
    heroHint: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: th.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    chipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    row: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md, paddingVertical: 4 },
    rowText: { flex: 1, gap: 2 },
    rowValue: { ...th.font.body, fontWeight: '800' },
    section: { ...th.font.caption, fontWeight: '700', textTransform: 'uppercase', marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    tile: {
      width: '31%',
      flexGrow: 1,
      alignItems: 'center',
      gap: 6,
      paddingVertical: th.spacing.md,
      paddingHorizontal: 6,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surfaceAlt,
    },
    tileText: { ...th.font.caption, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 120 },
    col: { flex: 1, alignItems: 'center', gap: 4 },
    bar: { width: '100%', borderRadius: 6, minHeight: 4 },
    dayLabel: { ...th.font.caption, fontSize: 11, textTransform: 'capitalize' },
    goalLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderColor: th.colors.textMuted,
    },
  }));

  function remove(id: string, name: string) {
    if (!session) return;
    Alert.alert(t('activity.deleteTitle'), name, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('activity.delete'),
        style: 'destructive',
        onPress: () => {
          api
            .removeActivity(session.token, id)
            .then(load)
            .catch((e) => toast(t(errorKey(e))));
        },
      },
    ]);
  }

  const goal = data?.goalKcal ?? 0;
  const burned = data?.totalKcal ?? 0;
  const pct = goal > 0 ? Math.min(1, burned / goal) : 0;
  const max = Math.max(goal * 1.2, 100, ...(data?.week.map((d) => d.kcal) ?? []));
  const today = isoDate(new Date());

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardScroll contentContainerStyle={s.content}>
        <ScreenHeader title={t('activity.title')} subtitle={t('activity.subtitle')} back />

        {error ? <Notice>{error}</Notice> : null}
        {!data && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}

        {data ? (
          <>
            <LinearGradient
              colors={theme.gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              <Text style={s.heroLabel}>{t('activity.burnedToday')}</Text>
              <Text style={s.big}>
                {formatNumber(burned, language, 0)} <Text style={s.unit}>{t('common.kcal')}</Text>
              </Text>
              {goal > 0 ? (
                <>
                  <View style={s.track}>
                    <View style={[s.fill, { width: `${Math.max(pct * 100, 3)}%` }]} />
                  </View>
                  <Text style={s.heroHint}>
                    {burned >= goal
                      ? t('activity.goalReached', { goal })
                      : t('activity.goalLeft', {
                          left: goal - burned,
                          goal,
                          minutes: exerciseMinutes(goal - burned).walking,
                        })}
                  </Text>
                </>
              ) : (
                <Text style={s.heroHint}>{t('activity.noGoal')}</Text>
              )}
              {data.lossApproach ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setApproachOpen(true)}
                  style={s.chip}
                >
                  <Ionicons name={APPROACH_ICONS[data.lossApproach]} size={16} color="#FFFFFF" />
                  <Text style={s.chipText}>
                    {t(`onboarding.approach.${data.lossApproach}`)} · {t('activity.change')}
                  </Text>
                </Pressable>
              ) : null}
            </LinearGradient>

            <Card title={t('activity.today')} icon="flame">
              {data.items.map((item) => {
                const activity = getActivity(item.activityId);
                const name = t(`activities.${item.activityId}`);
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    onLongPress={() => remove(item.id, name)}
                    style={s.row}
                  >
                    <IconCircle
                      icon={(activity?.icon ?? 'fitness') as IconName}
                      color={theme.colors.accent}
                      background={theme.colors.accentSoft}
                      size={38}
                    />
                    <View style={s.rowText}>
                      <Text style={theme.font.body}>{name}</Text>
                      <Text style={theme.font.caption}>
                        {t('activity.minutes', { minutes: item.minutes })}
                      </Text>
                    </View>
                    <Text style={s.rowValue}>
                      {item.kcal} {t('common.kcal')}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('activity.delete')}
                      hitSlop={10}
                      onPress={() => remove(item.id, name)}
                    >
                      <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
                    </Pressable>
                  </Pressable>
                );
              })}
              <Pressable
                accessibilityRole="button"
                onPress={() => setStepsOpen(true)}
                style={s.row}
              >
                <IconCircle
                  icon="footsteps"
                  color={theme.colors.info}
                  background={theme.colors.infoSoft}
                  size={38}
                />
                <View style={s.rowText}>
                  <Text style={theme.font.body}>{t('home.steps')}</Text>
                  <Text style={theme.font.caption}>
                    {data.steps
                      ? t('activity.stepsDetail', { steps: formatNumber(data.steps, language, 0) })
                      : t('steps.add')}
                  </Text>
                </View>
                <Text style={s.rowValue}>
                  {data.stepsKcal} {t('common.kcal')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/workout')}
                style={s.row}
              >
                <IconCircle
                  icon="barbell"
                  color={theme.colors.primary}
                  background={theme.colors.primarySoft}
                  size={38}
                />
                <View style={s.rowText}>
                  <Text style={theme.font.body}>{t('activity.workout')}</Text>
                  <Text style={theme.font.caption}>
                    {t('activity.workoutDetail', { count: data.workoutExercises })}
                  </Text>
                </View>
                <Text style={s.rowValue}>
                  {data.workoutKcal} {t('common.kcal')}
                </Text>
              </Pressable>
            </Card>

            <Card title={t('activity.add')} icon="add-circle">
              {CATEGORIES.map((category) => (
                <View key={category} style={{ gap: 8 }}>
                  <Text style={s.section}>{t(`activity.categories.${category}`)}</Text>
                  <View style={s.grid}>
                    {ACTIVITIES.filter((a) => a.category === category).map((a) => (
                      <Pressable
                        key={a.id}
                        accessibilityRole="button"
                        onPress={() => setAdding(a)}
                        style={({ pressed }) => [s.tile, pressed && { opacity: 0.7 }]}
                      >
                        <Ionicons
                          name={a.icon as IconName}
                          size={24}
                          color={theme.colors.primary}
                        />
                        <Text style={s.tileText} numberOfLines={2}>
                          {t(`activities.${a.id}`)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </Card>

            <Card title={t('activity.week')} icon="stats-chart">
              <View style={s.chart}>
                {goal > 0 ? (
                  <View
                    pointerEvents="none"
                    style={[s.goalLine, { bottom: 22 + (goal / max) * 90 }]}
                  />
                ) : null}
                {data.week.map((d) => {
                  const date = new Date(`${d.day}T12:00:00`);
                  const reached = goal > 0 && d.kcal >= goal;
                  return (
                    <View key={d.day} style={s.col}>
                      <Text style={[theme.font.caption, { fontSize: 10 }]}>
                        {d.kcal ? d.kcal : ''}
                      </Text>
                      <View
                        style={[
                          s.bar,
                          {
                            height: Math.max(4, (d.kcal / max) * 90),
                            backgroundColor: reached ? theme.colors.primary : theme.colors.accent,
                            opacity: d.kcal ? 1 : 0.25,
                          },
                        ]}
                      />
                      <Text style={[s.dayLabel, d.day === today && { fontWeight: '800' }]}>
                        {date.toLocaleDateString(localeOf(language), { weekday: 'narrow' })}
                      </Text>
                    </View>
                  );
                })}
              </View>
              {goal > 0 ? (
                <Text style={theme.font.caption}>{t('activity.weekGoal', { goal })}</Text>
              ) : null}
            </Card>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/fasting')}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <Card>
                <View style={s.row}>
                  <IconCircle
                    icon="timer"
                    color={theme.colors.primary}
                    background={theme.colors.primarySoft}
                  />
                  <View style={s.rowText}>
                    <Text style={theme.font.heading}>{t('fasting.title')}</Text>
                    <Text style={theme.font.caption}>{t('fasting.teaser')}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                </View>
              </Card>
            </Pressable>

            <Notice tone="info">{t('activity.note')}</Notice>
          </>
        ) : null}
      </KeyboardScroll>

      <AddActivitySheet
        activity={adding}
        onClose={() => setAdding(null)}
        onSaved={() => {
          setAdding(null);
          load();
        }}
      />
      {profile?.goal === 'lose' ? (
        <ApproachSheet
          visible={approachOpen}
          onClose={() => setApproachOpen(false)}
          onSaved={() => {
            setApproachOpen(false);
            load();
          }}
        />
      ) : null}
      <StepsSheet visible={stepsOpen} onClose={() => setStepsOpen(false)} onSaved={load} />
    </SafeAreaView>
  );
}

/** Durata activitatii (si, optional, caloriile citite de pe ceas). */
function AddActivitySheet({
  activity,
  onClose,
  onSaved,
}: {
  activity: ActivityDefinition | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session, profile } = useAppState();
  const [minutes, setMinutes] = useState('30');
  const [kcal, setKcal] = useState('');
  const [busy, setBusy] = useState(false);

  const s = useStyles((th) => ({
    presets: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    preset: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.surfaceAlt,
    },
    presetOn: { backgroundColor: th.colors.primary },
    presetText: { fontWeight: '700', color: th.colors.text },
    preview: {
      alignItems: 'center',
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.primarySoft,
      gap: 2,
    },
    previewValue: { fontSize: 32, fontWeight: '900', color: th.colors.primaryStrong },
  }));

  const n = Number(minutes) || 0;
  const custom = Number(kcal) || 0;
  const estimate = activity && profile ? activityKcal(activity, n, profile.weightKg) : 0;
  const valid = n >= 1 && n <= 600 && (kcal === '' || (custom >= 1 && custom <= 5000));

  async function save() {
    if (!session || !activity) return;
    setBusy(true);
    try {
      const res = await api.addActivity(session.token, {
        day: isoDate(new Date()),
        activityId: activity.id,
        minutes: n,
        ...(kcal ? { kcal: custom } : {}),
      });
      toast(
        res.trophies.length
          ? t('steps.trophy', { trophy: t(`trophies.${res.trophies[0]}.title`) })
          : t('activity.saved', { kcal: res.entry.kcal }),
      );
      setMinutes('30');
      setKcal('');
      onSaved();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionSheet
      visible={!!activity}
      title={activity ? t(`activities.${activity.id}`) : undefined}
      onClose={onClose}
    >
      <View style={{ gap: 12 }}>
        <View style={s.presets}>
          {PRESETS.map((p) => {
            const on = n === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                onPress={() => setMinutes(String(p))}
                style={[s.preset, on && s.presetOn]}
              >
                <Text style={[s.presetText, on && { color: '#FFFFFF' }]}>
                  {t('activity.minutesShort', { minutes: p })}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Field
          label={t('activity.duration')}
          value={minutes}
          onChangeText={(v) => setMinutes(v.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={3}
          icon="time-outline"
          suffix={t('activity.min')}
        />
        <Field
          label={t('activity.kcalOptional')}
          value={kcal}
          onChangeText={(v) => setKcal(v.replace(/\D/g, ''))}
          onClear={() => setKcal('')}
          keyboardType="number-pad"
          maxLength={4}
          icon="watch-outline"
          placeholder={String(estimate)}
          suffix={t('common.kcal')}
        />
        <View style={s.preview}>
          <Text style={s.previewValue}>
            {kcal ? custom : estimate} {t('common.kcal')}
          </Text>
          <Text style={theme.font.caption}>
            {kcal ? t('activity.fromDevice') : t('activity.estimate', { met: activity?.met ?? 0 })}
          </Text>
        </View>
        <Button
          title={t('activity.save')}
          icon="checkmark"
          disabled={!valid || busy}
          onPress={save}
        />
      </View>
    </ActionSheet>
  );
}

/** Schimbarea abordarii slabirii, cu efectul asupra mesei si miscarii zilnice. */
function ApproachSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { profile, targetSource, setLossApproach } = useAppState();
  const [busy, setBusy] = useState(false);

  const s = useStyles((th) => ({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: th.colors.surfaceAlt,
    },
    on: { borderColor: th.colors.primary, backgroundColor: th.colors.primarySoft },
  }));

  if (!profile) return null;
  const current = profile.lossApproach ?? 'diet';

  async function choose(approach: LossApproach) {
    if (approach === current) return onClose();
    setBusy(true);
    try {
      await setLossApproach(approach);
      toast(t('activity.approachSaved'));
      onSaved();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionSheet visible={visible} title={t('onboarding.approach.title')} onClose={onClose}>
      <View style={{ gap: 10 }}>
        {APPROACHES.map((a) => {
          const plan = calculateEnergyPlan({ ...profile, lossApproach: a });
          const on = a === current;
          return (
            <Pressable
              key={a}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              disabled={busy}
              onPress={() => choose(a)}
              style={[s.option, on && s.on]}
            >
              <Ionicons name={APPROACH_ICONS[a]} size={22} color={theme.colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={theme.font.heading}>{t(`onboarding.approach.${a}`)}</Text>
                <Text style={theme.font.caption}>
                  {t('activity.approachLine', {
                    eat: formatNumber(plan.targetCalories, language, 0),
                    burn: plan.exerciseKcal,
                  })}
                </Text>
              </View>
              {on ? (
                <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
              ) : null}
            </Pressable>
          );
        })}
        {targetSource.adjustedBy === 'nutritionist' ? (
          <Notice tone="info">{t('activity.approachNutritionist')}</Notice>
        ) : null}
        {busy ? <ActivityIndicator color={theme.colors.primary} /> : null}
      </View>
    </ActionSheet>
  );
}
