import { Text, View } from 'react-native';
import { useStyles, useTheme } from '@/theme';

/** Bara de progres pentru o valoare fata de tinta (calorii sau macronutrienti). */
export function NutrientBar({
  label,
  value,
  target,
  unit,
  color,
}: {
  label: string;
  value: number;
  target: number;
  unit: string;
  color: string;
}) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    wrap: { gap: 6 },
    head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    label: { ...th.font.body, fontWeight: '600' },
    track: { height: 10, borderRadius: th.radius.pill, backgroundColor: th.colors.surfaceAlt },
    fill: { height: 10, borderRadius: th.radius.pill },
  }));
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <View style={s.labelRow}>
          <View style={[s.dot, { backgroundColor: color }]} />
          <Text style={s.label}>{label}</Text>
        </View>
        <Text style={theme.font.caption}>
          {Math.round(value)} / {Math.round(target)} {unit}
        </Text>
      </View>
      <View style={s.track}>
        <View
          style={[
            s.fill,
            {
              width: `${Math.max(pct * 100, 2)}%`,
              backgroundColor: value > target * 1.05 ? theme.colors.accent : color,
            },
          ]}
        />
      </View>
    </View>
  );
}
