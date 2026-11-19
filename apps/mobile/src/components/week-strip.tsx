import type { Weekday } from '@movemeal/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { weekdayOf } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

/** Zilele saptamanii curente; `marked` = zilele cu un punct (de exemplu antrenament). */
export function WeekStrip({
  week,
  selected,
  onSelect,
  marked,
}: {
  week: Date[];
  selected: Weekday;
  onSelect: (day: Weekday) => void;
  marked?: (day: Weekday) => boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const today = weekdayOf(new Date());
  const s = useStyles((th) => ({
    row: { flexDirection: 'row', gap: 6 },
    day: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surface,
      gap: 4,
      overflow: 'hidden',
    },
    short: { fontSize: 12, fontWeight: '700', color: th.colors.textMuted },
    number: { fontSize: 17, fontWeight: '800', color: th.colors.text },
    dot: { width: 6, height: 6, borderRadius: 3 },
  }));

  return (
    <View style={s.row}>
      {week.map((date, i) => {
        const wd = i as Weekday;
        const active = wd === selected;
        const dot = marked?.(wd) ?? false;
        const content = (
          <>
            <Text style={[s.short, active && { color: 'rgba(255,255,255,0.85)' }]}>
              {wd === today ? t('workout.today') : t(`workout.weekdaysShort.${wd}`)}
            </Text>
            <Text style={[s.number, active && { color: '#FFFFFF' }]}>{date.getDate()}</Text>
            <View
              style={[
                s.dot,
                {
                  backgroundColor: dot
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
            onPress={() => onSelect(wd)}
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
  );
}
