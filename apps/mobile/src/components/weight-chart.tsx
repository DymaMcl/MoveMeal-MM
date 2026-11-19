import { useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { Measurement } from '@/api/client';
import { useTheme } from '@/theme';

const HEIGHT = 200;
const PAD = { top: 16, right: 12, bottom: 24, left: 36 };

/** Graficul greutatii: masuratorile zilnice (puncte) si media mobila pe 7 zile (linie). */
export function WeightChart({ data, from, to }: { data: Measurement[]; from: string; to: string }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const time = (day: string) => new Date(`${day}T12:00:00Z`).getTime();
  const t0 = time(from);
  const t1 = Math.max(time(to), t0 + 1);
  const values = data.flatMap((d) => [d.weightKg, d.average7]);
  const min = Math.floor(Math.min(...values) - 0.5);
  const max = Math.ceil(Math.max(...values) + 0.5);
  const innerW = Math.max(width - PAD.left - PAD.right, 1);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (day: string) => PAD.left + ((time(day) - t0) / (t1 - t0)) * innerW;
  const y = (kg: number) => PAD.top + (1 - (kg - min) / Math.max(max - min, 1)) * innerH;
  const ticks = [min, (min + max) / 2, max];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: HEIGHT }}>
      {width > 0 && data.length > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((v) => (
            <Line
              key={v}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke={theme.colors.border}
              strokeWidth={1}
            />
          ))}
          {ticks.map((v) => (
            <SvgText key={`l${v}`} x={4} y={y(v) + 4} fontSize={11} fill={theme.colors.textMuted}>
              {v.toFixed(1)}
            </SvgText>
          ))}
          <Polyline
            points={data.map((d) => `${x(d.day)},${y(d.average7)}`).join(' ')}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {data.map((d) => (
            <Circle
              key={d.day}
              cx={x(d.day)}
              cy={y(d.weightKg)}
              r={3.5}
              fill={theme.colors.accent}
            />
          ))}
        </Svg>
      ) : null}
      {width > 0 && data.length === 0 ? (
        <Text style={[theme.font.caption, { textAlign: 'center', marginTop: HEIGHT / 2 - 10 }]}>
          –
        </Text>
      ) : null}
    </View>
  );
}
