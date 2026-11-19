import { Ionicons } from '@expo/vector-icons';
import { EXERCISES, type MuscleGroup } from '@movemeal/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseRow } from '@/components/exercise-row';
import { useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

const GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'core', 'legs', 'glutes'];
const LEVELS = [1, 2, 3] as const;

/** Biblioteca de exercitii, pe grupe musculare si niveluri de dificultate. */
export default function ExerciseLibrary() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [level, setLevel] = useState<1 | 2 | 3 | null>(null);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      paddingHorizontal: th.spacing.lg,
      paddingTop: th.spacing.md,
    },
    back: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    title: { ...th.font.title, flex: 1, fontSize: 24 },
    filters: {
      paddingHorizontal: th.spacing.lg,
      gap: th.spacing.sm,
      paddingVertical: th.spacing.md,
    },
    chip: {
      paddingHorizontal: 14,
      height: 38,
      borderRadius: th.radius.pill,
      justifyContent: 'center',
      backgroundColor: th.colors.surface,
      borderWidth: 1.5,
      borderColor: th.colors.border,
    },
    chipActive: { backgroundColor: th.colors.primary, borderColor: th.colors.primary },
    chipText: { fontWeight: '700', color: th.colors.text },
    chipTextActive: { color: th.colors.onPrimary },
    list: { paddingHorizontal: th.spacing.lg, paddingBottom: th.spacing.xl, gap: th.spacing.sm },
  }));

  const items = useMemo(
    () =>
      EXERCISES.filter((e) => (!group || e.group === group) && (!level || e.difficulty === level))
        .slice()
        .sort((a, b) => a.name[language].localeCompare(b.name[language], language)),
    [group, level, language],
  );

  function Chip({
    label,
    active,
    onPress,
  }: {
    label: string;
    active: boolean;
    onPress: () => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={[s.chip, active && s.chipActive]}
      >
        <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable accessibilityRole="button" style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>{t('workout.libraryTitle')}</Text>
      </View>

      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filters}
        >
          <Chip label={t('workout.all')} active={!group} onPress={() => setGroup(null)} />
          {GROUPS.map((g) => (
            <Chip
              key={g}
              label={t(`workout.groups.${g}`)}
              active={group === g}
              onPress={() => setGroup(group === g ? null : g)}
            />
          ))}
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.filters, { paddingTop: 0 }]}
        >
          {LEVELS.map((l) => (
            <Chip
              key={l}
              label={t(`workout.difficulty.${l}`)}
              active={level === l}
              onPress={() => setLevel(level === l ? null : l)}
            />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => (
          <ExerciseRow
            exercise={item}
            onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.id } })}
          />
        )}
      />
    </SafeAreaView>
  );
}
