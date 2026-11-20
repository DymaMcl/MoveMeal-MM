import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { isNetworkError } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ServerLink } from '@/components/server-link';
import { Button, Field, Notice, Screen, Subtitle, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/state/validation';
import { useStyles, useTheme } from '@/theme';

export default function Register() {
  const { t } = useI18n();
  const theme = useTheme();
  const { register } = useAppState();
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [networkFailed, setNetworkFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const s = useStyles((th) => ({
    consent: {
      flexDirection: 'row',
      gap: th.spacing.sm + 4,
      alignItems: 'flex-start',
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.md,
      padding: th.spacing.md,
    },
    box: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: th.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxChecked: { backgroundColor: th.colors.primary, borderColor: th.colors.primary },
    consentText: { ...th.font.caption, flex: 1, color: th.colors.text },
    error: { fontSize: 13, color: th.colors.danger },
  }));

  const errors = {
    email: !isValidEmail(email) ? t('auth.errors.email') : null,
    password: password.length < MIN_PASSWORD_LENGTH ? t('auth.errors.password') : null,
    confirm: confirm !== password ? t('auth.errors.passwordMatch') : null,
    consent: !consent ? t('auth.errors.consent') : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (e: string | null) => (submitted ? e : null);

  async function onSubmit() {
    setSubmitted(true);
    setServerError(null);
    if (!valid) return;
    setBusy(true);
    try {
      // Parola se trimite doar serverului si nu se pastreaza pe telefon.
      await register(email.trim().toLowerCase(), password, consent);
      router.replace('/onboarding/personal');
    } catch (error) {
      setNetworkFailed(isNetworkError(error));
      setServerError(t(errorKey(error)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('auth.registerAction')} onPress={onSubmit} disabled={busy} />
          <Button
            title={t('auth.haveAccount')}
            variant="ghost"
            onPress={() => router.replace('/login')}
          />
        </>
      }
    >
      <Title>{t('auth.registerTitle')}</Title>
      <Subtitle>MoveMeal</Subtitle>
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        icon="mail-outline"
        error={show(errors.email)}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        icon="lock-closed-outline"
        error={show(errors.password)}
      />
      <Field
        label={t('auth.passwordConfirm')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        icon="lock-closed-outline"
        error={show(errors.confirm)}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((c) => !c)}
        style={s.consent}
      >
        <View style={[s.box, consent && s.boxChecked]}>
          {consent ? <Ionicons name="checkmark" size={16} color={theme.colors.onPrimary} /> : null}
        </View>
        <Text style={s.consentText}>{t('auth.consent')}</Text>
      </Pressable>
      {show(errors.consent) ? <Text style={s.error}>{errors.consent}</Text> : null}
      {serverError ? <Notice>{serverError}</Notice> : null}
      <ServerLink highlight={networkFailed} />
    </Screen>
  );
}
