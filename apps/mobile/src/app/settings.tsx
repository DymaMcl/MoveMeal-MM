import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/app-menu';
import { Button, Card, Segmented } from '@/components/ui';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useThemeSettings, type ThemeMode } from '@/theme';

/** Setarile: tema, limba si iesirea din cont (accesibile si din meniul cu 3 linii). */
export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { mode, setMode } = useThemeSettings();
  const { session, signOut } = useAppState();
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    label: {
      ...th.font.caption,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    group: { gap: th.spacing.sm },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: th.spacing.md },
    value: { ...th.font.body, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  }));

  const themeOptions: {
    value: ThemeMode;
    label: string;
    icon: 'phone-portrait-outline' | 'sunny' | 'moon';
  }[] = [
    { value: 'system', label: t('settings.themeSystem'), icon: 'phone-portrait-outline' },
    { value: 'light', label: t('settings.themeLight'), icon: 'sunny' },
    { value: 'dark', label: t('settings.themeDark'), icon: 'moon' },
  ];
  const languageOptions: { value: Language; label: string }[] = LANGUAGES.map((l) => ({
    value: l.value,
    label: l.label,
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('settings.title')} back />

        <Card title={t('settings.theme')} icon="contrast-outline">
          <Segmented options={themeOptions} value={mode} onChange={setMode} />
        </Card>
        <Card title={t('settings.language')} icon="language-outline">
          <Segmented options={languageOptions} value={language} onChange={setLanguage} />
        </Card>

        <Card title={t('settings.account')} icon="person-outline">
          <View style={s.row}>
            <Text style={s.label}>E-mail</Text>
            <Text style={s.value}>{session?.email}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>{t('admin.changeRole')}</Text>
            <Text style={s.value}>{t(`roles.${session?.role ?? 'user'}`)}</Text>
          </View>
        </Card>

        <Button
          title={t('more.logout')}
          icon="log-out-outline"
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace('/welcome');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
