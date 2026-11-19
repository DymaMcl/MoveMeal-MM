import { Ionicons } from '@expo/vector-icons';
import { assessBody } from '@movemeal/shared';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, ApiError, type AssistantAction, type ChatMessage } from '@/api/client';
import { errorKey } from '@/api/errors';
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
  /** Raspuns din regulile aplicatiei, cand asistentul AI nu este disponibil. */
  offline?: boolean;
  /** Mesajul de intampinare nu se trimite modelului. */
  greeting?: boolean;
}

const SUGGESTIONS = [
  'calories',
  'protein',
  'photo',
  'swap',
  'workout',
  'nutritionist',
  'bmi',
] as const;

/** Paginile recomandate de asistentul AI. */
const ACTIONS: Record<AssistantAction, { href: Href; label: string }> = {
  home: { href: '/home', label: 'menu.home' },
  workout: { href: '/workout', label: 'menu.workout' },
  meals: { href: '/meals', label: 'menu.meals' },
  calories: { href: '/calories', label: 'menu.calories' },
  foodPhoto: { href: '/food-photo', label: 'menu.foodPhoto' },
  progress: { href: '/progress', label: 'menu.progress' },
  nutritionist: { href: '/nutritionist', label: 'menu.nutritionist' },
  bodyCheck: { href: '/body-check', label: 'menu.bodyCheck' },
  settings: { href: '/settings', label: 'menu.settings' },
};

/** Ultimele mesaje trimise modelului (conversatia nu se salveaza pe server). */
const HISTORY = 12;

/**
 * Chatul de ajutor. Cand serverul are configurat Google Gemini, raspunsurile sunt generate de AI
 * din datele utilizatorului; altfel (sau fara internet) raspunde din regulile aplicatiei.
 */
export default function Assistant() {
  const { t, language, formatNumber } = useI18n();
  const theme = useTheme();
  const { profile, plan, session } = useAppState();
  const name = profile?.name ?? session?.email.split('@')[0] ?? '';
  const [messages, setMessages] = useState<Message[]>([
    { id: 0, from: 'bot', text: t('assistant.greeting', { name }), greeting: true },
  ]);
  const [input, setInput] = useState('');
  /** null = se verifica; true = Gemini disponibil; false = mod offline. */
  const [ai, setAi] = useState<boolean | null>(null);
  const [thinking, setThinking] = useState(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const nextId = useRef(1);
  const token = session?.token;

  useEffect(() => {
    if (!token) return;
    let active = true;
    api.ai
      .status(token)
      .then((status) => active && setAi(status.available))
      .catch(() => active && setAi(false));
    return () => {
      active = false;
    };
  }, [token]);

  /** Raspunsul din regulile aplicatiei (folosit si cand AI-ul nu raspunde). */
  function ruleAnswer(intent: Intent | null): string {
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

  function offlineMessage(question: string, prefix?: string): Message {
    const match = matchIntent(question);
    const text = ruleAnswer(match.intent);
    return {
      id: nextId.current++,
      from: 'bot',
      text: prefix ? `${prefix}\n\n${text}` : text,
      offline: true,
      ...(match.action && match.actionLabel
        ? { action: { href: match.action, label: t(match.actionLabel) } }
        : {}),
    };
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || thinking) return;
    const userMsg: Message = { id: nextId.current++, from: 'user', text };
    const conversation = [...messages, userMsg];
    setMessages(conversation);
    setInput('');

    if (!ai || !token) {
      setMessages((prev) => [...prev, offlineMessage(text)]);
      return;
    }

    const history: ChatMessage[] = conversation
      .filter((m) => !m.greeting)
      .slice(-HISTORY)
      .map((m) => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        text: m.text.slice(0, 1000),
      }));
    // Conversatia trimisa modelului incepe cu o intrebare a utilizatorului.
    while (history.length && history[0].role !== 'user') history.shift();

    setThinking(true);
    try {
      const res = await api.ai.chat(token, history, language);
      const action = res.action ? ACTIONS[res.action] : undefined;
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          from: 'bot',
          text: res.reply,
          ...(action ? { action: { href: action.href, label: t(action.label) } } : {}),
        },
      ]);
    } catch (e) {
      const code = e instanceof ApiError ? e.data.code : undefined;
      if (code === 'ai_unavailable') setAi(false);
      // Limita zilnica sau o eroare: utilizatorul primeste totusi raspunsul din reguli.
      const prefix = code === 'ai_limit' || code === 'ai_blocked' ? t(errorKey(e)) : undefined;
      setMessages((prev) => [...prev, offlineMessage(text, prefix)]);
    } finally {
      setThinking(false);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    head: { paddingHorizontal: th.spacing.lg, paddingTop: th.spacing.lg, gap: th.spacing.xs },
    badge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: th.radius.pill,
      marginTop: th.spacing.xs,
    },
    badgeText: { fontSize: 12, fontWeight: '800' },
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
    offline: { ...th.font.caption, fontSize: 11, fontStyle: 'italic' },
    typing: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
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

  const canSend = Boolean(input.trim()) && !thinking;

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <View style={s.head}>
          <ScreenHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} back />
          {ai !== null ? (
            <View
              style={[
                s.badge,
                { backgroundColor: ai ? theme.colors.primarySoft : theme.colors.surfaceAlt },
              ]}
            >
              <Ionicons
                name={ai ? 'sparkles' : 'cloud-offline-outline'}
                size={13}
                color={ai ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text
                style={[s.badgeText, { color: ai ? theme.colors.primary : theme.colors.textMuted }]}
              >
                {t(ai ? 'assistant.aiBadge' : 'assistant.offlineBadge')}
              </Text>
            </View>
          ) : null}
        </View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={s.list}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <Text style={s.note}>{t(ai ? 'assistant.noteAi' : 'assistant.note')}</Text>
          {messages.map((m) => (
            <View key={m.id} style={[s.bubble, m.from === 'bot' ? s.bot : s.user]}>
              <Text style={m.from === 'bot' ? s.botText : s.userText} selectable>
                {m.text}
              </Text>
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
              {m.offline && ai ? (
                <Text style={s.offline}>{t('assistant.offlineReply')}</Text>
              ) : null}
            </View>
          ))}
          {thinking ? (
            <View style={[s.bubble, s.bot, s.typing]} accessibilityLiveRegion="polite">
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={theme.font.caption}>{t('assistant.thinking')}</Text>
            </View>
          ) : null}
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
              style={[s.chip, thinking && { opacity: 0.5 }]}
              disabled={thinking}
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
            maxLength={1000}
            returnKeyType="send"
            onSubmitEditing={() => ask(input)}
            submitBehavior="submit"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            style={({ pressed }) => [s.send, (pressed || !canSend) && { opacity: 0.6 }]}
            disabled={!canSend}
            onPress={() => ask(input)}
          >
            <Ionicons name="send" size={20} color={theme.colors.onPrimary} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
