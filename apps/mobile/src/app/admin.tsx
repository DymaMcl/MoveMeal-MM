import { Redirect } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AnnouncementsSection,
  ArticlesSection,
  LogSection,
  SettingsSection,
} from '@/admin/content';
import { DashboardSection } from '@/admin/dashboard';
import { ModerationSection } from '@/admin/moderation';
import type { AdminTab } from '@/admin/types';
import { UsersSection } from '@/admin/users';
import { ScreenHeader } from '@/components/app-menu';
import { FilterRow } from '@/components/social';
import type { IconName } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

const TABS: { value: AdminTab; icon: IconName }[] = [
  { value: 'dashboard', icon: 'speedometer-outline' },
  { value: 'users', icon: 'people-outline' },
  { value: 'moderation', icon: 'shield-checkmark-outline' },
  { value: 'articles', icon: 'newspaper-outline' },
  { value: 'announcements', icon: 'megaphone-outline' },
  { value: 'log', icon: 'list-outline' },
  { value: 'settings', icon: 'options-outline' },
];

/** Panoul administratorului (doar pentru rolul „admin”; drepturile sunt verificate si pe server). */
export default function Admin() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  /** Filtrul cu care se deschide sectiunea (de exemplu „raportate” din tabloul de bord). */
  const [filter, setFilter] = useState<string | undefined>();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
  }));

  if (session && session.role !== 'admin') return <Redirect href="/" />;
  if (!session) return null;

  function open(next: AdminTab, nextFilter?: string) {
    setFilter(nextFilter);
    setTab(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  const token = session.token;
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScreenHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
        <FilterRow
          options={TABS.map((x) => ({
            value: x.value,
            label: t(`admin.tabs.${x.value}`),
            icon: x.icon,
          }))}
          value={tab}
          onChange={(next) => open(next)}
        />
        {tab === 'dashboard' ? <DashboardSection token={token} onNavigate={open} /> : null}
        {tab === 'users' ? (
          <UsersSection key={filter} token={token} initialStatus={filter} />
        ) : null}
        {tab === 'moderation' ? (
          <ModerationSection key={filter} token={token} initialFilter={filter} />
        ) : null}
        {tab === 'articles' ? <ArticlesSection token={token} /> : null}
        {tab === 'announcements' ? <AnnouncementsSection token={token} /> : null}
        {tab === 'log' ? <LogSection token={token} /> : null}
        {tab === 'settings' ? <SettingsSection token={token} /> : null}
        <Text style={[theme.font.caption, { textAlign: 'center' }]}>{t('admin.privacy')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
