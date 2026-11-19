import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, Screen, Title } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { isValidEmail, MIN_PASSWORD_LENGTH } from '@/state/validation';
import { colors, font, spacing } from '@/theme';

export default function Register() {
  const { t } = useI18n();
  const { signIn } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
    if (!valid) return;
    // TODO: inregistrare prin API; parola se trimite doar serverului, niciodata nu se pastreaza local.
    await signIn(email.trim().toLowerCase(), consent);
    router.replace('/onboarding/personal');
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('auth.registerAction')} onPress={onSubmit} />
          <Button
            title={t('auth.haveAccount')}
            variant="ghost"
            onPress={() => router.replace('/login')}
          />
        </>
      }
    >
      <Title>{t('auth.registerTitle')}</Title>
      <Field
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={show(errors.email)}
      />
      <Field
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        error={show(errors.password)}
      />
      <Field
        label={t('auth.passwordConfirm')}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        error={show(errors.confirm)}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consent }}
        onPress={() => setConsent((c) => !c)}
        style={styles.consent}
      >
        <View style={[styles.box, consent && styles.boxChecked]}>
          {consent ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={[font.caption, styles.flex]}>{t('auth.consent')}</Text>
      </Pressable>
      {show(errors.consent) ? <Text style={styles.error}>{errors.consent}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  consent: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: '#fff', fontWeight: '700', fontSize: 13 },
  error: { fontSize: 13, color: colors.danger },
});
