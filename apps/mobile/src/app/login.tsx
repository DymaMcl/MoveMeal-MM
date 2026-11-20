import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { ApiError, isNetworkError } from '@/api/client';
import { errorKey } from '@/api/errors';
import { Button, Field, Notice, Screen, Subtitle, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { ServerSettingsSheet } from '@/components/server-settings';
import { useAppState } from '@/state/app-state';
import { useTheme } from '@/theme';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/state/validation';

export default function Login() {
  const { t } = useI18n();
  const { signIn } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);
  const theme = useTheme();

  const emailError = submitted && !isValidEmail(email) ? t('auth.errors.email') : null;
  const passwordError =
    submitted && password.length < MIN_PASSWORD_LENGTH ? t('auth.errors.password') : null;

  async function onSubmit() {
    setSubmitted(true);
    setServerError(null);
    setNetworkFailed(false);
    if (!isValidEmail(email) || password.length < MIN_PASSWORD_LENGTH) return;
    setBusy(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      router.replace('/');
    } catch (error) {
      const key = errorKey(error);
      setNetworkFailed(isNetworkError(error));
      const reason = error instanceof ApiError ? String(error.data.reason ?? '') : '';
      setServerError(key === 'errors.blocked' && reason ? `${t(key)} ${reason}` : t(key));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('auth.loginAction')} onPress={onSubmit} disabled={busy} />
          <Button
            title={t('auth.noAccount')}
            variant="ghost"
            onPress={() => router.replace('/register')}
          />
        </>
      }
    >
      <Title>{t('auth.loginTitle')}</Title>
      <Subtitle>MoveMeal</Subtitle>
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        icon="mail-outline"
        keyboardType="email-address"
        error={emailError}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        icon="lock-closed-outline"
        error={passwordError}
      />
      {serverError ? <Notice>{serverError}</Notice> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setServerOpen(true)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          alignSelf: 'flex-start',
          paddingVertical: 6,
        }}
      >
        <Ionicons
          name="server-outline"
          size={18}
          color={networkFailed ? theme.colors.primary : theme.colors.textMuted}
        />
        <Text
          style={{
            color: networkFailed ? theme.colors.primary : theme.colors.textMuted,
            fontWeight: networkFailed ? '800' : '600',
          }}
        >
          {t('server.link')}
        </Text>
      </Pressable>
      <ServerSettingsSheet visible={serverOpen} onClose={() => setServerOpen(false)} />
    </Screen>
  );
}
