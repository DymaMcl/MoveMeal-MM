import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Post, type SocialProfile } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { GoalCard, ProfileHero } from '@/components/profile';
import { PhotoGrid } from '@/components/social';
import { Button, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** Profilul public al altui utilizator: progresul (daca il arata) si albumul public. */
export default function UserProfile() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = session?.token;

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [p, page] = [
        await api.social.profile(token, id),
        await api.social.userPosts(token, id),
      ];
      // Profilul propriu se deschide in tabul „Profil”.
      if (p.isMe) {
        router.replace('/more');
        return;
      }
      setProfile(p);
      setPosts(page.items);
      setCursor(page.nextCursor);
    } catch (e) {
      setError(t(errorKey(e)));
    }
  }, [token, id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function more() {
    if (!token || !id || !cursor) return;
    const page = await api.social.userPosts(token, id, cursor).catch(() => null);
    if (page) {
      setPosts((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    section: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={profile?.displayName ?? t('profile.title')} back />
        {error ? <Notice>{error}</Notice> : null}
        {!profile && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {profile ? (
          <>
            <ProfileHero
              profile={profile}
              stats={[
                { label: t('profile.posts'), value: profile.stats.posts },
                { label: t('profile.likes'), value: profile.stats.likes },
              ]}
            />
            {profile.progress ? <GoalCard progress={profile.progress} /> : null}
            <View style={s.section}>
              <Ionicons name="images-outline" size={20} color={theme.colors.primary} />
              <Text style={theme.font.heading}>{t('profile.album')}</Text>
            </View>
            {posts.length === 0 ? (
              <Text style={[theme.font.caption, { textAlign: 'center', paddingVertical: 24 }]}>
                {t('profile.albumEmptyOther')}
              </Text>
            ) : (
              <PhotoGrid
                posts={posts}
                onPress={(p) => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
              />
            )}
            {cursor ? (
              <Button
                title={t('admin.loadMore')}
                variant="ghost"
                icon="chevron-down"
                onPress={more}
              />
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
