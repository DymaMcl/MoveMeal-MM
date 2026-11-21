import {
  LEVEL_DAYS,
  MAX_FOCUS_GROUPS,
  validatePreferences,
  type Equipment,
  type Limitation,
  type MuscleGroup,
  type Sport,
  type Weekday,
  type WorkoutLevel,
  type WorkoutLocation,
  type WorkoutPreferences,
} from '@movemeal/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { errorKey } from '@/api/errors';
import { Chips } from '@/components/chips';
import {
  Button,
  Notice,
  OptionCard,
  Screen,
  Segmented,
  StepIndicator,
  Subtitle,
  Title,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { useWorkout } from '@/state/workout-state';
import { useStyles, useTheme } from '@/theme';

type Step = 'location' | 'schedule' | 'equipment' | 'health' | 'focus';

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const EQUIPMENT: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'pullup_bar', 'bench'];
const SPORTS: Sport[] = ['running', 'cycling', 'swimming', 'football', 'other'];
const LIMITATIONS: Limitation[] = ['knees', 'lower_back', 'shoulders', 'wrists'];
const GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes'];
const LEVELS: WorkoutLevel[] = ['light', 'moderate', 'intense'];

/** Zile implicite, distantate, pentru fiecare nivel. */
const DEFAULT_DAYS: Record<WorkoutLevel, Weekday[]> = {
  light: [0, 3],
  moderate: [0, 2, 4],
  intense: [0, 1, 2, 3, 4],
};

type Place = 'home' | 'gym';

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function WorkoutSetup() {
  const { t } = useI18n();
  const theme = useTheme();
  const { program, save } = useWorkout();
  const initial = program?.preferences;

  const [location, setLocation] = useState<WorkoutLocation | undefined>(initial?.location);
  const [level, setLevel] = useState<WorkoutLevel | undefined>(initial?.level);
  const [days, setDays] = useState<Weekday[]>(initial?.days ?? []);
  /** Antrenamentul mixt: zilele de acasa (celelalte sunt la sala). */
  const [homeDays, setHomeDays] = useState<Weekday[]>(initial?.homeDays ?? []);
  const [equipment, setEquipment] = useState<Equipment[]>(initial?.equipment ?? []);
  const [sports, setSports] = useState<Sport[]>(initial?.sports ?? []);
  const [limitations, setLimitations] = useState<Limitation[]>(initial?.limitations ?? []);
  const [focus, setFocus] = useState<MuscleGroup[]>(initial?.focus ?? []);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useStyles((th) => ({
    section: { gap: th.spacing.sm + 2, marginTop: th.spacing.sm },
    label: { ...th.font.heading },
    hint: { ...th.font.caption },
    summary: {
      flexDirection: 'row',
      gap: th.spacing.sm,
    },
    summaryItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: th.spacing.sm + 2,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.primarySoft,
    },
    summaryText: { fontWeight: '800', color: th.colors.primaryStrong },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    dayName: { ...th.font.body, fontWeight: '700', width: 96 },
  }));

  const steps: Step[] = [
    'location',
    'schedule',
    ...(location === 'home' || location === 'mixed' ? (['equipment'] as Step[]) : []),
    'health',
    'focus',
  ];
  const step = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;

  const range = level ? LEVEL_DAYS[level] : null;
  const prefs: WorkoutPreferences | null =
    location && level
      ? {
          location,
          level,
          days,
          equipment: location === 'gym' ? [] : equipment,
          ...(location === 'mixed' ? { homeDays: homeDays.filter((d) => days.includes(d)) } : {}),
          sports,
          limitations,
          focus,
        }
      : null;
  const scheduleErrors = prefs ? validatePreferences(prefs) : [];
  const scheduleValid =
    !!prefs && !scheduleErrors.includes('days_count') && !scheduleErrors.includes('mixed_days');
  const sortedDays = [...days].sort((a, b) => a - b);
  const homeCount = sortedDays.filter((d) => homeDays.includes(d)).length;
  const gymCount = sortedDays.length - homeCount;

  function setPlace(day: Weekday, place: Place) {
    setHomeDays((prev) =>
      place === 'home' ? [...prev.filter((d) => d !== day), day] : prev.filter((d) => d !== day),
    );
  }

  const canContinue =
    (step === 'location' && !!location) ||
    (step === 'schedule' && scheduleValid) ||
    step === 'equipment' ||
    step === 'health' ||
    step === 'focus';

  function chooseLevel(next: WorkoutLevel) {
    setLevel(next);
    const { min, max } = LEVEL_DAYS[next];
    if (days.length < min || days.length > max) setDays(DEFAULT_DAYS[next]);
  }

  async function onNext() {
    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }
    if (!prefs) return;
    setBusy(true);
    setError(null);
    try {
      await save(prefs);
      router.back();
    } catch (e) {
      setError(
        errorKey(e) === 'errors.network' ? t('errors.network') : t('workout.setup.saveError'),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title={isLast ? t('workout.setup.generate') : t('common.continue')}
            icon={isLast ? 'sparkles' : undefined}
            onPress={onNext}
            disabled={!canContinue || busy}
          />
          <Button
            title={t('common.back')}
            variant="ghost"
            onPress={() => (index === 0 ? router.back() : setIndex((i) => i - 1))}
          />
        </>
      }
    >
      <StepIndicator
        label={t('onboarding.step', { current: index + 1, total: steps.length })}
        current={index + 1}
        total={steps.length}
      />

      {step === 'location' ? (
        <>
          <Title>{t('workout.setup.locationTitle')}</Title>
          <OptionCard
            title={t('workout.setup.home')}
            hint={t('workout.setup.homeHint')}
            icon="home"
            selected={location === 'home'}
            onPress={() => setLocation('home')}
          />
          <OptionCard
            title={t('workout.setup.gym')}
            hint={t('workout.setup.gymHint')}
            icon="barbell"
            selected={location === 'gym'}
            onPress={() => setLocation('gym')}
          />
          <OptionCard
            title={t('workout.setup.mixed')}
            hint={t('workout.setup.mixedHint')}
            icon="swap-horizontal"
            selected={location === 'mixed'}
            onPress={() => setLocation('mixed')}
          />
        </>
      ) : null}

      {step === 'schedule' ? (
        <>
          <Title>{t('workout.setup.levelTitle')}</Title>
          {LEVELS.map((l) => (
            <OptionCard
              key={l}
              title={t(`workout.setup.${l}`)}
              hint={t(`workout.setup.${l}Hint`)}
              icon={l === 'light' ? 'leaf' : l === 'moderate' ? 'fitness' : 'flame'}
              selected={level === l}
              onPress={() => chooseLevel(l)}
            />
          ))}
          {range ? (
            <View style={s.section}>
              <Text style={s.label}>{t('workout.setup.daysTitle')}</Text>
              <Text style={s.hint}>
                {range.min === range.max
                  ? t('workout.setup.daysHintExact', range)
                  : t('workout.setup.daysHint', range)}
              </Text>
              <Chips
                options={WEEKDAYS.map((d) => ({ value: d, label: t(`workout.weekdays.${d}`) }))}
                selected={days}
                onToggle={(d) => setDays((prev) => toggleIn(prev, d))}
                disabled={() => days.length >= range.max}
              />
            </View>
          ) : null}
          {location === 'mixed' && range && sortedDays.length > 0 ? (
            <View style={s.section}>
              <Text style={s.label}>{t('workout.setup.mixedTitle')}</Text>
              <Text style={s.hint}>{t('workout.setup.mixedDaysHint')}</Text>
              <View style={s.summary}>
                <View style={s.summaryItem}>
                  <Ionicons name="home" size={18} color={theme.colors.primary} />
                  <Text style={s.summaryText}>
                    {t('workout.setup.homeCount', { n: homeCount })}
                  </Text>
                </View>
                <View style={s.summaryItem}>
                  <Ionicons name="barbell" size={18} color={theme.colors.primary} />
                  <Text style={s.summaryText}>{t('workout.setup.gymCount', { n: gymCount })}</Text>
                </View>
              </View>
              {sortedDays.map((d) => (
                <View key={d} style={s.dayRow}>
                  <Text style={s.dayName}>{t(`workout.weekdays.${d}`)}</Text>
                  <View style={{ flex: 1 }}>
                    <Segmented
                      options={[
                        { value: 'home' as Place, label: t('workout.setup.home'), icon: 'home' },
                        { value: 'gym' as Place, label: t('workout.setup.gym'), icon: 'barbell' },
                      ]}
                      value={homeDays.includes(d) ? 'home' : 'gym'}
                      onChange={(place) => setPlace(d, place)}
                    />
                  </View>
                </View>
              ))}
              {scheduleErrors.includes('mixed_days') && !scheduleErrors.includes('days_count') ? (
                <Notice tone="info">{t('workout.setup.mixedInvalid')}</Notice>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      {step === 'equipment' ? (
        <>
          <Title>{t('workout.setup.equipmentTitle')}</Title>
          <Subtitle>
            {location === 'mixed'
              ? t('workout.setup.equipmentHintMixed')
              : t('workout.setup.equipmentHint')}
          </Subtitle>
          <Chips
            options={EQUIPMENT.map((e) => ({ value: e, label: t(`workout.setup.equipment.${e}`) }))}
            selected={equipment}
            onToggle={(e) => setEquipment((prev) => toggleIn(prev, e))}
          />
        </>
      ) : null}

      {step === 'health' ? (
        <>
          <Title>{t('workout.setup.sportsTitle')}</Title>
          <Chips
            options={SPORTS.map((x) => ({ value: x, label: t(`workout.setup.sports.${x}`) }))}
            selected={sports}
            onToggle={(x) => setSports((prev) => toggleIn(prev, x))}
          />
          <View style={s.section}>
            <Text style={s.label}>{t('workout.setup.limitationsTitle')}</Text>
            <Text style={s.hint}>{t('workout.setup.limitationsHint')}</Text>
            <Chips
              options={LIMITATIONS.map((x) => ({
                value: x,
                label: t(`workout.setup.limitations.${x}`),
              }))}
              selected={limitations}
              onToggle={(x) => setLimitations((prev) => toggleIn(prev, x))}
            />
          </View>
          <Notice tone="info">{t('common.disclaimer')}</Notice>
        </>
      ) : null}

      {step === 'focus' ? (
        <>
          <Title>{t('workout.setup.focusTitle')}</Title>
          <Subtitle>{t('workout.setup.focusHint')}</Subtitle>
          <Chips
            options={GROUPS.map((g) => ({ value: g, label: t(`workout.groups.${g}`) }))}
            selected={focus}
            onToggle={(g) => setFocus((prev) => toggleIn(prev, g))}
            disabled={() => focus.length >= MAX_FOCUS_GROUPS}
          />
          {error ? <Notice>{error}</Notice> : null}
        </>
      ) : null}
    </Screen>
  );
}
