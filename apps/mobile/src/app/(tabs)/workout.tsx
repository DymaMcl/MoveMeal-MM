import { Ionicons } from '@expo/vector-icons';
import { getExercise, type Weekday } from '@movemeal/shared';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseRow } from '@/components/exercise-row';
import { Button, IconCircle, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { currentWeek, isoDate, weekdayOf } from '@/state/dates';
import { isDone, useWorkout } from '@/state/workout-state';
import { useStyles, useTheme } from '@/theme';
import { MenuButton } from '@/components/app-menu';

export default function Workout() {
  const { t } = useI18n();
  const theme = useTheme();
  const { status, program, done, toggle, reload } = useWorkout();
  const week = useMemo(() => currentWeek(), []);
  const today = weekdayOf(new Date());
  const [selected, setSelected] = useState<Weekday>(today);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    header: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    title: { ...th.font.title, flex: 1 },
    iconButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    week: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
    day: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surface,
      gap: 4,
      overflow: 'hidden',
    },
    dayShort: {
      fontSize: 12,
      fontWeight: '700',
      color: th.colors.textMuted,
      alignSelf: 'stretch',
      textAlign: 'center',
      paddingHorizontal: 3,
    },
    dayNumber: { fontSize: 17, fontWeight: '800', color: th.colors.text },
    dot: { width: 6, height: 6, borderRadius: 3 },
    hero: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: th.spacing.sm },
    heroDay: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 14 },
    heroTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 22 },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
      marginTop: 6,
    },
    fill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
    heroMeta: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
    rest: {
      alignItems: 'center',
      gap: th.spacing.sm,
      padding: th.spacing.lg,
      borderRadius: th.radius.xl,
      backgroundColor: th.colors.surface,
    },
    restText: { ...th.font.body, color: th.colors.textMuted, textAlign: 'center' },
    empty: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: th.spacing.md },
    emptyTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 22 },
    emptyText: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 21 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: th.spacing.lg },
  }));

  const sessionsByDay = useMemo(
    () => new Map(program?.plan.sessions.map((x) => [x.weekday, x]) ?? []),
    [program],
  );

  if (status === 'idle' || status === 'loading') {
    return (
      <SafeAreaView style={[s.safe, s.center]}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const header = (
    <View style={s.header}>
      <Text style={s.title}>{t('workout.title')}</Text>
      <Pressable
        accessibilityLabel={t('workout.library')}
        style={s.iconButton}
        onPress={() => router.push('/exercises')}
      >
        <Ionicons name="library-outline" size={20} color={theme.colors.primary} />
      </Pressable>
      {program ? (
        <Pressable
          accessibilityLabel={t('workout.edit')}
          style={s.iconButton}
          onPress={() => router.push('/workout-setup')}
        >
          <Ionicons name="options-outline" size={20} color={theme.colors.primary} />
        </Pressable>
      ) : null}
      <MenuButton />
    </View>
  );

  if (status === 'error') {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={s.content}>
          {header}
          <Notice>{t('workout.loadError')}</Notice>
          <Button title={t('common.retry')} icon="refresh" variant="secondary" onPress={reload} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!program) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScrollView contentContainerStyle={s.content}>
          {header}
          <LinearGradient
            colors={theme.gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.empty}
          >
            <IconCircle
              icon="barbell"
              color="#FFFFFF"
              background="rgba(255,255,255,0.2)"
              size={56}
            />
            <Text style={s.emptyTitle}>{t('workout.emptyTitle')}</Text>
            <Text style={s.emptyText}>{t('workout.emptyText')}</Text>
          </LinearGradient>
          <Button
            title={t('workout.create')}
            icon="sparkles"
            onPress={() => router.push('/workout-setup')}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const session = sessionsByDay.get(selected);
  const day = isoDate(week[selected]);
  const doneCount = session
    ? session.exercises.filter((p) => isDone(done, day, p.exerciseId)).length
    : 0;
  const total = session?.exercises.length ?? 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        {header}

        <View style={s.week}>
          {week.map((date, i) => {
            const wd = i as Weekday;
            const active = wd === selected;
            const training = sessionsByDay.has(wd);
            const content = (
              <>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.6}
                  style={[s.dayShort, active && { color: 'rgba(255,255,255,0.85)' }]}
                >
                  {wd === today ? t('workout.today') : t(`workout.weekdaysShort.${wd}`)}
                </Text>
                <Text style={[s.dayNumber, active && { color: '#FFFFFF' }]}>{date.getDate()}</Text>
                <View
                  style={[
                    s.dot,
                    {
                      backgroundColor: training
                        ? active
                          ? '#FFFFFF'
                          : theme.colors.primary
                        : 'transparent',
                    },
                  ]}
                />
              </>
            );
            return (
              <Pressable
                key={wd}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setSelected(wd)}
                style={{ flex: 1 }}
              >
                {active ? (
                  <LinearGradient colors={theme.gradients.primary} style={s.day}>
                    {content}
                  </LinearGradient>
                ) : (
                  <View style={s.day}>{content}</View>
                )}
              </Pressable>
            );
          })}
        </View>

        {session ? (
          <>
            <LinearGradient
              colors={theme.gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              <Text style={s.heroDay}>{t(`workout.weekdays.${selected}`)}</Text>
              <Text style={s.heroTitle}>{t(`workout.templates.${session.template}`)}</Text>
              <View style={s.track}>
                <View style={[s.fill, { width: `${total ? (doneCount / total) * 100 : 0}%` }]} />
              </View>
              <Text style={s.heroMeta}>
                {doneCount === total && total > 0
                  ? t('workout.completed')
                  : t('workout.progress', { done: doneCount, total })}
              </Text>
            </LinearGradient>

            {session.exercises.map((p) => {
              const exercise = getExercise(p.exerciseId);
              if (!exercise) return null;
              return (
                <ExerciseRow
                  key={p.exerciseId}
                  exercise={exercise}
                  prescription={p}
                  done={isDone(done, day, p.exerciseId)}
                  onToggleDone={() => toggle(day, p.exerciseId)}
                  onPress={() =>
                    router.push({
                      pathname: '/exercise/[id]',
                      params: {
                        id: p.exerciseId,
                        sets: String(p.sets),
                        target: p.target,
                        rest: String(p.restSec),
                      },
                    })
                  }
                />
              );
            })}
          </>
        ) : (
          <View style={s.rest}>
            <IconCircle
              icon="bed-outline"
              color={theme.colors.info}
              background={theme.colors.infoSoft}
              size={64}
            />
            <Text style={theme.font.heading}>{t('workout.restDay')}</Text>
            <Text style={s.restText}>{t('workout.restText')}</Text>
          </View>
        )}

        {program.plan.warnings.map((w) => (
          <Notice key={w} tone="info">
            {t(`workout.warnings.${w}`)}
          </Notice>
        ))}
        <Notice tone="info">{t('common.disclaimer')}</Notice>
      </ScrollView>
    </SafeAreaView>
  );
}
