import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { checkServer, DEFAULT_API_URL, getApiUrl, normalizeApiUrl, setApiUrl } from '@/api/client';
import { ActionSheet } from '@/components/social';
import { Button, Field, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { SERVER_URL_KEY } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

type Check = 'idle' | 'checking' | 'ok' | 'failed';

/**
 * Adresa serverului MoveMeal. Utila cand aplicatia instalata (APK) foloseste serverul de pe un
 * calculator din aceeasi retea Wi-Fi, iar adresa acestuia se schimba.
 */
export function ServerSettingsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [text, setText] = useState(getApiUrl());
  const [check, setCheck] = useState<Check>('idle');

  useEffect(() => {
    if (!visible) return;
    setText(getApiUrl());
    setCheck('idle');
  }, [visible]);

  const s = useStyles((th) => ({
    status: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    statusText: { ...th.font.body, fontWeight: '700' },
    current: { ...th.font.caption, fontSize: 12 },
  }));

  const normalized = normalizeApiUrl(text);

  async function test() {
    if (!normalized) return;
    setCheck('checking');
    setCheck((await checkServer(normalized)) ? 'ok' : 'failed');
  }

  async function save() {
    if (!normalized) return;
    setApiUrl(normalized);
    await AsyncStorage.setItem(SERVER_URL_KEY, normalized).catch(() => undefined);
    onClose();
  }

  async function reset() {
    setApiUrl(null);
    await AsyncStorage.removeItem(SERVER_URL_KEY).catch(() => undefined);
    setText(DEFAULT_API_URL);
    setCheck('idle');
  }

  return (
    <ActionSheet visible={visible} title={t('server.title')} onClose={onClose}>
      <View style={{ gap: 12 }}>
        <Text style={theme.font.caption}>{t('server.hint')}</Text>
        <Field
          label={t('server.address')}
          value={text}
          onChangeText={(v) => {
            setText(v);
            setCheck('idle');
          }}
          placeholder="192.168.1.10"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          error={text.trim() && !normalized ? t('server.invalid') : null}
          hint={
            normalized && normalized !== text.trim() ? (
              <Text style={s.current}>{normalized}</Text>
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
        {getApiUrl() !== DEFAULT_API_URL ? (
          <Pressable
            accessibilityRole="button"
            onPress={reset}
            style={{ alignSelf: 'center', padding: 6 }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>
              {t('server.reset')}
            </Text>
          </Pressable>
        ) : null}
        <Text style={s.current}>{t('server.current', { url: getApiUrl() })}</Text>
      </View>
    </ActionSheet>
  );
}
