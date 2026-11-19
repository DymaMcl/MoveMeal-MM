import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '@/theme';

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={font.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={[font.body, styles.subtitle]}>{children}</Text>;
}

export function StepIndicator({ label, current, total }: { label: string; current: number; total: number }) {
  return (
    <View style={styles.step}>
      <Text style={font.caption}>{label}</Text>
      <View style={styles.stepTrack}>
        <View style={[styles.stepFill, { width: `${(current / total) * 100}%` }]} />
      </View>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  title,
  onPress,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.buttonText, styles[`buttonText_${variant}`]]}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  suffix,
  ...input
}: TextInputProps & { label: string; error?: string | null; hint?: ReactNode; suffix?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, !!error && styles.inputError]}>
        <TextInput placeholderTextColor={colors.textMuted} style={styles.input} {...input} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint}
    </View>
  );
}

export function OptionCard({
  title,
  hint,
  selected,
  onPress,
}: {
  title: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.option, selected && styles.optionSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]} />
      <View style={styles.flex}>
        <Text style={font.heading}>{title}</Text>
        {hint ? <Text style={font.caption}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

export function Card({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={[font.heading, styles.cardTitle]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Notice({ children, tone = 'warning' }: { children: ReactNode; tone?: 'warning' | 'info' }) {
  return (
    <View style={[styles.notice, tone === 'info' && styles.noticeInfo]}>
      <Text style={[font.caption, { color: tone === 'warning' ? colors.warning : colors.primaryDark }]}>
        {children}
      </Text>
    </View>
  );
}

/** Transforma textul introdus intr-un numar (accepta si virgula ca separator zecimal). */
export function parseNumber(text: string): number | undefined {
  const value = Number(text.replace(',', '.').trim());
  return text.trim() === '' || Number.isNaN(value) ? undefined : value;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  footer: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  subtitle: { color: colors.textMuted, marginBottom: spacing.sm },
  step: { gap: spacing.xs, marginBottom: spacing.sm },
  stepTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.border },
  stepFill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.primary },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  button_primary: { backgroundColor: colors.primary },
  button_secondary: { backgroundColor: colors.primarySoft },
  button_ghost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonText_primary: { color: '#fff' },
  buttonText_secondary: { color: colors.primaryDark },
  buttonText_ghost: { color: colors.primaryDark },
  field: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  input: { flex: 1, minHeight: 50, fontSize: 16, color: colors.text },
  suffix: { ...font.caption, marginLeft: spacing.sm },
  error: { fontSize: 13, color: colors.danger },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
  radioSelected: { borderColor: colors.primary, borderWidth: 6 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { marginBottom: spacing.xs },
  notice: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.sm },
  noticeInfo: { backgroundColor: colors.primarySoft },
});
