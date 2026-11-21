import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, type ComponentProps, type ComponentRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Lista derulabila pentru formulare: cand apare tastatura, continutul se ridica deasupra ei
 * (si pe iOS, si pe Android), iar campul atins este adus in zona vizibila.
 */
export function KeyboardScroll({
  children,
  footer,
  ...props
}: ScrollViewProps & { children: ReactNode; footer?: ReactNode }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const s = useStyles((t) => ({
    flex: { flex: 1 },
    footer: { padding: t.spacing.lg, paddingTop: t.spacing.sm, gap: t.spacing.sm },
  }));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // Dupa ce lista s-a micsorat, campul activ este derulat deasupra tastaturii.
      timer = setTimeout(() => {
        const input = TextInput.State.currentlyFocusedInput();
        const scroll = scrollRef.current;
        const inner = scroll?.getInnerViewRef();
        if (!input || !scroll || !inner) return;
        input.measureLayout(
          inner,
          (_x, y) => scroll.scrollTo({ y: Math.max(0, y - 96), animated: true }),
          () => undefined,
        );
      }, 60);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <KeyboardAvoidingView style={s.flex} behavior="padding">
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        {...props}
      >
        {children}
      </ScrollView>
      {footer ? <View style={s.footer}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

export function Screen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const s = useStyles((t) => ({
    safe: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: t.spacing.lg, gap: t.spacing.md, flexGrow: 1 },
  }));
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardScroll contentContainerStyle={s.content} footer={footer}>
        {children}
      </KeyboardScroll>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <Text style={t.font.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <Text style={[t.font.body, { color: t.colors.textMuted, marginBottom: t.spacing.sm }]}>
      {children}
    </Text>
  );
}

export function StepIndicator({
  label,
  current,
  total,
}: {
  label: string;
  current: number;
  total: number;
}) {
  const t = useTheme();
  const s = useStyles((th) => ({
    wrap: { gap: th.spacing.sm, marginBottom: th.spacing.sm },
    track: {
      height: 8,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.surfaceAlt,
      overflow: 'hidden',
    },
  }));
  return (
    <View style={s.wrap}>
      <Text style={[t.font.caption, { fontWeight: '600' }]}>{label}</Text>
      <View style={s.track}>
        <LinearGradient
          colors={t.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 8, width: `${(current / total) * 100}%`, borderRadius: 999 }}
        />
      </View>
    </View>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  title,
  onPress,
  disabled,
  icon,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: IconName;
  variant?: ButtonVariant;
}) {
  const t = useTheme();
  const s = useStyles((th) => ({
    base: {
      minHeight: 54,
      borderRadius: th.radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: th.spacing.sm,
      paddingHorizontal: th.spacing.md,
      overflow: 'hidden',
    },
    secondary: { backgroundColor: th.colors.primarySoft },
    text: { fontSize: 16, fontWeight: '700' },
  }));
  const textColor =
    variant === 'primary'
      ? t.colors.onPrimary
      : variant === 'secondary'
        ? t.colors.primaryStrong
        : t.colors.primary;
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={20} color={textColor} /> : null}
      <Text
        style={[s.text, { color: textColor, flexShrink: 1 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {title}
      </Text>
    </>
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      })}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={t.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.base}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[s.base, variant === 'secondary' && s.secondary]}>{content}</View>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  hint,
  suffix,
  icon,
  onClear,
  clearLabel,
  style,
  ...input
}: TextInputProps & {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  suffix?: string;
  icon?: IconName;
  /** Afiseaza un buton care goleste campul (cand are text). */
  onClear?: () => void;
  clearLabel?: string;
}) {
  const t = useTheme();
  const s = useStyles((th) => ({
    field: { gap: th.spacing.xs + 2 },
    label: { fontSize: 14, fontWeight: '600', color: th.colors.text },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      backgroundColor: th.colors.surface,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
    },
    rowError: { borderColor: th.colors.danger },
    input: { flex: 1, minHeight: 54, fontSize: 16, color: th.colors.text },
    suffix: { ...th.font.caption, fontWeight: '600' },
    error: { fontSize: 13, color: th.colors.danger },
  }));
  return (
    <View style={s.field}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.row, !!error && s.rowError]}>
        {icon ? <Ionicons name={icon} size={20} color={t.colors.textMuted} /> : null}
        <TextInput
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.primary}
          style={[s.input, style]}
          {...input}
        />
        {suffix ? <Text style={s.suffix}>{suffix}</Text> : null}
        {onClear && input.value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            hitSlop={12}
            onPress={onClear}
          >
            <Ionicons name="close-circle" size={22} color={t.colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={s.error}>{error}</Text> : null}
      {hint}
    </View>
  );
}

export function IconCircle({
  icon,
  color,
  background,
  size = 44,
}: {
  icon: IconName;
  color: string;
  background: string;
  size?: number;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function OptionCard({
  title,
  hint,
  icon,
  selected,
  onPress,
}: {
  title: string;
  hint?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const s = useStyles((th) => ({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 2,
      borderColor: 'transparent',
      backgroundColor: th.colors.surface,
      ...th.elevation,
    },
    selected: { borderColor: th.colors.primary, backgroundColor: th.colors.primarySoft },
    text: { flex: 1, gap: 2 },
  }));
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.card, selected && s.selected]}
    >
      {icon ? (
        <IconCircle
          icon={icon}
          color={selected ? t.colors.onPrimary : t.colors.primary}
          background={selected ? t.colors.primary : t.colors.primarySoft}
        />
      ) : null}
      <View style={s.text}>
        <Text style={t.font.heading}>{title}</Text>
        {hint ? <Text style={t.font.caption}>{hint}</Text> : null}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? t.colors.primary : t.colors.border}
      />
    </Pressable>
  );
}

export function Card({
  children,
  title,
  icon,
}: {
  children: ReactNode;
  title?: string;
  icon?: IconName;
}) {
  const t = useTheme();
  const s = useStyles((th) => ({
    card: {
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.lg,
      padding: th.spacing.md + 2,
      gap: th.spacing.sm + 2,
      borderWidth: th.scheme === 'dark' ? 1 : 0,
      borderColor: th.colors.border,
      ...th.elevation,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
  }));
  return (
    <View style={s.card}>
      {title ? (
        <View style={s.head}>
          {icon ? <Ionicons name={icon} size={20} color={t.colors.primary} /> : null}
          <Text style={t.font.heading}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function Notice({
  children,
  tone = 'warning',
}: {
  children: ReactNode;
  tone?: 'warning' | 'info';
}) {
  const t = useTheme();
  const warning = tone === 'warning';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: t.spacing.sm,
        backgroundColor: warning ? t.colors.warningSoft : t.colors.infoSoft,
        borderRadius: t.radius.md,
        padding: t.spacing.md - 4,
      }}
    >
      <Ionicons
        name={warning ? 'alert-circle' : 'information-circle'}
        size={18}
        color={warning ? t.colors.warning : t.colors.info}
      />
      <Text
        style={[t.font.caption, { flex: 1, color: warning ? t.colors.warning : t.colors.info }]}
      >
        {children}
      </Text>
    </View>
  );
}

/** Comutator cu mai multe optiuni (de exemplu tema sau limba). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const s = useStyles((th) => ({
    wrap: {
      flexDirection: 'row',
      backgroundColor: th.colors.surfaceAlt,
      borderRadius: th.radius.pill,
      padding: 4,
      gap: 4,
    },
    item: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 6,
      borderRadius: th.radius.pill,
    },
    active: { backgroundColor: th.colors.surface, ...th.elevation },
    label: { fontSize: 14, fontWeight: '600' },
  }));
  return (
    <View style={s.wrap} accessibilityRole="radiogroup">
      {options.map((o) => {
        const active = o.value === value;
        const color = active ? t.colors.text : t.colors.textMuted;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[s.item, active && s.active]}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={color} /> : null}
            <Text
              style={[s.label, { color, flexShrink: 1 }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Transforma textul introdus intr-un numar (accepta si virgula ca separator zecimal). */
export function parseNumber(text: string): number | undefined {
  const value = Number(text.replace(',', '.').trim());
  return text.trim() === '' || Number.isNaN(value) ? undefined : value;
}
