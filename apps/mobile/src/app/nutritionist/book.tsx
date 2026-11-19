import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, type NutritionistCard, type Slot } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, Notice } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Solicitarea unei programari: ziua, ora, mesajul optional si acordul de acces (≤ 5 actiuni). */
export default function Book() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const token = session?.token;
  const locale = localeOf(language);
  const [nutritionist, setNutritionist] = useState<NutritionistCard | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [note, setNote] = useState('');
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    Promise.all([api.nutritionists(token), api.slots(token, id)])
      .then(([list, free]) => {
        setNutritionist(list.find((n) => n.id === id) ?? null);
        setSlots(free);
        setDay(free[0]?.day ?? null);
      })
      .catch((e) => setError(t(errorKey(e))));
  }, [token, id, t]);

  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) map.set(s.day, [...(map.get(s.day) ?? []), s]);
    return [...map.entries()];
  }, [slots]);
  const times = days.find(([d]) => d === day)?.[1] ?? [];

  async function send() {
    if (!token || !slot || !id) return;
    setBusy(true);
    setError(null);
    try {
      await api.book(token, {
        nutritionistId: id,
        startsAt: slot.startsAt,
        note: note.trim() || undefined,
        shareData: share,
      });
      toast(t('consult.sent'));
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const active = e.message.includes('activa');
        setError(t(active ? 'consult.activeExists' : 'consult.slotTaken'));
        if (!active) {
          const free = await api.slots(token, id).catch(() => null);
          if (free) setSlots(free);
          setSlot(null);
        }
      } else {
        setError(t(errorKey(e)));
      }
    } finally {
      setBusy(false);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    label: { ...th.font.heading },
    days: { gap: th.spacing.sm, paddingVertical: 2 },
    day: {
      width: 74,
      paddingVertical: 10,
      borderRadius: th.radius.md,
      borderWidth: 1,
      borderColor: th.colors.border,
      alignItems: 'center',
      gap: 2,
    },
    dayActive: { backgroundColor: th.colors.primary, borderColor: th.colors.primary },
    dayWeek: { ...th.font.caption, fontWeight: '700', textTransform: 'capitalize' },
    dayNum: { fontSize: 18, fontWeight: '800', color: th.colors.text },
    times: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    time: {
      minWidth: 78,
      paddingVertical: 10,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.border,
      alignItems: 'center',
    },
    timeActive: { backgroundColor: th.colors.primary, borderColor: th.colors.primary },
    timeText: { fontWeight: '700', color: th.colors.text, fontSize: 15 },
    input: {
      minHeight: 90,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      padding: th.spacing.md,
      color: th.colors.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    body: { ...th.font.body, flex: 1, fontSize: 14 },
    summary: { ...th.font.heading, color: th.colors.primary },
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={t('consult.book')} subtitle={nutritionist?.displayName} back />
          {error ? <Notice>{error}</Notice> : null}
          {!slots && !error ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : null}
          {slots && slots.length === 0 ? <Notice tone="info">{t('consult.noSlots')}</Notice> : null}

          {days.length > 0 ? (
            <>
              <Text style={s.label}>{t('consult.chooseDay')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.days}
              >
                {days.map(([d]) => {
                  const active = d === day;
                  const date = new Date(
                    Number(d.slice(0, 4)),
                    Number(d.slice(5, 7)) - 1,
                    Number(d.slice(8)),
                    12,
                  );
                  const weekday = date.toLocaleDateString(locale, { weekday: 'short' });
                  const month = date.toLocaleDateString(locale, { month: 'short' });
                  return (
                    <Pressable
                      key={d}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[s.day, active && s.dayActive]}
                      onPress={() => {
                        setDay(d);
                        setSlot(null);
                      }}
                    >
                      <Text style={[s.dayWeek, active && { color: 'rgba(255,255,255,0.85)' }]}>
                        {weekday}
                      </Text>
                      <Text style={[s.dayNum, active && { color: '#FFFFFF' }]}>
                        {Number(d.slice(8))}
                      </Text>
                      <Text
                        style={[s.dayWeek, { fontWeight: '500' }, active && { color: '#FFFFFF' }]}
                        numberOfLines={1}
                      >
                        {month}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={s.label}>{t('consult.chooseTime')}</Text>
              <View style={s.times}>
                {times.map((x) => {
                  const active = slot?.startsAt === x.startsAt;
                  return (
                    <Pressable
                      key={x.startsAt}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[s.time, active && s.timeActive]}
                      onPress={() => setSlot(x)}
                    >
                      <Text style={[s.timeText, active && { color: '#FFFFFF' }]}>{x.time}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={s.label}>{t('consult.note')}</Text>
              <TextInput
                style={s.input}
                value={note}
                onChangeText={setNote}
                placeholder={t('consult.notePlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                multiline
                maxLength={500}
              />

              <Card>
                <View style={s.switchRow}>
                  <Text style={s.body}>{t('consult.share')}</Text>
                  <Switch
                    value={share}
                    onValueChange={setShare}
                    trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceAlt }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <Text style={theme.font.caption}>{t('consult.accessText')}</Text>
              </Card>

              {slot && nutritionist ? (
                <Text style={s.summary}>
                  {t('consult.summary', {
                    day: formatDay(slot.day, locale, true),
                    time: slot.time,
                    min: nutritionist.slotMinutes,
                  })}
                </Text>
              ) : null}
              <Button
                title={t('consult.send')}
                icon="send"
                disabled={!slot || busy}
                onPress={send}
              />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
