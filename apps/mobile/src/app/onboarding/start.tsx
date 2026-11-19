import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

export default function StartStep() {
  const { t } = useI18n();
  const theme = useTheme();
  const { draft } = useAppState();
  const s = useStyles((th) => ({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: th.spacing.lg },
    badge: {
      width: 140,
      height: 140,
      borderRadius: 70,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...th.font.display, textAlign: 'center' },
    text: { ...th.font.body, color: th.colors.textMuted, textAlign: 'center', maxWidth: 320 },
  }));

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('onboarding.start.action')}
            icon="arrow-forward"
            onPress={() => router.push('/onboarding/body')}
          />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }
    >
      <View style={s.center}>
        <LinearGradient colors={theme.gradients.hero} style={s.badge}>
          <Ionicons name="rocket" size={64} color="#FFFFFF" />
        </LinearGradient>
        <Text style={s.title}>{t('onboarding.start.title', { name: draft.name ?? '' })}</Text>
        <Text style={s.text}>{t('onboarding.start.subtitle')}</Text>
      </View>
    </Screen>
  );
}
