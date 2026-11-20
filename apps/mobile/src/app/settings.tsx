import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getApiUrl } from '@/api/client';
import { ScreenHeader } from '@/components/app-menu';
import { ServerSettingsSheet } from '@/components/server-settings';
import { Button, Card, Segmented } from '@/components/ui';
import { LANGUAGES, useI18n, type Language } from '@/i18n';
import { useAppState } from '@/state/app-state';
import {
  ACCENT_SWATCH,
  ACCENTS,
  useStyles,
  useTheme,
  useThemeSettings,
  type ThemeMode,
} from '@/theme';

/** Setarile: tema, limba si iesirea din cont (accesibile si din meniul cu 3 linii). */
export default function Settings() {
  const { t, language, setLanguage } = useI18n();
  const { mode, setMode, accent, setAccent } = useThemeSettings();
  const { session, signOut } = useAppState();
  const [serverOpen, setServerOpen] = useState(false);
  const theme = useTheme();
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
    swatches: { flexDirection: 'row', justifyContent: 'space-between', gap: th.spacing.sm },
    swatchItem: { alignItems: 'center', gap: 6, flex: 1 },
    swatch: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: 'transparent',
    },
    swatchActive: { borderColor: th.colors.text },
    swatchLabel: { ...th.font.caption, fontWeight: '600' },
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
        <Card title={t('settings.color')} icon="color-palette-outline">
          <View style={s.swatches} accessibilityRole="radiogroup">
            {ACCENTS.map((a) => {
              const active = a === accent;
              return (
                <Pressable
                  key={a}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`settings.colors.${a}`)}
                  onPress={() => setAccent(a)}
                  style={s.swatchItem}
                >
                  <View style={[s.swatch, active && s.swatchActive]}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: ACCENT_SWATCH[a],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {active ? <Ionicons name="checkmark" size={22} color="#FFFFFF" /> : null}
                    </View>
                  </View>
                  <Text style={s.swatchLabel}>{t(`settings.colors.${a}`)}</Text>
                </Pressable>
              );
            })}
          </View>
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

        <Card title={t('server.title')} icon="server-outline">
          <Pressable
            accessibilityRole="button"
            onPress={() => setServerOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Text style={[s.value, { flex: 1, textAlign: 'left' }]} numberOfLines={1}>
              {getApiUrl()}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </Pressable>
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
      <ServerSettingsSheet visible={serverOpen} onClose={() => setServerOpen(false)} />
    </SafeAreaView>
  );
}
