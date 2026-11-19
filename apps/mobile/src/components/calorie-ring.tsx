import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  consumed: number;
  target: number;
  label: string;
  size?: number;
  stroke?: number;
  /** Culorile se aleg in functie de fundal (de exemplu alb pe un card cu gradient). */
  color: string;
  trackColor: string;
  textColor: string;
  mutedColor: string;
}

/** Indicatorul circular: calorii ramase din obiectivul zilnic. */
export function CalorieRing({
  consumed,
  target,
  label,
  size = 190,
  stroke = 14,
  color,
  trackColor,
  textColor,
  mutedColor,
}: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const progress = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = Math.max(target - consumed, 0);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        {progress > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 40, fontWeight: '800', color: textColor, letterSpacing: -1 }}>
          {remaining}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: mutedColor }}>{label}</Text>
      </View>
    </View>
  );
}
