import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { checkServer, DEFAULT_API_URL, getApiUrl, normalizeApiUrl, setApiUrl } from '@/api/client';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Notice, KeyboardScroll } from '@/components/ui';
import { useI18n } from '@/i18n';
import { SERVER_URL_KEY } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

type Check = 'idle' | 'checking' | 'ok' | 'failed';

/**
 * Adresa serverului MoveMeal, pe tot ecranul (cu tastatura deschisa campul ramane vizibil).
 * Utila cand aplicatia instalata (APK) foloseste serverul de pe un calculator din aceeasi retea
 * Wi-Fi, iar adresa acestuia se schimba.
 */
export default function ServerSettings() {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [text, setText] = useState(getApiUrl());
  const [check, setCheck] = useState<Check>('idle');
  const [current, setCurrent] = useState(getApiUrl());

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    status: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    statusText: { ...th.font.body, fontWeight: '700' },
    small: { ...th.font.caption, fontSize: 13 },
    step: { flexDirection: 'row', gap: th.spacing.sm, alignItems: 'flex-start' },
    stepNumber: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumberText: { color: th.colors.primary, fontWeight: '800', fontSize: 13 },
    stepText: { ...th.font.body, flex: 1, fontSize: 14 },
  }));

  const normalized = normalizeApiUrl(text);

  function edit(value: string) {
    setText(value);
    setCheck('idle');
  }

  async function test() {
    if (!normalized) return;
    setCheck('checking');
    setCheck((await checkServer(normalized)) ? 'ok' : 'failed');
  }

  async function save() {
    if (!normalized) return;
    setApiUrl(normalized);
    await AsyncStorage.setItem(SERVER_URL_KEY, normalized).catch(() => undefined);
    toast(t('server.saved'));
    router.back();
  }

  async function reset() {
    setApiUrl(null);
    await AsyncStorage.removeItem(SERVER_URL_KEY).catch(() => undefined);
    setText(DEFAULT_API_URL);
    setCurrent(DEFAULT_API_URL);
    setCheck('idle');
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardScroll contentContainerStyle={s.content}>
        <ScreenHeader title={t('server.title')} back />

        <Card>
          <Field
            label={t('server.address')}
            value={text}
            onChangeText={edit}
            onClear={() => edit('')}
            clearLabel={t('server.clear')}
            placeholder="192.168.1.10"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            icon="server-outline"
            returnKeyType="done"
            onSubmitEditing={test}
            error={text.trim() && !normalized ? t('server.invalid') : null}
            hint={
              normalized && normalized !== text.trim() ? (
                <Text style={s.small}>{normalized}</Text>
              ) : undefined
            }
          />

          {check === 'checking' ? (
            <View style={s.status}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={s.statusText}>{t('server.checking')}</Text>
            </View>
          ) : check === 'ok' ? (
            <View style={s.status}>
              <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
              <Text style={[s.statusText, { color: theme.colors.primary }]}>{t('server.ok')}</Text>
            </View>
          ) : check === 'failed' ? (
            <Notice>{t('server.failed')}</Notice>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                title={t('server.test')}
                icon="pulse-outline"
                variant="secondary"
                disabled={!normalized || check === 'checking'}
                onPress={test}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('common.save')}
                icon="checkmark"
                disabled={!normalized}
                onPress={save}
              />
            </View>
          </View>
          <Text style={s.small}>{t('server.current', { url: current })}</Text>
        </Card>

        <Card title={t('server.howTitle')} icon="help-circle-outline">
          {(['how1', 'how2', 'how3'] as const).map((key, i) => (
            <View key={key} style={s.step}>
              <View style={s.stepNumber}>
                <Text style={s.stepNumberText}>{i + 1}</Text>
              </View>
              <Text style={s.stepText}>{t(`server.${key}`)}</Text>
            </View>
          ))}
        </Card>

        {current !== DEFAULT_API_URL ? (
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={{ alignSelf: 'center', padding: 8 }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {t('server.reset')}
            </Text>
          </Pressable>
        ) : null}
      </KeyboardScroll>
    </SafeAreaView>
  );
}
