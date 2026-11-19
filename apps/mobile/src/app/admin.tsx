import { Ionicons } from '@expo/vector-icons';
import { Redirect, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type AdminLogEntry, type AdminStats, type AdminUser, type Role } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Notice, parseNumber, Segmented } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { formatDate } from '@/state/dates';
import { useStyles, useTheme } from '@/theme';

type Tab = 'stats' | 'users' | 'log' | 'settings';
const ROLES: Role[] = ['user', 'nutritionist', 'admin'];

/** Panoul administratorului (doar pentru rolul „admin”; drepturile sunt verificate si pe server). */
export default function Admin() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const [tab, setTab] = useState<Tab>('stats');
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
  }));

  if (session && session.role !== 'admin') return <Redirect href="/" />;
  if (!session) return null;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={t('admin.title')} />
        <Segmented
          options={[
            { value: 'stats' as Tab, label: t('admin.tabs.stats') },
            { value: 'users' as Tab, label: t('admin.tabs.users') },
            { value: 'log' as Tab, label: t('admin.tabs.log') },
            { value: 'settings' as Tab, label: t('admin.tabs.settings') },
          ]}
          value={tab}
          onChange={setTab}
        />
        {tab === 'stats' ? <StatsSection token={session.token} /> : null}
        {tab === 'users' ? <UsersSection token={session.token} /> : null}
        {tab === 'log' ? <LogSection token={session.token} /> : null}
        {tab === 'settings' ? <SettingsSection token={session.token} /> : null}
        <Text style={[theme.font.caption, { textAlign: 'center' }]}>{t('admin.privacy')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value, icon }: { label: string; value: number; icon: string }) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      padding: th.spacing.md,
      borderRadius: th.radius.md,
      borderWidth: 1,
      borderColor: th.colors.border,
      gap: 4,
    },
    value: { fontSize: 26, fontWeight: '900', color: th.colors.text },
    label: { ...th.font.caption },
  }));
  return (
    <View style={s.tile}>
      <Ionicons name={icon as 'people-outline'} size={20} color={theme.colors.primary} />
      <Text style={s.value}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

function StatsSection({ token }: { token: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.admin
        .stats(token)
        .then(setStats)
        .catch((e) => setError(t(errorKey(e))));
    }, [token, t]),
  );

  if (error) return <Notice>{error}</Notice>;
  if (!stats) return <ActivityIndicator color={theme.colors.primary} />;
  const grid = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: theme.spacing.sm };
  return (
    <>
      <Card title={t('admin.accounts')} icon="people-outline">
        <View style={grid}>
          <StatTile label={t('admin.total')} value={stats.users.total} icon="people-outline" />
          <StatTile label={t('roles.user')} value={stats.users.users} icon="person-outline" />
          <StatTile
            label={t('roles.nutritionist')}
            value={stats.users.nutritionists}
            icon="medkit-outline"
          />
          <StatTile
            label={t('roles.admin')}
            value={stats.users.admins}
            icon="shield-checkmark-outline"
          />
          <StatTile
            label={t('admin.newWeek')}
            value={stats.users.newThisWeek}
            icon="person-add-outline"
          />
          <StatTile
            label={t('admin.activeWeek')}
            value={stats.users.activeThisWeek}
            icon="pulse-outline"
          />
          <StatTile label={t('admin.blocked')} value={stats.users.blocked} icon="ban-outline" />
        </View>
      </Card>
      <Card title={t('admin.appointments')} icon="calendar-outline">
        <View style={grid}>
          {(['requested', 'confirmed', 'rejected', 'cancelled'] as const).map((k) => (
            <StatTile
              key={k}
              label={t(`consult.status.${k}`)}
              value={stats.appointments[k]}
              icon="calendar-outline"
            />
          ))}
        </View>
      </Card>
    </>
  );
}

function UsersSection({ token }: { token: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | 'all'>('all');
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reason, setReason] = useState('');
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
    [token, query, role, toast, t],
  );

  // Cautarea porneste la scurt timp dupa ultima tasta.
  useEffect(() => {
    const timer = setTimeout(() => load(0), 300);
    return () => clearTimeout(timer);
  }, [load]);

  function replace(user: AdminUser) {
    setItems((prev) => prev.map((u) => (u.id === user.id ? user : u)));
  }

  async function changeRole(user: AdminUser, next: Role) {
    if (next === user.role) return;
    try {
      replace(await api.admin.setRole(token, user.id, next));
      toast(t('admin.roleChanged'));
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  async function toggleBlock(user: AdminUser) {
    try {
      if (user.blockedAt) {
        replace(await api.admin.unblock(token, user.id));
        toast(t('admin.unblockedDone'));
      } else {
        replace(await api.admin.block(token, user.id, reason.trim()));
        toast(t('admin.blockedDone'));
        setReason('');
      }
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  const s = useStyles((th) => ({
    user: {
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
      gap: th.spacing.sm,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    email: { ...th.font.body, fontWeight: '700', flex: 1 },
    meta: { ...th.font.caption },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      borderWidth: 1,
      borderColor: th.colors.primary,
    },
    pillText: { fontSize: 11, fontWeight: '800', color: th.colors.primary },
    blocked: { ...th.font.caption, color: th.colors.danger },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
      color: th.colors.text,
    },
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
      <Segmented
        options={[
          { value: 'all' as const, label: t('admin.all') },
          ...ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) })),
        ]}
        value={role}
        onChange={setRole}
      />
      {!loading && items.length === 0 ? (
        <Text style={theme.font.caption}>{t('admin.noResults')}</Text>
      ) : null}
      {items.map((u) => {
        const self = u.email === session?.email;
        const expanded = open === u.id;
        return (
          <Pressable
            key={u.id}
            accessibilityRole="button"
            style={s.user}
            onPress={() => {
              setOpen(expanded ? null : u.id);
              setReason('');
            }}
          >
            <View style={s.head}>
              <Ionicons
                name={u.blockedAt ? 'ban' : 'person-circle-outline'}
                size={22}
                color={u.blockedAt ? theme.colors.danger : theme.colors.primary}
              />
              <Text style={s.email} numberOfLines={1}>
                {u.email}
                {self ? ` (${t('admin.you')})` : ''}
              </Text>
              <View style={s.pill}>
                <Text style={s.pillText}>{t(`roles.${u.role}`)}</Text>
              </View>
            </View>
            <Text style={s.meta}>
              {t('admin.registered', { date: formatDate(u.createdAt, locale) })}
            </Text>
            {u.blockedAt ? (
              <Text style={s.blocked}>
                {t('admin.blockedSince', {
                  date: formatDate(u.blockedAt, locale),
                  reason: u.blockedReason ?? '',
                })}
              </Text>
            ) : null}
            {expanded && !self ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text style={s.meta}>{t('admin.changeRole')}</Text>
                <Segmented
                  options={ROLES.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
                  value={u.role}
                  onChange={(r) => changeRole(u, r)}
                />
                {!u.blockedAt ? (
                  <>
                    <TextInput
                      style={s.input}
                      value={reason}
                      onChangeText={setReason}
                      placeholder={t('admin.blockReason')}
                      placeholderTextColor={theme.colors.textMuted}
                      maxLength={300}
                    />
                    <Text style={s.meta}>{t('admin.blockReasonHint')}</Text>
                  </>
                ) : null}
                <Button
                  title={u.blockedAt ? t('admin.unblock') : t('admin.block')}
                  icon={u.blockedAt ? 'lock-open-outline' : 'ban-outline'}
                  variant="secondary"
                  disabled={!u.blockedAt && reason.trim().length < 3}
                  onPress={() => toggleBlock(u)}
                />
              </View>
            ) : null}
          </Pressable>
        );
      })}
      {loading ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {!loading && items.length < total ? (
        <Button title={t('admin.loadMore')} variant="ghost" onPress={() => load(page + 1)} />
      ) : null}
    </View>
  );
}

function LogSection({ token }: { token: string }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [log, setLog] = useState<AdminLogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locale = localeOf(language);

  useFocusEffect(
    useCallback(() => {
      api.admin
        .log(token)
        .then(setLog)
        .catch((e) => setError(t(errorKey(e))));
    }, [token, t]),
  );

  const s = useStyles((th) => ({
    row: {
      paddingVertical: th.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: th.colors.border,
      gap: 2,
    },
    action: { ...th.font.body, fontWeight: '600', fontSize: 15 },
    meta: { ...th.font.caption },
  }));

  if (error) return <Notice>{error}</Notice>;
  if (!log) return <ActivityIndicator color={theme.colors.primary} />;
  if (log.length === 0) return <Text style={theme.font.caption}>{t('admin.logEmpty')}</Text>;

  const roleName = (r: unknown) => (typeof r === 'string' ? t(`roles.${r}`) : '—');
  return (
    <Card>
      {log.map((l) => (
        <View key={l.id} style={s.row}>
          <Text style={s.action}>
            {t(`admin.actions.${l.action}`, {
              from: roleName(l.details.from),
              to: roleName(l.details.to),
              reason: String(l.details.reason ?? ''),
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
  );
}

function SettingsSection({ token }: { token: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [days, setDays] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.admin
      .settings(token)
      .then((s) => setDays(String(s.freeConsultationDays)))
      .catch((e) => toast(t(errorKey(e))));
  }, [token, t, toast]);

  const value = parseNumber(days);
  const valid = value !== undefined && Number.isInteger(value) && value >= 0 && value <= 365;

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const saved = await api.admin.saveSettings(token, { freeConsultationDays: value! });
      setDays(String(saved.freeConsultationDays));
      toast(t('admin.settingsSaved'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t('admin.freeDays')} icon="gift-outline">
      <Field
        label={t('admin.freeDays')}
        value={days}
        onChangeText={setDays}
        keyboardType="number-pad"
        suffix={t('admin.days')}
        error={days && !valid ? t('onboarding.errors.range', { min: 0, max: 365 }) : null}
        hint={<Text style={theme.font.caption}>{t('admin.freeDaysHint')}</Text>}
      />
      <Button title={t('admin.saveSettings')} disabled={!valid || busy} onPress={save} />
    </Card>
  );
}
