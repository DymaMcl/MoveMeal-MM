import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Appointment, type ConsultationOffer, type NutritionistCard } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { AppointmentCard, displayStatus } from '@/components/appointment-card';
import { RemoteImage } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Card, Notice } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDate } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Pagina „Nutritionist” a utilizatorului: profilul specialistului, oferta, programarile, acordul. */
/** Forma corecta de plural pentru anii de experienta (ro: an / ani / de ani; ru: год / года / лет). */
function experienceKey(years: number, language: string): string {
  if (language === 'ru') {
    const last = years % 10;
    const lastTwo = years % 100;
    if (last === 1 && lastTwo !== 11) return 'consult.experienceOne';
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return 'consult.experience';
    return 'consult.experienceMany';
  }
  if (years === 1) return 'consult.experienceOne';
  if (language === 'ro' && (years === 0 || years % 100 >= 20)) return 'consult.experienceMany';
  return 'consult.experience';
}

export default function NutritionistPage() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session, targetSource } = useAppState();
  const token = session?.token;
  const [nutritionists, setNutritionists] = useState<NutritionistCard[] | null>(null);
  const [offer, setOffer] = useState<ConsultationOffer | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [access, setAccess] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [list, o, mine, acc] = await Promise.all([
        api.nutritionists(token),
        api.consultationOffer(token),
        api.appointments(token),
        api.nutritionistAccess(token),
      ]);
      setNutritionists(list);
      setOffer(o);
      setAppointments(mine);
      setAccess(acc);
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
    hero: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: th.spacing.sm },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#FFFFFF', fontSize: 26, fontWeight: '900' },
    photo: {
      width: 88,
      height: 88,
      borderRadius: 44,
      borderWidth: 3,
      borderColor: 'rgba(255,255,255,0.85)',
    },
    name: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
    heroText: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm, marginTop: 4 },
    fact: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: th.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    factText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    body: { ...th.font.body, lineHeight: 22 },
    label: {
      ...th.font.caption,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    service: { flexDirection: 'row', gap: th.spacing.sm },
    bullet: { color: th.colors.primary, fontWeight: '900' },
    offerTitle: { ...th.font.heading, color: th.colors.primary },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    section: { ...th.font.heading, marginTop: th.spacing.sm },
    note: { ...th.font.caption, color: th.colors.text },
    cancel: { alignSelf: 'flex-start' },
    cancelText: { color: th.colors.danger, fontWeight: '700' },
  }));

  const nutritionist = nutritionists?.[0];
  const upcoming = appointments.filter(
    (a) => !a.past && (a.status === 'requested' || a.status === 'confirmed'),
  );
  const history = appointments.filter((a) => !upcoming.includes(a));
  const hasAccess = nutritionist ? access.includes(nutritionist.id) : false;

  async function toggleAccess(granted: boolean) {
    if (!token || !nutritionist) return;
    try {
      setAccess(await api.setNutritionistAccess(token, nutritionist.id, granted));
      toast(t(granted ? 'consult.accessGranted' : 'consult.accessRevoked'));
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  function cancel(a: Appointment) {
    Alert.alert(t('consult.cancel'), t('consult.cancelConfirm'), [
      { text: t('consult.no'), style: 'cancel' },
      {
        text: t('consult.yes'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.cancelAppointment(token, a.id);
            toast(t('consult.cancelled'));
            load();
          } catch (e) {
            toast(t(errorKey(e)));
          }
        },
      },
    ]);
  }

  const offerDate = offer ? formatDate(offer.expiresAt, localeOf(language)) : '';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('consult.title')} back />
        {error ? <Notice>{error}</Notice> : null}
        {!nutritionists && !error ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
        ) : null}
        {nutritionists && !nutritionist ? <Notice tone="info">{t('consult.none')}</Notice> : null}

        {targetSource.adjustedBy === 'nutritionist' ? (
          <Card title={t('consult.adjustedBadge')} icon="checkmark-circle-outline">
            {targetSource.nutritionistNote ? (
              <Text style={s.body}>{targetSource.nutritionistNote}</Text>
            ) : null}
          </Card>
        ) : null}

        {nutritionist ? (
          <>
            <LinearGradient
              colors={theme.gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              <View style={s.heroRow}>
                {nutritionist.avatarId ? (
                  <RemoteImage mediaId={nutritionist.avatarId} style={s.photo} />
                ) : (
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>
                      {nutritionist.displayName
                        .replace(/^Dr\.?\s*/i, '')
                        .charAt(0)
                        .toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{nutritionist.displayName}</Text>
                  {nutritionist.title ? <Text style={s.heroText}>{nutritionist.title}</Text> : null}
                </View>
              </View>
              <View style={s.facts}>
                {nutritionist.experienceYears > 0 ? (
                  <View style={s.fact}>
                    <Text style={s.factText}>
                      {t(experienceKey(nutritionist.experienceYears, language), {
                        years: nutritionist.experienceYears,
                      })}
                    </Text>
                  </View>
                ) : null}
                <View style={s.fact}>
                  <Text style={s.factText}>
                    {t('consult.duration', { min: nutritionist.slotMinutes })}
                  </Text>
                </View>
                <View style={s.fact}>
                  <Text style={s.factText}>
                    {nutritionist.priceMdl > 0
                      ? t('consult.priceValue', { price: nutritionist.priceMdl })
                      : t('consult.free')}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {offer ? (
              <Card>
                <Text style={s.offerTitle}>{t('consult.offerTitle')}</Text>
                <Text style={s.body}>
                  {upcoming.some((a) => a.free)
                    ? t('consult.offerApplied')
                    : offer.eligible
                      ? t('consult.offerText', { date: offerDate })
                      : offer.used
                        ? t('consult.offerUsed')
                        : t('consult.offerExpired', { date: offerDate })}
                </Text>
                <Text style={theme.font.caption}>
                  {t('consult.offerConditions', {
                    // In romana: „30 de zile”, dar „5 zile”.
                    days:
                      language === 'ro' && (offer.days % 100 === 0 || offer.days % 100 >= 20)
                        ? `${offer.days} de`
                        : offer.days,
                  })}
                </Text>
              </Card>
            ) : null}

            {upcoming.length === 0 ? (
              <Button
                title={t('consult.book')}
                icon="calendar"
                onPress={() =>
                  router.push({
                    pathname: '/nutritionist/book',
                    params: { id: nutritionist.id },
                  })
                }
              />
            ) : null}

            {nutritionist.bio ? (
              <Card title={t('consult.about')} icon="information-circle-outline">
                <Text style={s.body}>{nutritionist.bio}</Text>
              </Card>
            ) : null}
            {nutritionist.qualifications || nutritionist.services ? (
              <Card>
                {nutritionist.qualifications ? (
                  <>
                    <Text style={s.label}>{t('consult.qualifications')}</Text>
                    <Text style={s.body}>{nutritionist.qualifications}</Text>
                  </>
                ) : null}
                {nutritionist.services ? (
                  <>
                    <Text style={s.label}>{t('consult.services')}</Text>
                    {nutritionist.services
                      .split('\n')
                      .filter((x) => x.trim())
                      .map((line) => (
                        <View key={line} style={s.service}>
                          <Text style={s.bullet}>•</Text>
                          <Text style={[s.body, { flex: 1 }]}>{line.trim()}</Text>
                        </View>
                      ))}
                  </>
                ) : null}
              </Card>
            ) : null}

            <Text style={s.section}>{t('consult.myAppointments')}</Text>
            {upcoming.length === 0 && history.length === 0 ? (
              <Text style={theme.font.caption}>{t('consult.noAppointments')}</Text>
            ) : null}
            {upcoming.map((a) => (
              <AppointmentCard key={a.id} appointment={a} title={a.nutritionistName}>
                {a.nutritionistNote ? (
                  <Text style={s.note}>{t('consult.noteFrom', { note: a.nutritionistNote })}</Text>
                ) : null}
                <Pressable accessibilityRole="button" style={s.cancel} onPress={() => cancel(a)}>
                  <Text style={s.cancelText}>{t('consult.cancel')}</Text>
                </Pressable>
              </AppointmentCard>
            ))}
            {history.length > 0 ? (
              <>
                <Text style={[theme.font.caption, { fontWeight: '800' }]}>
                  {t('consult.history')}
                </Text>
                {history.map((a) => (
                  <AppointmentCard key={a.id} appointment={a} title={a.nutritionistName}>
                    {a.nutritionistNote && displayStatus(a) !== 'cancelled' ? (
                      <Text style={s.note}>
                        {t('consult.noteFrom', { note: a.nutritionistNote })}
                      </Text>
                    ) : null}
                  </AppointmentCard>
                ))}
              </>
            ) : null}

            <Card title={t('consult.accessTitle')} icon="lock-closed-outline">
              <View style={s.switchRow}>
                <Text style={[s.body, { flex: 1, fontSize: 14 }]}>{t('consult.accessText')}</Text>
                <Switch
                  value={hasAccess}
                  onValueChange={toggleAccess}
                  trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceAlt }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
