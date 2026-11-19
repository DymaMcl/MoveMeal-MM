import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '@/i18n';
import { colors, font, spacing } from '@/theme';

/** Ecran temporar pentru sectiunile care urmeaza sa fie dezvoltate. */
export function Placeholder({
  title,
  icon,
}: {
  title: string;
  icon: ComponentProps<typeof Ionicons>['name'];
}) {
  const { t } = useI18n();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.center}>
        <Ionicons name={icon} size={56} color={colors.primary} />
        <Text style={font.title}>{title}</Text>
        <Text style={[font.body, styles.muted]}>{t('common.comingSoon')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  muted: { color: colors.textMuted, textAlign: 'center' },
});
