import { Ionicons } from '@expo/vector-icons';
import { assessBody } from '@movemeal/shared';
import { router, type Href } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { matchIntent, type Intent } from '@/assistant/intents';
import { ScreenHeader } from '@/components/app-menu';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

interface Message {
  id: number;
  from: 'user' | 'bot';
  text: string;
  action?: { href: Href; label: string };
}

const SUGGESTIONS = ['calories', 'protein', 'swap', 'workout', 'nutritionist', 'bmi'] as const;

/** Chatul de ajutor: raspunsuri automate, pe baza regulilor aplicatiei si a datelor utilizatorului. */
export default function Assistant() {
  const { t, formatNumber } = useI18n();
  const theme = useTheme();
  const { profile, plan, session } = useAppState();
  const name = profile?.name ?? session?.email.split('@')[0] ?? '';
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'bot', text: t('assistant.greeting', { name }) },
  ]);
  const [input, setInput] = useState('');
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);

  function answer(intent: Intent | null): string {
    switch (intent) {
      case 'calories':
        return plan
          ? t('assistant.answers.calories', {
              kcal: plan.targetCalories,
              protein: plan.macros.proteinG,
              carbs: plan.macros.carbsG,
              fat: plan.macros.fatG,
            })
          : t('assistant.answers.caloriesNoProfile');
      case 'protein':
        return plan
          ? t('assistant.answers.protein', { protein: plan.macros.proteinG })
          : t('assistant.answers.caloriesNoProfile');
      case 'bmi': {
        if (!profile) return t('assistant.answers.caloriesNoProfile');
        const body = assessBody(profile);
        return t('assistant.answers.bmi', {
          bmi: formatNumber(body.bmi, 1),
          status: t(`body.status.${body.status}`).toLowerCase(),
          min: formatNumber(body.healthy.min, 1),
          max: formatNumber(body.healthy.max, 1),
        });
      }
      case null:
        return t('assistant.answers.fallback');
      default:
        return t(`assistant.answers.${intent}`);
    }
  }

  function ask(question: string) {
    const text = question.trim();
    if (!text) return;
    const match = matchIntent(text);
    const userMsg: Message = { id: nextId.current++, from: 'user', text };
    const botMsg: Message = {
      id: nextId.current++,
      from: 'bot',
      text: answer(match.intent),
      ...(match.action && match.actionLabel
        ? { action: { href: match.action, label: t(match.actionLabel) } }
        : {}),
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    head: { paddingHorizontal: th.spacing.lg, paddingTop: th.spacing.lg, gap: th.spacing.xs },
    list: { padding: th.spacing.lg, gap: th.spacing.sm },
    bubble: {
      maxWidth: '86%',
      paddingHorizontal: th.spacing.md,
      paddingVertical: 10,
      borderRadius: th.radius.lg,
      gap: th.spacing.sm,
    },
    bot: {
      alignSelf: 'flex-start',
      backgroundColor: th.colors.surfaceAlt,
      borderBottomLeftRadius: 6,
    },
    user: {
      alignSelf: 'flex-end',
      backgroundColor: th.colors.primary,
      borderBottomRightRadius: 6,
    },
    botText: { ...th.font.body, lineHeight: 22 },
    userText: { ...th.font.body, color: th.colors.onPrimary, lineHeight: 22 },
    action: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.primary,
    },
    actionText: { color: th.colors.primary, fontWeight: '700', fontSize: 13 },
    note: { ...th.font.caption, textAlign: 'center', marginVertical: th.spacing.sm },
    chips: { paddingHorizontal: th.spacing.lg, gap: th.spacing.sm, paddingBottom: th.spacing.sm },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.border,
    },
    chipText: { color: th.colors.primary, fontWeight: '600', fontSize: 13 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingHorizontal: th.spacing.lg,
      paddingVertical: th.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: th.colors.border,
    },
    input: {
      flex: 1,
      minHeight: 48,
      maxHeight: 120,
      paddingHorizontal: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      color: th.colors.text,
      fontSize: 16,
    },
    send: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: th.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={s.head}>
          <ScreenHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} back />
        </View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={s.list}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <Text style={s.note}>{t('assistant.note')}</Text>
          {messages.map((m) => (
            <View key={m.id} style={[s.bubble, m.from === 'bot' ? s.bot : s.user]}>
              <Text style={m.from === 'bot' ? s.botText : s.userText}>{m.text}</Text>
              {m.action ? (
                <Pressable
                  accessibilityRole="button"
                  style={s.action}
                  onPress={() => router.navigate(m.action!.href)}
                >
                  <Text style={s.actionText}>
                    {t('assistant.actions.open')}: {m.action.label}
                  </Text>
                  <Ionicons name="arrow-forward" size={14} color={theme.colors.primary} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          style={{ flexGrow: 0 }}
          keyboardShouldPersistTaps="handled"
        >
          {SUGGESTIONS.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              style={s.chip}
              onPress={() => ask(t(`assistant.suggestions.${key}`))}
            >
              <Text style={s.chipText}>{t(`assistant.suggestions.${key}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.primary}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => ask(input)}
            submitBehavior="submit"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            style={({ pressed }) => [s.send, (pressed || !input.trim()) && { opacity: 0.6 }]}
            disabled={!input.trim()}
            onPress={() => ask(input)}
          >
            <Ionicons name="send" size={20} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
