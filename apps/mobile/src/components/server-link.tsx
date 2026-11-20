import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

/**
 * Legatura spre setarile conexiunii la server (autentificare si inregistrare). Este evidentiata
 * cand serverul nu a putut fi contactat.
 */
export function ServerLink({ highlight = false }: { highlight?: boolean }) {
  const { t } = useI18n();
  const theme = useTheme();
  const color = highlight ? theme.colors.primary : theme.colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/server-settings')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: 8,
      }}
    >
      <Ionicons name="server-outline" size={18} color={color} />
      <Text style={{ color, fontWeight: highlight ? '800' : '600' }}>{t('server.link')}</Text>
    </Pressable>
  );
}
