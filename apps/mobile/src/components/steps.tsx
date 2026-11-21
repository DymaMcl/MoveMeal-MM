import { Ionicons } from '@expo/vector-icons';
import { DAILY_STEPS_GOAL } from '@movemeal/shared';
import { Pedometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { api, type StepsDay } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ActionSheet } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Field, Notice } from '@/components/ui';
import { formatNumber, localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isoDate } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Pasii de azi, cititi din telefon (iOS) sau introdusi manual, si ultimele 7 zile. */
export function StepsSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved: (steps: number) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [week, setWeek] = useState<StepsDay[] | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [source, setSource] = useState<'manual' | 'device'>('manual');
  const [deviceAvailable, setDeviceAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = isoDate(new Date());

  useEffect(() => {
    if (!visible || !session) return;
    setError(null);
    setSource('manual');
    api
      .steps(session.token, 7)
      .then((days) => {
        setWeek(days);
        const current = days.find((d) => d.day === today);
        setText(current ? String(current.steps) : '');
      })
      .catch(() => setWeek([]));
    // Pe iPhone pasii zilei se pot citi direct din senzorul telefonului.
    if (Platform.OS === 'ios') {
      Pedometer.isAvailableAsync()
        .then(setDeviceAvailable)
        .catch(() => setDeviceAvailable(false));
    }
  }, [visible, session, today]);

  const s = useStyles((th) => ({
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 6,
      height: 110,
      paddingTop: th.spacing.sm,
    },
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
    hint: { ...th.font.caption, fontSize: 12 },
  }));

  async function readDevice() {
    setReading(true);
    setError(null);
    try {
      const permission = await Pedometer.requestPermissionsAsync();
      if (!permission.granted) {
        setError(t('steps.permission'));
        return;
      }
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const result = await Pedometer.getStepCountAsync(start, new Date());
      setText(String(result.steps));
      setSource('device');
    } catch {
      setError(t('steps.deviceError'));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!session) return;
    const steps = Number(text.replace(/\D/g, ''));
    if (!Number.isFinite(steps) || steps > 100_000) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.setSteps(session.token, { day: today, steps, source });
      onSaved(steps);
      if (res.trophies.length) {
        toast(t('steps.trophy', { trophy: t(`trophies.${res.trophies[0]}.title`) }));
      } else {
        toast(t('steps.saved'));
      }
      onClose();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  // Ultimele 7 zile (inclusiv azi), cu zilele fara date la 0.
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const day = isoDate(date);
    const saved = week?.find((d) => d.day === day)?.steps ?? 0;
    const value = day === today && text ? Number(text.replace(/\D/g, '')) || 0 : saved;
    return { day, date, value };
  });
  const max = Math.max(DAILY_STEPS_GOAL * 1.2, ...days.map((d) => d.value));
  const steps = Number(text.replace(/\D/g, '')) || 0;
  const valid = text.trim() !== '' && steps <= 100_000;

  return (
    <ActionSheet visible={visible} title={t('steps.title')} onClose={onClose}>
      <View style={{ gap: 12 }}>
        {week === null ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : (
          <View>
            <View style={s.chart}>
              <View
                pointerEvents="none"
                style={[s.goalLine, { bottom: 22 + (DAILY_STEPS_GOAL / max) * 80 }]}
              />
              {days.map((d) => {
                const reached = d.value >= DAILY_STEPS_GOAL;
                return (
                  <View key={d.day} style={s.col}>
                    <View
                      style={[
                        s.bar,
                        {
                          height: Math.max(4, (d.value / max) * 80),
                          backgroundColor: reached ? theme.colors.primary : theme.colors.info,
                          opacity: d.value ? 1 : 0.25,
                        },
                      ]}
                    />
                    <Text style={[s.dayLabel, d.day === today && { fontWeight: '800' }]}>
                      {d.date.toLocaleDateString(localeOf(language), { weekday: 'narrow' })}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={s.hint}>
              {t('steps.goalHint', { goal: formatNumber(DAILY_STEPS_GOAL, language, 0) })}
            </Text>
          </View>
        )}

        <Field
          label={t('steps.today')}
          value={text}
          onChangeText={(v) => {
            setText(v.replace(/\D/g, ''));
            setSource('manual');
          }}
          onClear={() => setText('')}
          keyboardType="number-pad"
          maxLength={6}
          icon="footsteps-outline"
          placeholder="8500"
          suffix={t('home.steps').toLowerCase()}
        />
        {deviceAvailable ? (
          <Button
            title={reading ? t('steps.reading') : t('steps.readDevice')}
            icon="phone-portrait-outline"
            variant="secondary"
            disabled={reading}
            onPress={readDevice}
          />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Ionicons name="information-circle-outline" size={18} color={theme.colors.textMuted} />
            <Text style={[s.hint, { flex: 1 }]}>{t('steps.manualHint')}</Text>
          </View>
        )}
        {error ? <Notice>{error}</Notice> : null}
        <Button
          title={t('common.save')}
          icon="checkmark"
          disabled={!valid || busy}
          onPress={save}
        />
      </View>
    </ActionSheet>
  );
}
