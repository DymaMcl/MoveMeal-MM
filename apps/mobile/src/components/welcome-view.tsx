import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Segmented, type IconName } from '@/components/ui';
import { LANGUAGES, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'workouts', icon: 'barbell-outline' },
  { key: 'nutrition', icon: 'nutrition-outline' },
  { key: 'nutritionist', icon: 'medkit-outline' },
];

/** Marimea titlului in mijlocul ecranului si dupa ce urca (raport de scalare). */
const TITLE_SIZE = 48;
const TITLE_SCALE_TOP = 0.62;
const MOVE_DURATION = 750;

export type WelcomeStage =
  /** Doar titlul, in mijlocul ecranului (la deschiderea aplicatiei). */
  | 'splash'
  /** Titlul urca si se micsoreaza, iar panoul cu butoane urca de jos. */
  | 'welcome'
  /** Titlul dispare lin (contul este deja conectat, se deschide aplicatia). */
  | 'leaving';

/** Titlul „MoveMeal”: „Move” in culoarea textului, „Meal” in albastru. */
export function BrandTitle({ size = TITLE_SIZE }: { size?: number }) {
  const theme = useTheme();
  return (
    <Text
      style={{ fontSize: size, fontWeight: '900', letterSpacing: -1.5, color: theme.colors.text }}
    >
      Move<Text style={{ color: theme.colors.primary }}>Meal</Text>
    </Text>
  );
}

/**
 * Ecranul de bun venit cu animatia de deschidere. Cu `animated = false` apare direct in forma
 * finala (de exemplu dupa iesirea din cont).
 */
export function WelcomeView({
  stage,
  animated,
  onLeft,
}: {
  stage: WelcomeStage;
  animated: boolean;
  /** Apelat dupa ce titlul a disparut (stage = 'leaving'). */
  onLeft?: () => void;
}) {
  const { t, language, setLanguage } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [titleHeight, setTitleHeight] = useState(TITLE_SIZE * 1.25);

  // 0 = titlul in mijloc, 1 = titlul sus si panoul vizibil
  const progress = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (stage === 'welcome') {
      Animated.timing(progress, {
        toValue: 1,
        duration: animated ? MOVE_DURATION : 0,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    if (stage === 'leaving') {
      Animated.timing(fade, {
        toValue: 0,
        duration: 350,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(() => onLeft?.());
    }
  }, [stage, animated, progress, fade, onLeft]);

  const centerY = height / 2 - titleHeight / 2;
  const topY = insets.top + 28 - (titleHeight * (1 - TITLE_SCALE_TOP)) / 2;

  const s = useStyles((th) => ({
    root: { flex: 1, backgroundColor: th.colors.background },
    title: { position: 'absolute', left: 0, right: 0, top: 0, alignItems: 'center' },
    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: th.spacing.lg,
      gap: th.spacing.sm,
    },
    intro: { alignItems: 'center', gap: th.spacing.md, marginBottom: th.spacing.lg },
    subtitle: {
      ...th.font.body,
      fontSize: 16,
      lineHeight: 23,
      color: th.colors.textMuted,
      textAlign: 'center',
      maxWidth: 330,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: th.spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.border,
    },
    chipText: { color: th.colors.primary, fontWeight: '700', fontSize: 13 },
    welcome: { ...th.font.title, textAlign: 'center', marginBottom: th.spacing.sm },
  }));

  return (
    <View style={s.root}>
      <Animated.View
        pointerEvents="none"
        onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}
        style={[
          s.title,
          {
            opacity: fade,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [centerY, topY],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, TITLE_SCALE_TOP],
                }),
              },
            ],
          },
        ]}
      >
        <BrandTitle />
      </Animated.View>

      <Animated.View
        pointerEvents={stage === 'welcome' ? 'auto' : 'none'}
        style={[
          s.panel,
          {
            paddingBottom: insets.bottom + 16,
            opacity: progress,
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [height * 0.45, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={s.intro}>
          <Text style={s.subtitle}>{t('welcome.subtitle')}</Text>
          <View style={s.chips}>
            {FEATURES.map((f) => (
              <View key={f.key} style={s.chip}>
                <Ionicons name={f.icon} size={14} color={theme.colors.primary} />
                <Text style={s.chipText}>{t(`welcome.features.${f.key}`)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={s.welcome}>{t('welcome.title')}</Text>
        <Button
          title={t('welcome.register')}
          icon="person-add"
          onPress={() => router.push('/register')}
        />
        <Button
          title={t('welcome.login')}
          variant="secondary"
          onPress={() => router.push('/login')}
        />
        <View style={{ marginTop: 4 }}>
          <Segmented
            options={LANGUAGES.map((l) => ({ value: l.value, label: l.label }))}
            value={language}
            onChange={setLanguage}
          />
        </View>
      </Animated.View>
    </View>
  );
}
