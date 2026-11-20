import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { api, type AdminUser, type AdminUserDetail, type Role } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ActionSheet, Avatar, FilterRow } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Field, Segmented } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDate } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

const ROLES: Role[] = ['user', 'nutritionist', 'admin'];
type RoleFilter = Role | 'all';
type StatusFilter = 'all' | 'active' | 'blocked';

/** Conturile: cautare, filtre si fisa fiecarui cont cu actiunile administratorului. */
export function UsersSection({ token, initialStatus }: { token: string; initialStatus?: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<RoleFilter>('all');
  const [status, setStatus] = useState<StatusFilter>(
    initialStatus === 'blocked' ? 'blocked' : 'all',
  );
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<AdminUser | null>(null);
  const locale = localeOf(language);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const res = await api.admin.users(
          token,
          query,
          role === 'all' ? undefined : role,
          nextPage,
          status === 'all' ? undefined : status,
        );
        setItems((prev) => (nextPage === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
        setPage(nextPage);
      } catch (e) {
        toast(t(errorKey(e)));
      } finally {
        setLoading(false);
      }
    },
    [token, query, role, status, toast, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => load(0), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const s = useStyles((th) => ({
    user: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md - 4,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    name: { ...th.font.body, fontWeight: '700' },
    meta: { ...th.font.caption, fontSize: 12 },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.primary,
    },
    pillText: { fontSize: 11, fontWeight: '800', color: th.colors.primary },
  }));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Field
        label={t('admin.search')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        icon="search"
      />
      <FilterRow
        options={[
          { value: 'all' as RoleFilter, label: t('admin.all') },
          ...ROLES.map((r) => ({ value: r as RoleFilter, label: t(`roles.${r}`) })),
        ]}
        value={role}
        onChange={setRole}
      />
      <Segmented
        options={[
          { value: 'all' as StatusFilter, label: t('admin.all') },
          { value: 'active' as StatusFilter, label: t('admin.active') },
          { value: 'blocked' as StatusFilter, label: t('admin.blocked') },
        ]}
        value={status}
        onChange={setStatus}
      />
      <Text style={theme.font.caption}>{t('admin.found', { n: total })}</Text>
      {items.map((u) => (
        <Pressable
          key={u.id}
          accessibilityRole="button"
          style={({ pressed }) => [s.user, pressed && { opacity: 0.85 }]}
          onPress={() => setOpen(u)}
        >
          <Avatar name={u.displayName ?? u.email} avatarId={null} size={42} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.name} numberOfLines={1}>
              {u.displayName ?? u.email.split('@')[0]}
            </Text>
            <Text style={s.meta} numberOfLines={1}>
              {u.email}
            </Text>
            <Text style={[s.meta, u.blockedAt ? { color: theme.colors.danger } : null]}>
              {u.blockedAt
                ? t('admin.blockedShort', { date: formatDate(u.blockedAt, locale) })
                : u.lastActiveAt
                  ? t('admin.lastLogin', { date: formatDate(u.lastActiveAt, locale) })
                  : t('admin.registered', { date: formatDate(u.createdAt, locale) })}
            </Text>
          </View>
          <View style={s.pill}>
            <Text style={s.pillText}>{t(`roles.${u.role}`)}</Text>
          </View>
        </Pressable>
      ))}
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {!loading && items.length === 0 ? (
        <Text style={theme.font.caption}>{t('admin.noResults')}</Text>
      ) : null}
      {!loading && items.length < total ? (
        <Button title={t('admin.loadMore')} variant="ghost" onPress={() => load(page + 1)} />
      ) : null}
      {open ? (
        <UserSheet
          token={token}
          user={open}
          onClose={() => setOpen(null)}
          onChange={(u) => {
            setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)));
            setOpen(u);
          }}
        />
      ) : null}
    </View>
  );
}

/** Fisa contului: activitatea (fara date de sanatate) si actiunile administratorului. */
function UserSheet({
  token,
  user,
  onClose,
  onChange,
}: {
  token: string;
  user: AdminUser;
  onClose: () => void;
  onChange: (user: AdminUser) => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const self = user.email === session?.email;
  const locale = localeOf(language);

  const reload = useCallback(() => {
    api.admin
      .user(token, user.id)
      .then(setDetail)
      .catch((e) => toast(t(errorKey(e))));
  }, [token, user.id, toast, t]);

  useEffect(reload, [reload]);

  async function run(action: () => Promise<AdminUser | unknown>, message: string) {
    setBusy(true);
    try {
      const result = await action();
      if (result && typeof result === 'object' && 'email' in result) onChange(result as AdminUser);
      toast(message);
      setReason('');
      reload();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const s = useStyles((th) => ({
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: th.spacing.sm },
    stat: {
      flexBasis: '30%',
      flexGrow: 1,
      padding: th.spacing.sm,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.surfaceAlt,
      gap: 2,
    },
    statValue: { fontSize: 18, fontWeight: '900', color: th.colors.text },
    statLabel: { ...th.font.caption, fontSize: 11 },
    label: { ...th.font.caption, fontWeight: '700', marginTop: th.spacing.sm },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
      color: th.colors.text,
    },
    blocked: { ...th.font.caption, color: th.colors.danger },
  }));

  const a = detail?.activity;
  const stat = (label: string, value: number | string) => (
    <View style={s.stat} key={label}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );

  return (
    <ActionSheet visible onClose={onClose}>
      <View style={s.head}>
        <Avatar name={user.displayName ?? user.email} avatarId={null} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={theme.font.heading}>{user.displayName ?? user.email.split('@')[0]}</Text>
          <Text style={theme.font.caption}>{user.email}</Text>
          <Text style={[theme.font.caption, { fontSize: 12 }]}>
            {t('admin.registered', { date: formatDate(user.createdAt, locale) })}
          </Text>
        </View>
      </View>
      {user.blockedAt ? (
        <Text style={s.blocked}>
          {t('admin.blockedSince', {
            date: formatDate(user.blockedAt, locale),
            reason: user.blockedReason ?? '',
          })}
        </Text>
      ) : null}

      {!a ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <View style={s.grid}>
          {stat(t('admin.sessions'), a.activeSessions)}
          {stat(t('admin.posts'), `${a.publicPosts}/${a.posts}`)}
          {stat(t('admin.removedPosts'), a.removedPosts)}
          {stat(t('admin.reportsAgainst'), a.reportsAgainst)}
          {stat(t('admin.rejectedUploads'), a.rejectedUploads)}
          {stat(t('admin.articles'), a.articles)}
          {stat(t('admin.aiChat7'), a.aiChatWeek)}
          {stat(t('admin.aiPhoto7'), a.aiPhotoWeek)}
          {stat(t('admin.appointmentsShort'), a.appointments)}
        </View>
      )}

      {self ? (
        <Text style={theme.font.caption}>{t('admin.selfNote')}</Text>
      ) : (
        <>
          <Text style={s.label}>{t('admin.changeRole')}</Text>
          <Segmented
            options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
            value={user.role}
            onChange={(r) =>
              r !== user.role &&
              run(() => api.admin.setRole(token, user.id, r), t('admin.roleChanged'))
            }
          />
          {user.role === 'nutritionist' ? (
            <Text style={[theme.font.caption, { fontSize: 12 }]}>
              {t('admin.nutritionistHint')}
            </Text>
          ) : null}

          <Text style={s.label}>{t('admin.security')}</Text>
          <Button
            title={t('admin.logoutEverywhere')}
            icon="log-out-outline"
            variant="secondary"
            disabled={busy || !a?.activeSessions}
            onPress={() => run(() => api.admin.logoutUser(token, user.id), t('admin.loggedOut'))}
          />
          {a && (a.failedLogins > 0 || a.lockedUntil) ? (
            <Button
              title={t('admin.unlockLogin', { n: a.failedLogins })}
              icon="key-outline"
              variant="secondary"
              disabled={busy}
              onPress={() => run(() => api.admin.unlockUser(token, user.id), t('admin.unlocked'))}
            />
          ) : null}

          {user.blockedAt ? (
            <Button
              title={t('admin.unblock')}
              icon="lock-open-outline"
              disabled={busy}
              onPress={() => run(() => api.admin.unblock(token, user.id), t('admin.unblockedDone'))}
            />
          ) : (
            <>
              <TextInput
                style={s.input}
                value={reason}
                onChangeText={setReason}
                placeholder={t('admin.blockReason')}
                placeholderTextColor={theme.colors.textMuted}
                maxLength={300}
              />
              <Text style={[theme.font.caption, { fontSize: 12 }]}>
                {t('admin.blockReasonHint')}
              </Text>
              <Button
                title={t('admin.block')}
                icon="ban-outline"
                variant="secondary"
                disabled={busy || reason.trim().length < 3}
                onPress={() =>
                  run(() => api.admin.block(token, user.id, reason.trim()), t('admin.blockedDone'))
                }
              />
            </>
          )}
          {a && a.posts > 0 ? (
            <Pressable
              accessibilityRole="link"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
              onPress={() => {
                onClose();
                router.push({ pathname: '/user/[id]', params: { id: user.id } });
              }}
            >
              <Ionicons name="images-outline" size={18} color={theme.colors.primary} />
              <Text style={[theme.font.body, { color: theme.colors.primary, fontWeight: '700' }]}>
                {t('admin.viewPublicProfile')}
              </Text>
            </Pressable>
          ) : null}
        </>
      )}
      <Text style={[theme.font.caption, { fontSize: 11 }]}>{t('admin.privacy')}</Text>
    </ActionSheet>
  );
}
