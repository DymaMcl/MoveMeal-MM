import { assessBody, LIMITS, type BodyStatus, type Sex } from '@movemeal/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/app-menu';
import {
  Button,
  Card,
  Field,
  Notice,
  parseNumber,
  Segmented,
  KeyboardScroll,
} from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** Scala IMC afisata: 15 … 40. */
const SCALE_MIN = 15;
const SCALE_MAX = 40;
const SEGMENTS: { status: BodyStatus; from: number; to: number }[] = [
  { status: 'under', from: SCALE_MIN, to: 18.5 },
  { status: 'normal', from: 18.5, to: 25 },
  { status: 'over', from: 25, to: 30 },
  { status: 'obese', from: 30, to: SCALE_MAX },
];

const inRange = (value: number | undefined, min: number, max: number) =>
  value !== undefined && value >= min && value <= max;

/**
 * „Cantarul ponderal”: utilizatorul introduce varsta, sexul, inaltimea si greutatea (si optional
 * talia) si afla starea corpului: prea slab, normal, supraponderal sau obezitate.
 */
export default function BodyCheck() {
  const { t, formatNumber } = useI18n();
  const theme = useTheme();
  const { profile } = useAppState();
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'female');
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [height, setHeight] = useState(profile ? String(profile.heightCm) : '');
  const [weight, setWeight] = useState(profile ? String(profile.weightKg) : '');
  const [waist, setWaist] = useState('');

  const values = {
    age: parseNumber(age),
    height: parseNumber(height),
    weight: parseNumber(weight),
    waist: parseNumber(waist),
  };
  const errors = {
    age:
      age && !inRange(values.age, 10, LIMITS.age.max)
        ? t('onboarding.errors.range', { min: 10, max: LIMITS.age.max })
        : null,
    height:
      height && !inRange(values.height, LIMITS.heightCm.min, LIMITS.heightCm.max)
        ? t('onboarding.errors.range', { min: LIMITS.heightCm.min, max: LIMITS.heightCm.max })
        : null,
    weight:
      weight && !inRange(values.weight, 25, LIMITS.weightKg.max)
        ? t('onboarding.errors.range', { min: 25, max: LIMITS.weightKg.max })
        : null,
    waist:
      waist && !inRange(values.waist, 40, 250)
        ? t('onboarding.errors.range', { min: 40, max: 250 })
        : null,
  };

  const result = useMemo(() => {
    if (
      !inRange(values.age, 10, LIMITS.age.max) ||
      !inRange(values.height, LIMITS.heightCm.min, LIMITS.heightCm.max) ||
      !inRange(values.weight, 25, LIMITS.weightKg.max)
    ) {
      return null;
    }
    return assessBody({
      age: values.age!,
      sex,
      heightCm: values.height!,
      weightKg: values.weight!,
      ...(inRange(values.waist, 40, 250) ? { waistCm: values.waist } : {}),
    });
  }, [values.age, values.height, values.weight, values.waist, sex]);

  const statusColor: Record<BodyStatus, string> = {
    under: theme.colors.info,
    normal: theme.colors.primary,
    over: theme.colors.warning,
    obese: theme.colors.danger,
  };

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    subtitle: { ...th.font.body, color: th.colors.textMuted },
    row: { flexDirection: 'row', gap: th.spacing.sm },
    half: { flex: 1 },
    bmiRow: { flexDirection: 'row', alignItems: 'flex-end', gap: th.spacing.md },
    bmiValue: { fontSize: 52, fontWeight: '900', letterSpacing: -1 },
    status: { fontSize: 20, fontWeight: '800' },
    category: { ...th.font.caption, fontWeight: '600' },
    scale: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
    marker: {
      position: 'absolute',
      top: -5,
      width: 4,
      height: 24,
      borderRadius: 2,
      backgroundColor: th.colors.text,
    },
    ticks: { flexDirection: 'row', justifyContent: 'space-between' },
    tick: { ...th.font.caption, fontSize: 11 },
    text: { ...th.font.body },
    stats: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    stat: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      borderWidth: 1,
      borderColor: th.colors.border,
      gap: 2,
    },
    statLabel: { ...th.font.caption },
    statValue: { fontSize: 20, fontWeight: '800', color: th.colors.text },
    statHint: { ...th.font.caption, color: th.colors.primary, fontWeight: '700' },
  }));

  const markerPct = result
    ? Math.min(Math.max((result.bmi - SCALE_MIN) / (SCALE_MAX - SCALE_MIN), 0), 1) * 100
    : 0;
  const kg = result ? formatNumber(Math.abs(result.toHealthy), 1) : '';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardScroll contentContainerStyle={s.content}>
        <ScreenHeader title={t('body.title')} back />
        <Text style={s.subtitle}>{t('body.subtitle')}</Text>
        {profile ? <Notice tone="info">{t('body.fromProfile')}</Notice> : null}

        <Card>
          <Text style={theme.font.caption}>{t('body.sex')}</Text>
          <Segmented
            options={[
              { value: 'female' as Sex, label: t('body.female'), icon: 'female' },
              { value: 'male' as Sex, label: t('body.male'), icon: 'male' },
            ]}
            value={sex}
            onChange={setSex}
          />
          <View style={s.row}>
            <View style={s.half}>
              <Field
                label={t('body.age')}
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                suffix={t('common.years')}
                error={errors.age}
              />
            </View>
            <View style={s.half}>
              <Field
                label={t('body.height')}
                value={height}
                onChangeText={setHeight}
                keyboardType="decimal-pad"
                suffix={t('common.cm')}
                error={errors.height}
              />
            </View>
          </View>
          <View style={s.row}>
            <View style={s.half}>
              <Field
                label={t('body.weight')}
                value={weight}
                onChangeText={setWeight}
                keyboardType="decimal-pad"
                suffix={t('common.kg')}
                error={errors.weight}
              />
            </View>
            <View style={s.half}>
              <Field
                label={t('body.waist')}
                value={waist}
                onChangeText={setWaist}
                keyboardType="decimal-pad"
                suffix={t('common.cm')}
                error={errors.waist}
              />
            </View>
          </View>
        </Card>

        {result ? (
          <>
            <Card title={t('body.bmi')} icon="speedometer-outline">
              <View style={s.bmiRow}>
                <Text style={[s.bmiValue, { color: statusColor[result.status] }]}>
                  {formatNumber(result.bmi, 1)}
                </Text>
                <View style={{ flex: 1, paddingBottom: 10 }}>
                  <Text style={[s.status, { color: statusColor[result.status] }]}>
                    {t(`body.status.${result.status}`)}
                  </Text>
                  <Text style={s.category}>{t(`body.category.${result.category}`)}</Text>
                </View>
              </View>
              <View>
                <View style={s.scale}>
                  {SEGMENTS.map((seg) => (
                    <View
                      key={seg.status}
                      style={{
                        flex: seg.to - seg.from,
                        backgroundColor: statusColor[seg.status],
                        opacity: seg.status === result.status ? 1 : 0.35,
                      }}
                    />
                  ))}
                </View>
                <View style={[s.marker, { left: `${markerPct}%`, marginLeft: -2 }]} />
              </View>
              <View style={s.ticks}>
                {[SCALE_MIN, 18.5, 25, 30, SCALE_MAX].map((v) => (
                  <Text key={v} style={s.tick}>
                    {formatNumber(v, 1)}
                  </Text>
                ))}
              </View>
              <Text style={s.text}>{t(`body.statusText.${result.status}`, { kg })}</Text>
            </Card>

            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statLabel}>{t('body.healthyRange')}</Text>
                <Text style={s.statValue}>
                  {formatNumber(result.healthy.min, 1)}–{formatNumber(result.healthy.max, 1)}{' '}
                  {t('common.kg')}
                </Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>{t('body.bodyFat')}</Text>
                <Text style={s.statValue}>{formatNumber(result.bodyFat, 1)}%</Text>
                <Text style={s.statHint}>{t(`body.fatLevel.${result.bodyFatLevel}`)}</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>{t('body.bmr')}</Text>
                <Text style={s.statValue}>
                  {result.bmr} {t('common.kcal')}
                </Text>
                <Text style={s.statHint}>{t('body.bmrHint')}</Text>
              </View>
              {result.waist ? (
                <View style={s.stat}>
                  <Text style={s.statLabel}>{t('body.waistRatio')}</Text>
                  <Text style={s.statValue}>{formatNumber(result.waist.ratio, 2)}</Text>
                  <Text
                    style={[
                      s.statHint,
                      result.waist.risk !== 'low' && {
                        color:
                          result.waist.risk === 'high' ? theme.colors.danger : theme.colors.warning,
                      },
                    ]}
                  >
                    {t(`body.waistRisk.${result.waist.risk}`)}
                  </Text>
                </View>
              ) : null}
            </View>

            {result.minor ? <Notice>{t('body.minor')}</Notice> : null}
            <Notice tone="info">{t('body.disclaimer')}</Notice>
            {result.status !== 'normal' ? (
              <Button
                title={t('body.consult')}
                icon="medkit-outline"
                variant="secondary"
                onPress={() => router.push('/nutritionist')}
              />
            ) : null}
          </>
        ) : null}
      </KeyboardScroll>
    </SafeAreaView>
  );
}
