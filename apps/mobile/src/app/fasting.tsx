import { Ionicons } from '@expo/vector-icons';
import {
  FASTING_PLANS,
  fastingStage,
  getFastingPlan,
  type FastingPlanId,
  type FastingStage,
} from '@movemeal/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { api, type FastingSession, type FastingState } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, IconCircle, Notice, type IconName } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

const HOUR = 3_600_000;
/** „Am mancat ultima data acum ... ore” la pornirea postului. */
const STARTED_AGO = [0, 1, 2, 3, 4];
const STAGE_ICONS: Record<FastingStage, IconName> = {
  digesting: 'restaurant',
  settling: 'water',
  fat_burning: 'flame',
};

function duration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Postul intermitent: fereastra de mancat, cronometru, etape si istoric. */
export default function FastingScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [state, setState] = useState<FastingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planId, setPlanId] = useState<FastingPlanId>('14_10');
  const [ago, setAgo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(() => {
    if (!session) return;
    api
      .fasting(session.token)
      .then((s) => {
        setState(s);
        setError(null);
      })
      .catch((e) => setError(t(errorKey(e))));
  }, [session, t]);

  useFocusEffect(load);

  // Cronometrul se actualizeaza in fiecare minut cat timp postul este activ.
  useEffect(() => {
    if (!state?.active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [state?.active]);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: 48 },
    ringWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: th.spacing.sm },
    ringCenter: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    time: { fontSize: 44, fontWeight: '900', color: th.colors.text, letterSpacing: -1 },
    plans: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    plan: {
      width: '47%',
      flexGrow: 1,
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: th.colors.surfaceAlt,
      gap: 2,
    },
    planOn: { borderColor: th.colors.primary, backgroundColor: th.colors.primarySoft },
    planTitle: { ...th.font.heading, fontSize: 20 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.surfaceAlt,
    },
    chipOn: { backgroundColor: th.colors.primary },
    chipText: { fontWeight: '700', color: th.colors.text, fontSize: 13 },
    stage: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    stats: { flexDirection: 'row', gap: th.spacing.sm },
    stat: {
      flex: 1,
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surfaceAlt,
      alignItems: 'center',
      gap: 2,
    },
    statValue: { ...th.font.heading, fontSize: 22 },
    historyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      paddingVertical: 6,
    },
  }));

  async function start() {
    if (!session) return;
    setBusy(true);
    try {
      const startedAt = ago ? new Date(Date.now() - ago * HOUR).toISOString() : undefined;
      await api.startFast(session.token, { planId, ...(startedAt ? { startedAt } : {}) });
      toast(t('fasting.started'));
      load();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  function stop(active: FastingSession) {
    if (!session) return;
    const reached = now - Date.parse(active.startedAt) >= active.plannedHours * HOUR;
    Alert.alert(t('fasting.stopTitle'), reached ? t('fasting.stopDone') : t('fasting.stopEarly'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('fasting.stop'),
        style: reached ? 'default' : 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const res = await api.stopFast(session.token);
            toast(
              res.trophies.length
                ? t('steps.trophy', { trophy: t(`trophies.${res.trophies[0]}.title`) })
                : res.session.completed
                  ? t('fasting.completed')
                  : t('fasting.stopped'),
            );
            load();
          } catch (e) {
            toast(t(errorKey(e)));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function removeFast(item: FastingSession) {
    if (!session) return;
    Alert.alert(t('fasting.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('activity.delete'),
        style: 'destructive',
        onPress: () => {
          api
            .removeFast(session.token, item.id)
            .then(load)
            .catch((e) => toast(t(errorKey(e))));
        },
      },
    ]);
  }

  const active = state?.active ?? null;
  const size = 230;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const elapsed = active ? now - Date.parse(active.startedAt) : 0;
  const goalMs = active ? active.plannedHours * HOUR : 0;
  const progress = active ? Math.min(1, elapsed / goalMs) : 0;
  const stage = fastingStage(elapsed / HOUR);
  const endsAt = active ? new Date(Date.parse(active.startedAt) + goalMs) : null;
  const time = (d: Date) =>
    d.toLocaleTimeString(localeOf(language), { hour: '2-digit', minute: '2-digit' });
  const date = (d: Date) =>
    d.toLocaleDateString(localeOf(language), { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('fasting.title')} subtitle={t('fasting.subtitle')} back />

        {error ? <Notice>{error}</Notice> : null}
        {!state && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}

        {state?.block ? (
          <Notice>{t(`fasting.block.${state.block}`)}</Notice>
        ) : state ? (
          <>
            {active ? (
              <Card>
                <View style={s.ringWrap}>
                  <View style={{ width: size, height: size }}>
                    <Svg width={size} height={size}>
                      <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={theme.colors.surfaceAlt}
                        strokeWidth={stroke}
                        fill="none"
                      />
                      <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={progress >= 1 ? theme.colors.primary : theme.colors.accent}
                        strokeWidth={stroke}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${circumference} ${circumference}`}
                        strokeDashoffset={circumference * (1 - Math.max(progress, 0.01))}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                      />
                    </Svg>
                    <View style={s.ringCenter}>
                      <Text style={theme.font.caption}>
                        {progress >= 1 ? t('fasting.goalReached') : t('fasting.elapsed')}
                      </Text>
                      <Text style={s.time}>{duration(elapsed)}</Text>
                      <Text style={theme.font.caption}>
                        {progress >= 1
                          ? t('fasting.plan', { plan: active.planId.replace('_', ':') })
                          : t('fasting.left', { time: duration(goalMs - elapsed) })}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={s.stats}>
                  <View style={s.stat}>
                    <Text style={theme.font.caption}>{t('fasting.startedAt')}</Text>
                    <Text style={theme.font.heading}>{time(new Date(active.startedAt))}</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={theme.font.caption}>{t('fasting.endsAt')}</Text>
                    <Text style={theme.font.heading}>{endsAt ? time(endsAt) : '—'}</Text>
                  </View>
                </View>
                <View style={s.stage}>
                  <IconCircle
                    icon={STAGE_ICONS[stage]}
                    color={theme.colors.primary}
                    background={theme.colors.primarySoft}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={theme.font.heading}>{t(`fasting.stages.${stage}`)}</Text>
                    <Text style={theme.font.caption}>{t(`fasting.stages.${stage}Hint`)}</Text>
                  </View>
                </View>
                <Button
                  title={progress >= 1 ? t('fasting.finish') : t('fasting.stop')}
                  icon={progress >= 1 ? 'checkmark-circle' : 'stop-circle'}
                  variant={progress >= 1 ? 'primary' : 'secondary'}
                  disabled={busy}
                  onPress={() => stop(active)}
                />
              </Card>
            ) : (
              <Card title={t('fasting.choose')} icon="timer">
                <View style={s.plans}>
                  {FASTING_PLANS.map((p) => {
                    const on = planId === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        onPress={() => setPlanId(p.id)}
                        style={[s.plan, on && s.planOn]}
                      >
                        <Text style={s.planTitle}>{p.id.replace('_', ':')}</Text>
                        <Text style={theme.font.caption}>
                          {t('fasting.planHint', { fast: p.fastHours, eat: 24 - p.fastHours })}
                        </Text>
                        <Text style={[theme.font.caption, { fontWeight: '700' }]}>
                          {t(`fasting.levels.${p.level}`)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={theme.font.caption}>{t('fasting.lastMeal')}</Text>
                <View style={s.chips}>
                  {STARTED_AGO.map((h) => {
                    const on = ago === h;
                    return (
                      <Pressable
                        key={h}
                        accessibilityRole="button"
                        onPress={() => setAgo(h)}
                        style={[s.chip, on && s.chipOn]}
                      >
                        <Text style={[s.chipText, on && { color: '#FFFFFF' }]}>
                          {h === 0 ? t('fasting.now') : t('fasting.hoursAgo', { hours: h })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Button
                  title={t('fasting.start', {
                    hours: getFastingPlan(planId)?.fastHours ?? 0,
                  })}
                  icon="play-circle"
                  disabled={busy}
                  onPress={start}
                />
              </Card>
            )}

            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statValue}>{state.stats.completed}</Text>
                <Text style={theme.font.caption}>{t('fasting.completedCount')}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statValue}>{state.stats.longestHours}</Text>
                <Text style={theme.font.caption}>{t('fasting.longest')}</Text>
              </View>
            </View>

            {state.history.length ? (
              <Card title={t('fasting.history')} icon="time">
                {state.history.map((item) => {
                  const start = new Date(item.startedAt);
                  const hours = (Date.parse(item.endedAt!) - start.getTime()) / HOUR;
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="button"
                      onLongPress={() => removeFast(item)}
                      style={s.historyRow}
                    >
                      <Ionicons
                        name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                        size={22}
                        color={item.completed ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={theme.font.body}>{date(start)}</Text>
                        <Text style={theme.font.caption}>
                          {t('fasting.plan', { plan: item.planId.replace('_', ':') })}
                        </Text>
                      </View>
                      <Text style={[theme.font.body, { fontWeight: '800' }]}>
                        {duration(hours * HOUR)} h
                      </Text>
                    </Pressable>
                  );
                })}
              </Card>
            ) : null}
          </>
        ) : null}

        <Notice tone="info">{t('fasting.warning')}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}
