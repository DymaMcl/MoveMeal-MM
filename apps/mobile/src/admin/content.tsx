import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from 'react-native';
import {
  api,
  type AdminLogEntry,
  type AdminSettings,
  type ArticleCard,
  type Audience,
} from '@/api/client';
import { errorKey } from '@/api/errors';
import { ArticleRow } from '@/components/blog';
import { ActionSheet, FilterRow, type SheetOption } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Notice, parseNumber, Segmented } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

// ------------------------------------------------------------------ articole

/** Toate articolele blogului: fixare, arhivare, republicare, modificare si stergere. */
export function ArticlesSection({ token }: { token: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [items, setItems] = useState<ArticleCard[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [menu, setMenu] = useState<ArticleCard | null>(null);

  const load = useCallback(() => {
    api.admin
      .articles(token)
      .then((page) => {
        setItems(page.items);
        setCursor(page.nextCursor);
      })
      .catch((e) => toast(t(errorKey(e))));
  }, [token, toast, t]);

  useFocusEffect(load);

  async function change(
    article: ArticleCard,
    body: { pinned?: boolean; status?: ArticleCard['status'] },
  ) {
    try {
      await api.admin.changeArticle(token, article.id, body);
      toast(t('admin.articleUpdated'));
      load();
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  const options = (a: ArticleCard): SheetOption[] => [
    ...(a.status === 'published'
      ? [
          {
            label: a.pinned ? t('admin.unpin') : t('admin.pin'),
            icon: 'pin-outline' as const,
            onPress: () => change(a, { pinned: !a.pinned }),
          },
          {
            label: t('blog.open'),
            icon: 'eye-outline' as const,
            onPress: () => router.push({ pathname: '/blog/[id]', params: { id: a.id } }),
          },
          {
            label: t('admin.archive'),
            icon: 'archive-outline' as const,
            onPress: () => change(a, { status: 'archived', pinned: false }),
          },
        ]
      : [
          {
            label: t('blog.publish'),
            icon: 'send-outline' as const,
            onPress: () => change(a, { status: 'published' }),
          },
        ]),
    {
      label: t('blog.edit'),
      icon: 'create-outline',
      onPress: () => router.push({ pathname: '/blog/editor', params: { id: a.id } }),
    },
    {
      label: t('blog.delete'),
      icon: 'trash-outline',
      danger: true,
      onPress: () =>
        Alert.alert(t('blog.deleteTitle'), t('blog.deleteText'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('social.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                await api.admin.deleteArticle(token, a.id);
                toast(t('blog.deleted'));
                load();
              } catch (e) {
                toast(t(errorKey(e)));
              }
            },
          },
        ]),
    },
  ];

  return (
    <View style={{ gap: theme.spacing.sm + 2 }}>
      <Button title={t('blog.newArticle')} icon="add" onPress={() => router.push('/blog/editor')} />
      {!items ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {items?.length === 0 ? <Text style={theme.font.caption}>{t('blog.empty')}</Text> : null}
      {items?.map((a) => (
        <ArticleRow
          key={a.id}
          article={a}
          onPress={() => setMenu(a)}
          right={<Ionicons name="ellipsis-vertical" size={20} color={theme.colors.textMuted} />}
        />
      ))}
      {cursor ? (
        <Button
          title={t('admin.loadMore')}
          variant="ghost"
          onPress={async () => {
            const page = await api.admin.articles(token, cursor).catch(() => null);
            if (page) {
              setItems((prev) => [...(prev ?? []), ...page.items]);
              setCursor(page.nextCursor);
            }
          }}
        />
      ) : null}
      <ActionSheet
        visible={menu !== null}
        title={menu ? `${menu.title} · ${menu.author.name}` : undefined}
        options={menu ? options(menu) : []}
        onClose={() => setMenu(null)}
      />
    </View>
  );
}

// ------------------------------------------------------------------ anunturi

/** Notificare trimisa tuturor utilizatorilor (sau doar unui rol). */
export function AnnouncementsSection({ token }: { token: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<AdminLogEntry[] | null>(null);
  const locale = localeOf(language);

  const loadHistory = useCallback(() => {
    api.admin
      .log(token, 'announcement')
      .then(setHistory)
      .catch(() => setHistory([]));
  }, [token]);

  useEffect(loadHistory, [loadHistory]);

  const valid = title.trim().length >= 3 && body.trim().length >= 3;

  function send() {
    Alert.alert(t('admin.sendTitle'), t(`admin.audienceConfirm.${audience}`), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('admin.send'),
        onPress: async () => {
          setSending(true);
          try {
            const res = await api.admin.announce(token, {
              title: title.trim(),
              body: body.trim(),
              audience,
            });
            toast(t('admin.sentTo', { n: res.recipients }));
            setTitle('');
            setBody('');
            loadHistory();
          } catch (e) {
            toast(t(errorKey(e)));
          } finally {
            setSending(false);
          }
        },
      },
    ]);
  }

  return (
    <>
      <Card title={t('admin.newAnnouncement')} icon="megaphone-outline">
        <Field
          label={t('admin.announcementTitle')}
          value={title}
          onChangeText={setTitle}
          maxLength={80}
        />
        <Field
          label={t('admin.announcementBody')}
          value={body}
          onChangeText={setBody}
          maxLength={500}
          multiline
          hint={<Text style={theme.font.caption}>{body.length}/500</Text>}
        />
        <Text style={[theme.font.caption, { fontWeight: '700' }]}>{t('admin.audience')}</Text>
        <Segmented
          options={[
            { value: 'all' as Audience, label: t('admin.all') },
            { value: 'user' as Audience, label: t('roles.user') },
            { value: 'nutritionist' as Audience, label: t('roles.nutritionist') },
          ]}
          value={audience}
          onChange={setAudience}
        />
        <Button title={t('admin.send')} icon="send" disabled={!valid || sending} onPress={send} />
      </Card>
      <Card title={t('admin.history')} icon="time-outline">
        {!history ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {history?.length === 0 ? (
          <Text style={theme.font.caption}>{t('admin.noAnnouncements')}</Text>
        ) : null}
        {history?.map((h) => (
          <View key={h.id} style={{ gap: 2, paddingVertical: 6 }}>
            <Text style={[theme.font.body, { fontWeight: '700' }]}>
              {String(h.details.title ?? '')}
            </Text>
            <Text style={theme.font.caption}>{String(h.details.body ?? '')}</Text>
            <Text style={[theme.font.caption, { fontSize: 12 }]}>
              {new Date(h.createdAt).toLocaleString(locale, {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {t('admin.recipients', { n: Number(h.details.recipients ?? 0) })}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

// ------------------------------------------------------------------ jurnal

const LOG_FILTERS = [
  'all',
  'role_changed',
  'account_blocked',
  'account_unblocked',
  'sessions_revoked',
  'post_removed',
  'post_approved',
  'article_changed',
  'announcement',
  'settings_changed',
] as const;

export function LogSection({ token }: { token: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [action, setAction] = useState<(typeof LOG_FILTERS)[number]>('all');
  const [log, setLog] = useState<AdminLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const locale = localeOf(language);

  useEffect(() => {
    setLog(null);
    setPage(0);
    api.admin
      .log(token, action === 'all' ? undefined : action)
      .then(setLog)
      .catch((e) => setError(t(errorKey(e))));
  }, [token, action, t]);

  const s = useStyles((th) => ({
    row: {
      paddingVertical: th.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: th.colors.border,
      gap: 2,
    },
    action: { ...th.font.body, fontWeight: '600', fontSize: 15 },
    meta: { ...th.font.caption, fontSize: 12 },
  }));

  const roleName = (r: unknown) => (typeof r === 'string' ? t(`roles.${r}`) : '—');
  return (
    <View style={{ gap: theme.spacing.md }}>
      <FilterRow
        options={LOG_FILTERS.map((f) => ({
          value: f,
          label: f === 'all' ? t('admin.all') : t(`admin.logFilters.${f}`),
        }))}
        value={action}
        onChange={setAction}
      />
      {error ? <Notice>{error}</Notice> : null}
      {!log && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {log?.length === 0 ? <Text style={theme.font.caption}>{t('admin.logEmpty')}</Text> : null}
      {log?.length ? (
        <Card>
          {log.map((l) => (
            <View key={l.id} style={s.row}>
              <Text style={s.action}>
                {t(`admin.actions.${l.action}`, {
                  from: roleName(l.details.from),
                  to: roleName(l.details.to),
                  reason: String(l.details.reason ?? ''),
                  title: String(l.details.title ?? ''),
                  n: Number(l.details.recipients ?? l.details.closed ?? 0),
                })}
              </Text>
              {l.targetEmail ? <Text style={s.meta}>{l.targetEmail}</Text> : null}
              <Text style={s.meta}>
                {new Date(l.createdAt).toLocaleString(locale, {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                · {l.adminEmail ? t('admin.by', { email: l.adminEmail }) : t('admin.system')}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {log && log.length === 50 * (page + 1) ? (
        <Button
          title={t('admin.loadMore')}
          variant="ghost"
          onPress={async () => {
            const next = await api.admin
              .log(token, action === 'all' ? undefined : action, page + 1)
              .catch(() => []);
            setLog((prev) => [...(prev ?? []), ...next]);
            setPage(page + 1);
          }}
        />
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ parametri

type NumberKey = 'freeConsultationDays' | 'aiChatDaily' | 'aiPhotoDaily' | 'postsDaily';
const LIMITS: Record<NumberKey, number> = {
  freeConsultationDays: 365,
  aiChatDaily: 500,
  aiPhotoDaily: 100,
  postsDaily: 100,
};

export function SettingsSection({ token }: { token: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [values, setValues] = useState<Record<NumberKey, string> | null>(null);
  const [flags, setFlags] = useState({ communityEnabled: true, communityPremoderation: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin
      .settings(token)
      .then(apply)
      .catch((e) => toast(t(errorKey(e))));
  }, [token, t, toast]);

  function apply(s: AdminSettings) {
    setValues({
      freeConsultationDays: String(s.freeConsultationDays),
      aiChatDaily: String(s.aiChatDaily),
      aiPhotoDaily: String(s.aiPhotoDaily),
      postsDaily: String(s.postsDaily),
    });
    setFlags({
      communityEnabled: s.communityEnabled,
      communityPremoderation: s.communityPremoderation,
    });
  }

  if (!values) return <ActivityIndicator color={theme.colors.primary} />;

  const parsed = Object.fromEntries(
    (Object.keys(values) as NumberKey[]).map((k) => [k, parseNumber(values[k])]),
  ) as Record<NumberKey, number | undefined>;
  const invalid = (k: NumberKey) => {
    const v = parsed[k];
    return v === undefined || !Number.isInteger(v) || v < 0 || v > LIMITS[k];
  };
  const valid = (Object.keys(values) as NumberKey[]).every((k) => !invalid(k));

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      apply(
        await api.admin.saveSettings(token, {
          ...(parsed as Record<NumberKey, number>),
          ...flags,
        }),
      );
      toast(t('admin.settingsSaved'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const numberField = (k: NumberKey, suffix: string) => (
    <Field
      key={k}
      label={t(`admin.settingsLabels.${k}`)}
      value={values[k]}
      onChangeText={(text) => setValues({ ...values, [k]: text })}
      keyboardType="number-pad"
      suffix={suffix}
      error={
        values[k] && invalid(k) ? t('onboarding.errors.range', { min: 0, max: LIMITS[k] }) : null
      }
      hint={<Text style={theme.font.caption}>{t(`admin.settingsHints.${k}`)}</Text>}
    />
  );

  const toggle = (k: keyof typeof flags) => (
    <Pressable
      key={k}
      accessibilityRole="switch"
      accessibilityState={{ checked: flags[k] }}
      onPress={() => setFlags({ ...flags, [k]: !flags[k] })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: 4,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[theme.font.body, { fontWeight: '700' }]}>
          {t(`admin.settingsLabels.${k}`)}
        </Text>
        <Text style={theme.font.caption}>{t(`admin.settingsHints.${k}`)}</Text>
      </View>
      <Switch
        value={flags[k]}
        onValueChange={(v) => setFlags({ ...flags, [k]: v })}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        thumbColor="#FFFFFF"
      />
    </Pressable>
  );

  return (
    <>
      <Card title={t('admin.community')} icon="people-outline">
        {toggle('communityEnabled')}
        {toggle('communityPremoderation')}
        {numberField('postsDaily', t('admin.perDay'))}
      </Card>
      <Card title={t('admin.ai')} icon="sparkles-outline">
        {numberField('aiChatDaily', t('admin.perDay'))}
        {numberField('aiPhotoDaily', t('admin.perDay'))}
      </Card>
      <Card title={t('admin.freeDays')} icon="gift-outline">
        {numberField('freeConsultationDays', t('admin.days'))}
      </Card>
      <Button
        title={t('admin.saveSettings')}
        icon="checkmark"
        disabled={!valid || busy}
        onPress={save}
      />
    </>
  );
}
