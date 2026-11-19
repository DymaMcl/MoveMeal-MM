import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, type Schedule, type WorkHour } from '@/api/client';
import { errorKey } from '@/api/errors';
import { useToast } from '@/components/toast';
import { Button, Card, Notice } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { isoDate } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

/** Programul saptamanal si zilele libere ale nutritionistului. */
export function ScheduleSection({
  token,
  schedule,
  onChanged,
}: {
  token: string;
  schedule: Schedule;
  onChanged: (schedule: Schedule) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [hours, setHours] = useState<WorkHour[]>(schedule.hours);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => setHours(schedule.hours), [schedule.hours]);

  const next14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  function update(index: number, patch: Partial<WorkHour>) {
    setHours((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  async function save() {
    const bad = hours.some(
      (h) => !TIME.test(h.start) || !TIME.test(h.end) || minutes(h.end) <= minutes(h.start),
    );
    setInvalid(bad);
    if (bad) return;
    setBusy(true);
    try {
      onChanged(await api.panel.setHours(token, hours));
      toast(t('panel.hoursSaved'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  async function toggleDay(day: string) {
    try {
      onChanged(await api.panel.setDayOff(token, day, !schedule.daysOff.includes(day)));
      toast(t('panel.dayOffSaved'));
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  const s = useStyles((th) => ({
    day: {
      gap: th.spacing.sm,
      paddingVertical: th.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: th.colors.border,
    },
    dayHead: { flexDirection: 'row', alignItems: 'center' },
    dayName: { ...th.font.body, fontWeight: '700', flex: 1 },
    closed: { ...th.font.caption },
    interval: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    time: {
      width: 82,
      minHeight: 42,
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      textAlign: 'center',
      color: th.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    dash: { ...th.font.body },
    icon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surfaceAlt,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    chip: {
      width: 64,
      paddingVertical: 8,
      borderRadius: th.radius.md,
      borderWidth: 1,
      borderColor: th.colors.border,
      alignItems: 'center',
    },
    chipOff: { backgroundColor: th.colors.surfaceAlt, borderStyle: 'dashed' },
    chipWeek: { ...th.font.caption, fontSize: 11, textTransform: 'capitalize' },
    chipNum: { fontWeight: '800', fontSize: 16, color: th.colors.text },
  }));

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Notice tone="info">{t('panel.freeSlots', { n: schedule.freeSlots })}</Notice>
      <Card title={t('panel.weeklyHours')} icon="time-outline">
        {Array.from({ length: 7 }, (_, wd) => {
          const items = hours.map((h, i) => ({ h, i })).filter(({ h }) => h.weekday === wd);
          return (
            <View key={wd} style={s.day}>
              <View style={s.dayHead}>
                <Text style={s.dayName}>{t(`workout.weekdays.${wd}`)}</Text>
                {items.length === 0 ? <Text style={s.closed}>{t('panel.dayClosed')}</Text> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('panel.addInterval')}
                  style={[s.icon, { marginLeft: theme.spacing.sm }]}
                  onPress={() =>
                    setHours((prev) => [...prev, { weekday: wd, start: '09:00', end: '17:00' }])
                  }
                >
                  <Ionicons name="add" size={20} color={theme.colors.primary} />
                </Pressable>
              </View>
              {items.map(({ h, i }) => (
                <View key={i} style={s.interval}>
                  <TextInput
                    style={s.time}
                    value={h.start}
                    onChangeText={(v) => update(i, { start: v })}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    accessibilityLabel={t('panel.from')}
                  />
                  <Text style={s.dash}>–</Text>
                  <TextInput
                    style={s.time}
                    value={h.end}
                    onChangeText={(v) => update(i, { end: v })}
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                    accessibilityLabel={t('panel.to')}
                  />
                  <View style={{ flex: 1 }} />
                  <Pressable
                    accessibilityRole="button"
                    style={s.icon}
                    onPress={() => setHours((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
          );
        })}
        {invalid ? <Notice>{t('panel.invalidTime')}</Notice> : null}
        <Button title={t('panel.saveHours')} icon="save-outline" disabled={busy} onPress={save} />
      </Card>

      <Card title={t('panel.daysOff')} icon="calendar-outline">
        <Text style={theme.font.caption}>{t('panel.daysOffHint')}</Text>
        <View style={s.grid}>
          {next14.map((d) => {
            const day = isoDate(d);
            const off = schedule.daysOff.includes(day);
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: off }}
                style={[s.chip, off && s.chipOff]}
                onPress={() => toggleDay(day)}
              >
                <Text style={s.chipWeek}>
                  {d.toLocaleDateString(localeOf(language), { weekday: 'short' })}
                </Text>
                <Text style={[s.chipNum, off && { color: theme.colors.textMuted }]}>
                  {d.getDate()}
                </Text>
                {off ? (
                  <Ionicons name="close" size={14} color={theme.colors.danger} />
                ) : (
                  <Ionicons name="checkmark" size={14} color={theme.colors.primary} />
                )}
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}
