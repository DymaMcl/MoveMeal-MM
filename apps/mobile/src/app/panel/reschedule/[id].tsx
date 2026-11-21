import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Appointment, type Slot } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Notice, KeyboardScroll } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Nutritionistul muta o programare intr-un interval liber; clientul primeste o notificare. */
export default function Reschedule() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const token = session?.token;
  const locale = localeOf(language);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.panel.appointments(token), api.panel.slots(token)])
      .then(([list, free]) => {
        setAppointment(list.find((a) => a.id === id) ?? null);
        setSlots(free);
      })
      .catch((e) => setError(t(errorKey(e))));
  }, [token, id, t]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const x of slots ?? []) map.set(x.day, [...(map.get(x.day) ?? []), x]);
    return [...map.entries()];
  }, [slots]);

  async function save() {
    if (!token || !selected || !id) return;
    setBusy(true);
    try {
      await api.panel.reschedule(token, id, selected.startsAt, note.trim() || undefined);
      toast(t('panel.rescheduled'));
      router.back();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    day: { ...th.font.body, fontWeight: '700', textTransform: 'capitalize' },
    times: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    time: {
      minWidth: 72,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.border,
      alignItems: 'center',
    },
    timeActive: { backgroundColor: th.colors.primary, borderColor: th.colors.primary },
    timeText: { fontWeight: '700', color: th.colors.text },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
      color: th.colors.text,
    },
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardScroll contentContainerStyle={s.content}>
        <ScreenHeader
          title={t('panel.rescheduleTitle')}
          subtitle={
            appointment
              ? `${appointment.clientName} · ${t('panel.currentTime', {
                  day: formatDay(appointment.day, locale),
                  time: appointment.time,
                })}`
              : undefined
          }
          back
        />
        {error ? <Notice>{error}</Notice> : null}
        {!slots && !error ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : null}
        {slots && slots.length === 0 ? <Notice tone="info">{t('consult.noSlots')}</Notice> : null}
        {byDay.map(([day, list]) => (
          <View key={day} style={{ gap: theme.spacing.sm }}>
            <Text style={s.day}>{formatDay(day, locale, true)}</Text>
            <View style={s.times}>
              {list.map((x) => {
                const active = selected?.startsAt === x.startsAt;
                return (
                  <Pressable
                    key={x.startsAt}
                    accessibilityRole="button"
                    style={[s.time, active && s.timeActive]}
                    onPress={() => setSelected(x)}
                  >
                    <Text style={[s.timeText, active && { color: '#FFFFFF' }]}>{x.time}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        {slots && slots.length > 0 ? (
          <>
            <TextInput
              style={s.input}
              value={note}
              onChangeText={setNote}
              placeholder={t('panel.replyPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              maxLength={500}
            />
            <Button
              title={t('panel.reschedule')}
              icon="swap-horizontal"
              disabled={!selected || busy}
              onPress={save}
            />
          </>
        ) : null}
      </KeyboardScroll>
    </SafeAreaView>
  );
}
