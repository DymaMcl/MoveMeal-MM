import { Ionicons } from '@expo/vector-icons';
import type { Exercise, Prescription } from '@movemeal/shared';
import { Pressable, Text, View } from 'react-native';
import { ExerciseImage } from '@/components/exercise-image';
import { useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

/** Un exercitiu din program sau din biblioteca. */
export function ExerciseRow({
  exercise,
  prescription,
  done,
  onPress,
  onToggleDone,
}: {
  exercise: Exercise;
  prescription?: Prescription;
  done?: boolean;
  onPress: () => void;
  onToggleDone?: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.sm + 2,
      borderRadius: th.radius.lg,
      backgroundColor: th.colors.surface,
      borderWidth: th.scheme === 'dark' ? 1 : 0,
      borderColor: th.colors.border,
      ...th.elevation,
    },
    image: { width: 72, height: 72 },
    text: { flex: 1, gap: 3 },
    name: { ...th.font.heading, fontSize: 16 },
    meta: { ...th.font.caption, fontWeight: '600' },
    badge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.accentSoft,
    },
    badgeText: { fontSize: 11, fontWeight: '800', color: th.colors.accent },
    check: { padding: 6 },
    done: { opacity: 0.6 },
  }));

  const unit = exercise.unit === 'seconds' ? t('workout.seconds') : t('workout.reps');
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.row, done && s.done, pressed && { opacity: 0.85 }]}
    >
      <ExerciseImage exercise={exercise} style={s.image} />
      <View style={s.text}>
        {prescription?.focus ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{t('workout.focusBadge').toUpperCase()}</Text>
          </View>
        ) : null}
        <Text style={[s.name, done && { textDecorationLine: 'line-through' }]}>
          {exercise.name[language]}
        </Text>
        {prescription ? (
          <>
            <Text style={s.meta}>
              {t('workout.sets', {
                sets: prescription.sets,
                target: `${prescription.target} ${unit}`,
              })}
            </Text>
            <Text style={theme.font.caption}>
              {t('workout.rest', { sec: prescription.restSec })}
            </Text>
          </>
        ) : (
          <Text style={s.meta}>
            {t(`workout.groups.${exercise.group}`)} ·{' '}
            {t(`workout.difficulty.${exercise.difficulty}`)}
          </Text>
        )}
      </View>
      {onToggleDone ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!done }}
          hitSlop={10}
          onPress={onToggleDone}
          style={s.check}
        >
          <Ionicons
            name={done ? 'checkmark-circle' : 'ellipse-outline'}
            size={30}
            color={done ? theme.colors.primary : theme.colors.border}
          />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
      )}
    </Pressable>
  );
}
