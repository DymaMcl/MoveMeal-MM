import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { colors, font, spacing } from '@/theme';

export default function StartStep() {
  const { t } = useI18n();
  const { draft } = useAppState();

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('onboarding.start.action')}
            onPress={() => router.push('/onboarding/body')}
          />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <View style={styles.center}>
        <Ionicons name="rocket-outline" size={72} color={colors.primary} />
        <Text style={[font.title, styles.text]}>
          {t('onboarding.start.title', { name: draft.name ?? '' })}
        </Text>
        <Text style={[font.body, styles.text, styles.muted]}>{t('onboarding.start.subtitle')}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  text: { textAlign: 'center' },
  muted: { color: colors.textMuted },
});
