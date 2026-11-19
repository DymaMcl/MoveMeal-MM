import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  api,
  type Appointment,
  type ClientSummary,
  type NutritionistCard,
  type Schedule,
} from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { Notice, Segmented } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { AppointmentsSection } from '@/panel/appointments-section';
import { ProfileSection } from '@/panel/profile-section';
import { ScheduleSection } from '@/panel/schedule-section';
import { useAppState } from '@/state/app-state';
import { formatDate, formatDay } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

type Tab = 'appointments' | 'schedule' | 'clients' | 'profile';

/** Panoul nutritionistului (doar pentru contul cu rolul „nutritionist”; verificat si pe server). */
export default function Panel() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const token = session?.token;
  const [tab, setTab] = useState<Tab>('appointments');
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [clients, setClients] = useState<ClientSummary[] | null>(null);
  const [profile, setProfile] = useState<NutritionistCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [a, sch, c, p] = await Promise.all([
        api.panel.appointments(token),
        api.panel.schedule(token),
        api.panel.clients(token),
        api.panel.profile(token),
      ]);
      setAppointments(a);
      setSchedule(sch);
      setClients(c);
      setProfile(p);
      setError(null);
    } catch (e) {
      setError(t(errorKey(e)));
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    client: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: th.colors.primary, fontWeight: '900', fontSize: 18 },
    name: { ...th.font.heading },
    meta: { ...th.font.caption },
  }));

  if (session && session.role !== 'nutritionist') return <Redirect href="/" />;

  const locale = localeOf(language);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('panel.title')} subtitle={profile?.displayName} />
        <Segmented
          options={[
            {
              value: 'appointments' as Tab,
              label: t('panel.tabs.appointments'),
            },
            { value: 'schedule' as Tab, label: t('panel.tabs.schedule') },
            { value: 'clients' as Tab, label: t('panel.tabs.clients') },
            { value: 'profile' as Tab, label: t('panel.tabs.profile') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {error ? <Notice>{error}</Notice> : null}
        {!appointments && !error ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : null}

        {token && tab === 'appointments' && appointments ? (
          <AppointmentsSection token={token} appointments={appointments} onChanged={load} />
        ) : null}
        {token && tab === 'schedule' && schedule ? (
          <ScheduleSection token={token} schedule={schedule} onChanged={setSchedule} />
        ) : null}
        {token && tab === 'profile' && profile ? (
          <ProfileSection token={token} profile={profile} onSaved={setProfile} />
        ) : null}
        {tab === 'clients' && clients ? (
          <View style={{ gap: theme.spacing.sm }}>
            {clients.length === 0 ? <Notice tone="info">{t('panel.noClients')}</Notice> : null}
            {clients.map((c) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                style={({ pressed }) => [s.client, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  router.push({ pathname: '/panel/client/[id]', params: { id: c.id } })
                }
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.name}>{c.name}</Text>
                  <Text style={s.meta}>
                    {[
                      c.goal ? t(`onboarding.goal.${c.goal}`) : null,
                      c.weightKg ? `${c.weightKg} ${t('common.kg')}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={s.meta}>
                    {c.lastWeighIn
                      ? t('panel.lastWeighIn', { date: formatDay(c.lastWeighIn, locale) })
                      : t('panel.since', { date: formatDate(c.grantedAt, locale) })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
