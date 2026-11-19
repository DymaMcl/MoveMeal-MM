import { exerciseImageUrl, type Exercise } from '@movemeal/shared';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

/**
 * Imaginea exercitiului. In modul „animated” trece lin intre pozitia de start si cea finala,
 * pentru a sugera miscarea (pana la adaugarea unor animatii propriu-zise).
 */
export function ExerciseImage({
  exercise,
  animated = false,
  style,
}: {
  exercise: Exercise;
  animated?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;
    const step = (to: number) =>
      Animated.timing(progress, {
        toValue: to,
        duration: 450,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
    const loop = Animated.loop(
      Animated.sequence([Animated.delay(700), step(1), Animated.delay(700), step(0)]),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, progress]);

  const layer = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;
  return (
    <View
      style={[
        { backgroundColor: '#FFFFFF', overflow: 'hidden', borderRadius: theme.radius.md },
        style,
      ]}
    >
      <Image source={{ uri: exerciseImageUrl(exercise, 0) }} style={layer} resizeMode="contain" />
      {animated ? (
        <Animated.Image
          source={{ uri: exerciseImageUrl(exercise, 1) }}
          style={[layer, { opacity: progress }]}
          resizeMode="contain"
        />
      ) : null}
    </View>
  );
}
