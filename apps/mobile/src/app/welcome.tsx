import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Segmented, type IconName } from '@/components/ui';
import { LANGUAGES, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'workouts', icon: 'barbell' },
  { key: 'nutrition', icon: 'nutrition' },
  { key: 'nutritionist', icon: 'medkit' },
];

export default function Welcome() {
  const { t, language, setLanguage } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    root: { flex: 1, backgroundColor: th.colors.background },
    hero: {
      flex: 1,
      borderBottomLeftRadius: th.radius.xl + 8,
      borderBottomRightRadius: th.radius.xl + 8,
      overflow: 'hidden',
    },
    heroInner: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: th.spacing.lg,
      gap: th.spacing.md,
    },
    logo: {
      width: 96,
      height: 96,
      borderRadius: 30,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    brand: { fontSize: 40, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
    subtitle: {
      fontSize: 16,
      lineHeight: 23,
      color: 'rgba(255,255,255,0.88)',
      textAlign: 'center',
      maxWidth: 320,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: th.spacing.sm },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    chipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
    bottom: { padding: th.spacing.lg, gap: th.spacing.sm },
    title: { ...th.font.title, textAlign: 'center', marginBottom: th.spacing.sm },
  }));

  return (
    <View style={s.root}>
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.hero}
      >
        <SafeAreaView style={s.heroInner} edges={['top']}>
          <View style={s.logo}>
            <Ionicons name="barbell" size={34} color="#FFFFFF" />
            <Ionicons name="leaf" size={26} color="#FFFFFF" />
          </View>
          <Text style={s.brand}>MoveMeal</Text>
          <Text style={s.subtitle}>{t('welcome.subtitle')}</Text>
          <View style={s.chips}>
            {FEATURES.map((f) => (
              <View key={f.key} style={s.chip}>
                <Ionicons name={f.icon} size={14} color="#FFFFFF" />
                <Text style={s.chipText}>{t(`welcome.features.${f.key}`)}</Text>
              </View>
            ))}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <SafeAreaView style={s.bottom} edges={['bottom']}>
        <Text style={s.title}>{t('welcome.title')}</Text>
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
      </SafeAreaView>
    </View>
  );
}
