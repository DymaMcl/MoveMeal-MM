import { Ionicons } from '@expo/vector-icons';
import { Image as CachedImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  api,
  mediaUrl,
  type Post,
  type PostKind,
  type ReportReason,
  type Role,
} from '@/api/client';
import { errorKey } from '@/api/errors';
import { useToast } from '@/components/toast';
import { Button, type IconName } from '@/components/ui';
import { localeOf, useI18n, type Language } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

export const POST_KINDS: PostKind[] = ['meal', 'workout', 'running', 'cycling', 'other'];

export const KIND_ICONS: Record<PostKind, IconName> = {
  meal: 'restaurant-outline',
  workout: 'barbell-outline',
  running: 'walk-outline',
  cycling: 'bicycle-outline',
  other: 'sparkles-outline',
  tip: 'bulb-outline',
};

const REPORT_REASONS: ReportReason[] = [
  'nudity',
  'violence',
  'harassment',
  'spam',
  'not_relevant',
  'other',
];

/** „acum”, „5 min”, „3 h”, „2 z”, apoi data. */
export function timeAgo(
  iso: string,
  t: (key: string, p?: Record<string, number>) => string,
  language: Language,
) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return t('social.time.now');
  if (minutes < 60) return t('social.time.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('social.time.hours', { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('social.time.days', { n: days });
  return new Date(iso).toLocaleDateString(localeOf(language), { day: 'numeric', month: 'short' });
}

/**
 * Fotografia de pe server; cererea include tokenul sesiunii (accesul se verifica pe server).
 * Componenta expo-image trimite antetul Authorization si pastreaza imaginea in cache
 * (id-ul fotografiei nu se schimba niciodata).
 */
export function RemoteImage({
  mediaId,
  style,
  resizeMode = 'cover',
}: {
  mediaId: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const { session } = useAppState();
  const theme = useTheme();
  return (
    <CachedImage
      source={{
        uri: mediaUrl(mediaId),
        headers: session ? { Authorization: `Bearer ${session.token}` } : undefined,
      }}
      style={[{ backgroundColor: theme.colors.surfaceAlt }, style]}
      contentFit={resizeMode}
      cachePolicy="memory-disk"
      recyclingKey={mediaId}
      transition={150}
      accessibilityIgnoresInvertColors
    />
  );
}

export function Avatar({
  name,
  avatarId,
  size = 40,
}: {
  name: string;
  avatarId: string | null;
  size?: number;
}) {
  const theme = useTheme();
  if (avatarId) {
    return (
      <RemoteImage
        mediaId={avatarId}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: theme.colors.primary, fontWeight: '900', fontSize: size * 0.42 }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

/** Insigna pentru nutritionisti si administratori (continut din surse verificate). */
export function RoleBadge({ role }: { role: Role }) {
  const { t } = useI18n();
  const theme = useTheme();
  if (role === 'user') return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 999,
        backgroundColor: theme.colors.primarySoft,
      }}
    >
      <Ionicons
        name={role === 'admin' ? 'shield-checkmark' : 'medkit'}
        size={11}
        color={theme.colors.primary}
      />
      <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.primary }}>
        {t(`roles.${role}`)}
      </Text>
    </View>
  );
}

/** Cerc de progres (0–100%). */
export function ProgressRing({
  pct,
  size = 84,
  stroke = 9,
  color,
  trackColor,
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = Math.min(100, Math.max(0, pct)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - value)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

/** Filtre pe un rand care se poate derula (o singura optiune activa). */
export function FilterRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: { gap: th.spacing.sm, paddingVertical: 2 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      minHeight: 38,
      borderRadius: th.radius.pill,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    active: { borderColor: th.colors.primary, backgroundColor: th.colors.primary },
    label: { fontSize: 14, fontWeight: '700', color: th.colors.text },
  }));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
      {options.map((o) => {
        const active = o.value === value;
        const color = active ? theme.colors.onPrimary : theme.colors.text;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[s.chip, active && s.active]}
          >
            {o.icon ? <Ionicons name={o.icon} size={16} color={color} /> : null}
            <Text style={[s.label, { color }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export interface SheetOption {
  label: string;
  icon: IconName;
  danger?: boolean;
  onPress: () => void;
}

/** Lista de actiuni deschisa de jos (de exemplu „Raporteaza”, „Sterge”). */
export function ActionSheet({
  visible,
  title,
  options,
  onClose,
  children,
}: {
  visible: boolean;
  title?: string;
  options?: SheetOption[];
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const s = useStyles((th) => ({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: th.colors.surface,
      borderTopLeftRadius: th.radius.xl,
      borderTopRightRadius: th.radius.xl,
      padding: th.spacing.lg,
      gap: th.spacing.sm,
      maxHeight: '85%',
    },
    handle: {
      alignSelf: 'center',
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: th.colors.border,
      marginBottom: th.spacing.sm,
    },
    title: { ...th.font.heading, marginBottom: th.spacing.xs },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      minHeight: 52,
      paddingHorizontal: th.spacing.sm,
      borderRadius: th.radius.md,
    },
    label: { ...th.font.body, fontWeight: '600' },
  }));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Fereastra urca deasupra tastaturii cand se scrie in ea. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t('common.close')}>
          <Pressable style={[s.sheet, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
            <View style={s.handle} />
            {title ? <Text style={s.title}>{title}</Text> : null}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 4 }}>
              {options?.map((o) => (
                <Pressable
                  key={o.label}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    s.option,
                    pressed && { backgroundColor: theme.colors.surfaceAlt },
                  ]}
                  onPress={() => {
                    onClose();
                    o.onPress();
                  }}
                >
                  <Ionicons
                    name={o.icon}
                    size={22}
                    color={o.danger ? theme.colors.danger : theme.colors.primary}
                  />
                  <Text style={[s.label, o.danger && { color: theme.colors.danger }]}>
                    {o.label}
                  </Text>
                </Pressable>
              ))}
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Raportarea unei postari catre administratori. */
export function ReportSheet({
  postId,
  visible,
  onClose,
}: {
  postId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const s = useStyles((th) => ({
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      minHeight: 46,
    },
    input: {
      minHeight: 70,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      padding: th.spacing.sm + 2,
      color: th.colors.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
  }));

  async function send() {
    if (!session || !reason) return;
    setSending(true);
    try {
      await api.social.report(session.token, postId, reason, note.trim() || undefined);
      toast(t('social.reported'));
      setReason(null);
      setNote('');
      onClose();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setSending(false);
    }
  }

  return (
    <ActionSheet visible={visible} title={t('social.reportTitle')} onClose={onClose}>
      <Text style={theme.font.caption}>{t('social.reportHint')}</Text>
      {REPORT_REASONS.map((r) => (
        <Pressable
          key={r}
          accessibilityRole="radio"
          accessibilityState={{ selected: reason === r }}
          style={s.option}
          onPress={() => setReason(r)}
        >
          <Ionicons
            name={reason === r ? 'radio-button-on' : 'radio-button-off'}
            size={22}
            color={theme.colors.primary}
          />
          <Text style={theme.font.body}>{t(`social.reasons.${r}`)}</Text>
        </Pressable>
      ))}
      <TextInput
        style={s.input}
        value={note}
        onChangeText={setNote}
        placeholder={t('social.reportNote')}
        placeholderTextColor={theme.colors.textMuted}
        maxLength={300}
        multiline
      />
      <Button
        title={t('social.reportSend')}
        icon="flag-outline"
        disabled={!reason || sending}
        onPress={send}
      />
    </ActionSheet>
  );
}

/** O postare din lenta, din album sau din salvate. */
export function PostCard({
  post,
  onChange,
  onDeleted,
}: {
  post: Post;
  onChange: (post: Post) => void;
  onDeleted?: (id: string) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState(false);
  const lastTap = useRef(0);
  const heart = useRef(new Animated.Value(0)).current;
  const token = session?.token;

  const s = useStyles((th) => ({
    card: {
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      padding: th.spacing.md - 4,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    name: { ...th.font.body, fontWeight: '800' },
    meta: { ...th.font.caption, fontSize: 12 },
    image: { width: '100%', aspectRatio: 1 },
    tip: {
      minHeight: 220,
      padding: th.spacing.lg,
      gap: th.spacing.sm,
      justifyContent: 'center',
    },
    tipBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    tipBadgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12, letterSpacing: 0.4 },
    tipTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 24, lineHeight: 30 },
    tipText: { color: 'rgba(255,255,255,0.94)', fontSize: 16, lineHeight: 23 },
    bigHeart: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      paddingHorizontal: th.spacing.md - 4,
      paddingTop: th.spacing.sm,
    },
    action: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
    count: { ...th.font.body, fontWeight: '700' },
    body: { paddingHorizontal: th.spacing.md - 4, paddingBottom: th.spacing.md - 2, gap: 8 },
    caption: { ...th.font.body },
    meal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      padding: th.spacing.sm + 2,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.primarySoft,
    },
    mealText: { ...th.font.caption, color: th.colors.primaryStrong, flex: 1, fontWeight: '600' },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      padding: th.spacing.sm + 2,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.warningSoft,
    },
    statusText: { ...th.font.caption, color: th.colors.warning, flex: 1 },
  }));

  async function toggle(kind: 'like' | 'save') {
    if (!token) return;
    const value = kind === 'like' ? !post.likedByMe : !post.savedByMe;
    // Actualizare imediata; se revine daca serverul refuza.
    const optimistic: Post =
      kind === 'like'
        ? { ...post, likedByMe: value, likeCount: post.likeCount + (value ? 1 : -1) }
        : { ...post, savedByMe: value, saveCount: post.saveCount + (value ? 1 : -1) };
    onChange(optimistic);
    try {
      const res = await (kind === 'like'
        ? api.social.like(token, post.id, value)
        : api.social.save(token, post.id, value));
      onChange({ ...optimistic, likeCount: res.likeCount, saveCount: res.saveCount });
      if (kind === 'save') toast(t(value ? 'social.savedDone' : 'social.unsavedDone'));
    } catch (e) {
      onChange(post);
      toast(t(errorKey(e)));
    }
  }

  function onImagePress() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      heart.setValue(0);
      Animated.sequence([
        Animated.spring(heart, { toValue: 1, useNativeDriver: true, friction: 4 }),
        Animated.timing(heart, { toValue: 0, duration: 250, delay: 350, useNativeDriver: true }),
      ]).start();
      if (!post.likedByMe && post.status === 'published') toggle('like');
    } else {
      lastTap.current = now;
    }
  }

  async function setVisibility(visibility: 'private' | 'public') {
    if (!token) return;
    try {
      const updated = await api.social.updatePost(token, post.id, { visibility });
      onChange(updated);
      toast(
        t(
          updated.status === 'pending'
            ? 'social.sentForReview'
            : visibility === 'public'
              ? 'social.nowPublic'
              : 'social.nowPrivate',
        ),
      );
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  function confirmDelete() {
    Alert.alert(t('social.deleteTitle'), t('social.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.delete'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await api.social.deletePost(token, post.id);
            toast(t('social.deleted'));
            onDeleted?.(post.id);
          } catch (e) {
            toast(t(errorKey(e)));
          }
        },
      },
    ]);
  }

  const menuOptions: SheetOption[] = post.isMine
    ? [
        ...(post.status !== 'removed'
          ? [
              post.visibility === 'public'
                ? {
                    label: t('social.makePrivate'),
                    icon: 'lock-closed-outline' as IconName,
                    onPress: () => setVisibility('private'),
                  }
                : {
                    label: t('social.makePublic'),
                    icon: 'globe-outline' as IconName,
                    onPress: () => setVisibility('public'),
                  },
            ]
          : []),
        { label: t('social.delete'), icon: 'trash-outline', danger: true, onPress: confirmDelete },
      ]
    : [
        {
          label: t('social.viewProfile'),
          icon: 'person-circle-outline',
          onPress: () => router.push({ pathname: '/user/[id]', params: { id: post.author.id } }),
        },
        {
          label: t('social.report'),
          icon: 'flag-outline',
          danger: true,
          onPress: () => setReport(true),
        },
      ];

  const n = post.meal?.nutrients;
  const heartScale = heart.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.2] });

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={post.author.name}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: post.author.id } })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, flex: 1 }}
        >
          <Avatar name={post.author.name} avatarId={post.author.avatarId} />
          <View style={{ flex: 1 }}>
            <View style={s.nameRow}>
              <Text style={s.name} numberOfLines={1}>
                {post.author.name}
              </Text>
              <RoleBadge role={post.author.role} />
            </View>
            <Text style={s.meta}>
              {t(`social.kinds.${post.kind}`)} · {timeAgo(post.createdAt, t, language)}
              {post.visibility === 'private' ? ` · ${t('social.private')}` : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('social.more')}
          hitSlop={10}
          onPress={() => setMenu(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <Pressable
        onPress={onImagePress}
        accessibilityLabel={post.caption || t(`social.kinds.${post.kind}`)}
      >
        {post.mediaId ? (
          <RemoteImage mediaId={post.mediaId} style={s.image} />
        ) : (
          // Sfatul echipei: text pe fundal colorat, in locul fotografiei.
          <LinearGradient
            colors={theme.gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.tip}
          >
            <View style={s.tipBadge}>
              <Ionicons name="bulb" size={14} color="#FFFFFF" />
              <Text style={s.tipBadgeText}>{t('social.tipBadge')}</Text>
            </View>
            {post.title ? <Text style={s.tipTitle}>{post.title}</Text> : null}
            <Text style={s.tipText}>{post.caption}</Text>
          </LinearGradient>
        )}
        <Animated.View
          pointerEvents="none"
          style={[s.bigHeart, { opacity: heart, transform: [{ scale: heartScale }] }]}
        >
          <Ionicons name="heart" size={96} color="#FFFFFF" />
        </Animated.View>
      </Pressable>

      {post.status === 'published' ? (
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: post.likedByMe }}
            accessibilityLabel={t('social.like')}
            style={s.action}
            onPress={() => toggle('like')}
          >
            <Ionicons
              name={post.likedByMe ? 'heart' : 'heart-outline'}
              size={26}
              color={post.likedByMe ? theme.colors.danger : theme.colors.text}
            />
            <Text style={s.count}>{post.likeCount}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: post.savedByMe }}
            accessibilityLabel={t('social.save')}
            style={s.action}
            onPress={() => toggle('save')}
          >
            <Ionicons
              name={post.savedByMe ? 'bookmark' : 'bookmark-outline'}
              size={24}
              color={post.savedByMe ? theme.colors.primary : theme.colors.text}
            />
          </Pressable>
        </View>
      ) : null}

      <View style={[s.body, post.status !== 'published' && { paddingTop: theme.spacing.sm }]}>
        {post.status === 'pending' ? (
          <View style={s.status}>
            <Ionicons name="time-outline" size={16} color={theme.colors.warning} />
            <Text style={s.statusText}>{t('social.pending')}</Text>
          </View>
        ) : null}
        {post.status === 'removed' ? (
          <View style={s.status}>
            <Ionicons name="eye-off-outline" size={16} color={theme.colors.warning} />
            <Text style={s.statusText}>
              {t('social.removed')}
              {post.removedReason ? `: ${post.removedReason}` : ''}
            </Text>
          </View>
        ) : null}
        {post.caption && post.mediaId ? <Text style={s.caption}>{post.caption}</Text> : null}
        {post.meal && n ? (
          <View style={s.meal}>
            <Ionicons name="nutrition-outline" size={18} color={theme.colors.primaryStrong} />
            <Text style={s.mealText}>
              {post.meal.dish} · {Math.round(n.kcal)} {t('common.kcal')} ·{' '}
              {t('common.proteinShort')} {Math.round(n.protein)} · {t('common.carbsShort')}{' '}
              {Math.round(n.carbs)} · {t('common.fatShort')} {Math.round(n.fat)}
            </Text>
          </View>
        ) : null}
      </View>

      <ActionSheet visible={menu} options={menuOptions} onClose={() => setMenu(false)} />
      {!post.isMine ? (
        <ReportSheet postId={post.id} visible={report} onClose={() => setReport(false)} />
      ) : null}
    </View>
  );
}

/** Grila de fotografii (albumul din profil). */
export function PhotoGrid({ posts, onPress }: { posts: Post[]; onPress: (post: Post) => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
      {posts.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="imagebutton"
          accessibilityLabel={p.caption || t(`social.kinds.${p.kind}`)}
          onPress={() => onPress(p)}
          style={{ width: '32.6%', aspectRatio: 1 }}
        >
          {p.mediaId ? (
            <RemoteImage
              mediaId={p.mediaId}
              style={{ width: '100%', height: '100%', borderRadius: 6 }}
            />
          ) : (
            <LinearGradient
              colors={theme.gradients.hero}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 6,
                padding: 8,
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <Ionicons name="bulb" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }} numberOfLines={4}>
                {p.title ?? p.caption}
              </Text>
            </LinearGradient>
          )}
          {p.visibility === 'private' || p.status !== 'published' ? (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 12,
                padding: 4,
              }}
            >
              <Ionicons
                name={
                  p.status === 'removed'
                    ? 'eye-off'
                    : p.status === 'pending'
                      ? 'time'
                      : 'lock-closed'
                }
                size={13}
                color="#FFFFFF"
              />
            </View>
          ) : null}
          {p.likeCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                left: 6,
                bottom: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
                backgroundColor: 'rgba(0,0,0,0.55)',
                borderRadius: 10,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <Ionicons name="heart" size={11} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                {p.likeCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ))}
      {posts.length === 0 ? null : <View style={{ height: theme.spacing.sm }} />}
    </View>
  );
}
