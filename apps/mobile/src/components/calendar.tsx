import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { localeOf, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

/** Data AAAA-LL-ZZ din componente locale (fara conversii de fus orar). */
const isoOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const monthKey = (iso: string) => iso.slice(0, 7);

/**
 * Calendar lunar pentru alegerea unei zile. Sunt active doar zilele din `available`; zilele de
 * pana la `highlightUntil` (inclusiv) sunt marcate (de exemplu oferta primei consultatii gratuite).
 */
export function MonthCalendar({
  available,
  selected,
  onSelect,
  highlightUntil,
}: {
  /** Zilele care se pot alege (AAAA-LL-ZZ), in ordine. */
  available: string[];
  selected: string | null;
  onSelect: (day: string) => void;
  highlightUntil?: string | null;
}) {
  const { language } = useI18n();
  const theme = useTheme();
  const locale = localeOf(language);
  const availableSet = useMemo(() => new Set(available), [available]);
  const months = useMemo(() => [...new Set(available.map(monthKey))], [available]);
  const [month, setMonth] = useState(() =>
    selected ? monthKey(selected) : (months[0] ?? monthKey(new Date().toISOString())),
  );
  const monthIndex = months.indexOf(month);

  const s = useStyles((th) => ({
    head: { flexDirection: 'row', alignItems: 'center', marginBottom: th.spacing.sm },
    title: { ...th.font.heading, flex: 1, textAlign: 'center', textTransform: 'capitalize' },
    nav: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.surfaceAlt,
    },
    week: { flexDirection: 'row', marginBottom: 4 },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      ...th.font.caption,
      fontWeight: '700',
      textTransform: 'capitalize',
      fontSize: 12,
    },
    row: { flexDirection: 'row' },
    cell: { flex: 1, aspectRatio: 1, padding: 3 },
    day: {
      flex: 1,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayAvailable: { backgroundColor: th.colors.primarySoft },
    daySelected: { backgroundColor: th.colors.primary },
    dayText: { fontSize: 15, fontWeight: '700', color: th.colors.text },
    dayMuted: { color: th.colors.textMuted, opacity: 0.45, fontWeight: '500' },
    dot: {
      position: 'absolute',
      bottom: 5,
      width: 5,
      height: 5,
      borderRadius: 3,
    },
  }));

  const [year, monthNumber] = month.split('-').map(Number);
  const m = monthNumber - 1;
  const first = new Date(year, m, 1, 12);
  const daysInMonth = new Date(year, m + 1, 0, 12).getDate();
  // Saptamana incepe luni.
  const offset = (first.getDay() + 6) % 7;
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => isoOf(year, m, i + 1)),
  ];
  while (cells.length % 7) cells.push(null);
  const rows = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  // Numele zilelor saptamanii (luni … duminica), in limba aleasa.
  const weekNames = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i, 12).toLocaleDateString(locale, { weekday: 'narrow' }),
  );
  const title = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <View>
      <View style={s.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="‹"
          disabled={monthIndex <= 0}
          style={[s.nav, monthIndex <= 0 && { opacity: 0.3 }]}
          onPress={() => setMonth(months[monthIndex - 1])}
        >
          <Ionicons name="chevron-back" size={18} color={theme.colors.text} />
        </Pressable>
        <Text style={s.title}>{title}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="›"
          disabled={monthIndex < 0 || monthIndex >= months.length - 1}
          style={[s.nav, (monthIndex < 0 || monthIndex >= months.length - 1) && { opacity: 0.3 }]}
          onPress={() => setMonth(months[monthIndex + 1])}
        >
          <Ionicons name="chevron-forward" size={18} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={s.week}>
        {weekNames.map((name, i) => (
          <Text key={i} style={s.weekDay}>
            {name}
          </Text>
        ))}
      </View>

      {rows.map((row, r) => (
        <View key={r} style={s.row}>
          {row.map((day, c) => {
            if (!day) return <View key={c} style={s.cell} />;
            const enabled = availableSet.has(day);
            const active = day === selected;
            const highlighted = enabled && !!highlightUntil && day <= highlightUntil;
            return (
              <View key={c} style={s.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active, disabled: !enabled }}
                  accessibilityLabel={day}
                  disabled={!enabled}
                  onPress={() => onSelect(day)}
                  style={[s.day, enabled && s.dayAvailable, active && s.daySelected]}
                >
                  <Text
                    style={[
                      s.dayText,
                      !enabled && s.dayMuted,
                      active && { color: theme.colors.onPrimary },
                    ]}
                  >
                    {Number(day.slice(8))}
                  </Text>
                  {highlighted ? (
                    <View
                      style={[
                        s.dot,
                        { backgroundColor: active ? theme.colors.onPrimary : theme.colors.primary },
                      ]}
                    />
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
