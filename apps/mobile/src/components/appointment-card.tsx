import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import type { Appointment } from '@/api/client';
import { localeOf, useI18n } from '@/i18n';
import { formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Starea afisata: o programare confirmata al carei interval a trecut este „incheiata”. */
export function displayStatus(a: Appointment) {
  return a.status === 'confirmed' && a.past ? 'done' : a.status;
}

/** Cardul unei programari (folosit de utilizator si de nutritionist). */
export function AppointmentCard({
  appointment,
  title,
  children,
}: {
  appointment: Appointment;
  /** Numele celeilalte parti (nutritionistul sau clientul). */
  title: string;
  children?: ReactNode;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const status = displayStatus(appointment);
  const tone =
    status === 'confirmed'
      ? theme.colors.primary
      : status === 'requested'
        ? theme.colors.warning
        : theme.colors.textMuted;
  const s = useStyles((th) => ({
    card: {
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.lg,
      padding: th.spacing.md,
      gap: th.spacing.sm,
      backgroundColor: th.colors.surface,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    date: { ...th.font.heading, flex: 1 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: th.radius.pill,
      borderWidth: 1,
    },
    pillText: { fontSize: 12, fontWeight: '800' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { ...th.font.caption },
    note: { ...th.font.body, fontSize: 14 },
    free: { color: th.colors.primary, fontWeight: '800', fontSize: 12 },
  }));
  return (
    <View style={s.card}>
      <View style={s.head}>
        <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
        <Text style={s.date}>
          {t('consult.when', {
            day: formatDay(appointment.day, localeOf(language)),
            time: appointment.time,
          })}
        </Text>
        <View style={[s.pill, { borderColor: tone }]}>
          <Text style={[s.pillText, { color: tone }]}>{t(`consult.status.${status}`)}</Text>
        </View>
      </View>
      <View style={s.meta}>
        <Ionicons name="person-outline" size={14} color={theme.colors.textMuted} />
        <Text style={s.metaText}>
          {title} · {t('consult.duration', { min: appointment.durationMin })}
        </Text>
        {appointment.free ? <Text style={s.free}>· {t('consult.free')}</Text> : null}
      </View>
      {children}
    </View>
  );
}
