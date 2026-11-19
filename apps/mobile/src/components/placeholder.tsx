import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconCircle, type IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

/** Ecran temporar pentru sectiunile care urmeaza sa fie dezvoltate. */
export function Placeholder({ title, icon }: { title: string; icon: IconName }) {
  const { t } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: th.spacing.md,
      padding: th.spacing.lg,
    },
    muted: { ...th.font.body, color: th.colors.textMuted, textAlign: 'center' },
  }));
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.center}>
        <IconCircle
          icon={icon}
          size={88}
          color={theme.colors.primary}
          background={theme.colors.primarySoft}
        />
        <Text style={theme.font.title}>{title}</Text>
        <Text style={s.muted}>{t('common.comingSoon')}</Text>
      </View>
    </SafeAreaView>
  );
}
