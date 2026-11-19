import { Ionicons } from '@expo/vector-icons';
import { getExercise, type Exercise, exerciseName, exerciseSteps } from '@movemeal/shared';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseImage } from '@/components/exercise-image';
import { Card, IconCircle } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

function equipmentLabel(exercise: Exercise, t: (k: string) => string): string {
  const options = exercise.requires.filter((o) => !o.includes('gym'));
  if (options.length === 0) return t('workout.detail.gymEquipment');
  return options
    .map((o) =>
      o.length === 0
        ? t('workout.detail.bodyweight')
        : o.map((item) => t(`workout.setup.equipment.${item}`)).join(' + '),
    )
    .join(' / ');
}

export default function ExerciseDetail() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id: string;
    sets?: string;
    target?: string;
    rest?: string;
  }>();
  const exercise = getExercise(params.id);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    top: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    image: { width: '100%', aspectRatio: 1.25, borderRadius: th.radius.xl },
    title: { ...th.font.title },
    facts: { flexDirection: 'row', gap: th.spacing.sm },
    fact: {
      flex: 1,
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.md,
      padding: th.spacing.md - 4,
      gap: 2,
      ...th.elevation,
    },
    factValue: { ...th.font.heading, fontSize: 15 },
    plan: { flexDirection: 'row', justifyContent: 'space-around' },
    planItem: { alignItems: 'center', gap: 2 },
    planValue: { fontSize: 24, fontWeight: '800', color: th.colors.primary },
    step: { flexDirection: 'row', gap: th.spacing.md, alignItems: 'flex-start' },
    stepNumber: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: { fontWeight: '800', color: th.colors.primaryStrong },
    stepText: { ...th.font.body, flex: 1 },
    credit: { ...th.font.caption, textAlign: 'center', fontSize: 11 },
  }));

  if (!exercise) return <Redirect href="/workout" />;

  const unit = exercise.unit === 'seconds' ? t('workout.seconds') : t('workout.reps');
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.top}>
          <Pressable accessibilityRole="button" style={s.back} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        <ExerciseImage exercise={exercise} animated style={s.image} />
        <Text style={s.title}>{exerciseName(exercise, language)}</Text>

        <View style={s.facts}>
          <View style={s.fact}>
            <Text style={theme.font.caption}>{t('workout.detail.muscles')}</Text>
            <Text style={s.factValue}>{t(`workout.groups.${exercise.group}`)}</Text>
          </View>
          <View style={s.fact}>
            <Text style={theme.font.caption}>{t('workout.detail.level')}</Text>
            <Text style={s.factValue}>{t(`workout.difficulty.${exercise.difficulty}`)}</Text>
          </View>
        </View>
        <View style={s.fact}>
          <Text style={theme.font.caption}>{t('workout.detail.equipment')}</Text>
          <Text style={s.factValue}>{equipmentLabel(exercise, t)}</Text>
        </View>

        {params.sets && params.target ? (
          <Card title={t('workout.detail.inPlan')} icon="calendar">
            <View style={s.plan}>
              <View style={s.planItem}>
                <Text style={s.planValue}>{params.sets}</Text>
                <Text style={theme.font.caption}>{t('workout.detail.setsLabel')}</Text>
              </View>
              <View style={s.planItem}>
                <Text style={s.planValue}>{params.target}</Text>
                <Text style={theme.font.caption}>{unit}</Text>
              </View>
              {params.rest ? (
                <View style={s.planItem}>
                  <Text style={s.planValue}>{params.rest}</Text>
                  <Text style={theme.font.caption}>{t('workout.detail.restLabel')}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        ) : null}

        <Card title={t('workout.detail.howTo')} icon="list">
          {exerciseSteps(exercise, language).map((text, i) => (
            <View key={i} style={s.step}>
              <View style={s.stepNumber}>
                <Text style={s.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{text}</Text>
            </View>
          ))}
        </Card>

        <View style={{ alignItems: 'center' }}>
          <IconCircle
            icon="information-circle-outline"
            color={theme.colors.textMuted}
            background="transparent"
            size={28}
          />
          <Text style={s.credit}>{t('workout.detail.imageCredit')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
