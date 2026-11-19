import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { colors, font, radius, spacing } from '@/theme';

export default function Welcome() {
  const { t, language, setLanguage } = useI18n();

  return (
    <Screen
      footer={
        <>
          <Button title={t('welcome.register')} onPress={() => router.push('/register')} />
          <Button
            title={t('welcome.login')}
            variant="secondary"
            onPress={() => router.push('/login')}
          />
          <Button
            title={language === 'ro' ? 'English' : 'Română'}
            variant="ghost"
            onPress={() => setLanguage(language === 'ro' ? 'en' : 'ro')}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <View style={styles.logo}>
          <Ionicons name="barbell" size={40} color={colors.primary} />
          <Ionicons name="nutrition" size={40} color={colors.accent} />
        </View>
        <Text style={styles.brand}>MoveMeal</Text>
        <Text style={[font.title, styles.center]}>{t('welcome.title')}</Text>
        <Text style={[font.body, styles.center, styles.muted]}>{t('welcome.subtitle')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  logo: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brand: { fontSize: 34, fontWeight: '800', color: colors.primary, letterSpacing: 0.5 },
  center: { textAlign: 'center' },
  muted: { color: colors.textMuted },
});
