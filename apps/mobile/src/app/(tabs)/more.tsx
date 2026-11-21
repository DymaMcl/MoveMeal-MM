import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type ArticleCard, type MySocial, type Post, type TrophyStatus } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { ArticleRow } from '@/components/blog';
import { GoalCard, ProfileHero, TrophyShelf } from '@/components/profile';
import { ActionSheet, PhotoGrid } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Card, Notice, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { pickImage } from '@/state/images';
import { useStyles, useTheme } from '@/theme';

type Tab = 'album' | 'saved';

function Row({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: th.spacing.md,
      paddingVertical: 6,
    },
    value: { ...th.font.body, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  }));
  return (
    <View style={s.row}>
      <Text style={theme.font.caption}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

/** Profilul propriu: progresul spre obiectiv, albumul de fotografii si salvatele. */
export default function More() {
  const { t, formatWeeks } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { profile, session, signOut, resetProfile } = useAppState();
  const token = session?.token;
  const [social, setSocial] = useState<MySocial | null>(null);
  const [album, setAlbum] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ posts: Post[]; articles: ArticleCard[] } | null>(null);
  const [tab, setTab] = useState<Tab>('album');
  const [avatarMenu, setAvatarMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trophies, setTrophies] = useState<TrophyStatus[]>([]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const me = await api.social.me(token);
      setSocial(me);
      api
        .myTrophies(token)
        .then(setTrophies)
        .catch(() => undefined);
      const page = await api.social.userPosts(token, me.profile.id);
      setAlbum(page.items);
      setCursor(page.nextCursor);
      setSaved(await api.social.saved(token));
      setError(null);
    } catch (e) {
      setError(t(errorKey(e)));
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function more() {
    if (!token || !social || !cursor) return;
    const page = await api.social.userPosts(token, social.profile.id, cursor).catch(() => null);
    if (page) {
      setAlbum((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    }
  }

  async function changeAvatar(source: 'camera' | 'gallery') {
    if (!token) return;
    const picked = await pickImage(source, { maxSide: 640, square: true });
    if (picked === 'denied') return toast(t('photo.permissionCamera'));
    if (!picked) return;
    setUploading(true);
    try {
      const profileView = await api.social.setAvatar(token, picked.base64, 'image/jpeg');
      setSocial((prev) => (prev ? { ...prev, profile: profileView } : prev));
      toast(t('profile.photoSaved'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    if (!token) return;
    try {
      const profileView = await api.social.removeAvatar(token);
      setSocial((prev) => (prev ? { ...prev, profile: profileView } : prev));
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
    edit: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    empty: { alignItems: 'center', gap: th.spacing.sm, paddingVertical: th.spacing.lg },
    emptyText: { ...th.font.body, color: th.colors.textMuted, textAlign: 'center' },
  }));

  if (!profile) return null;
  const me = social?.profile;
  const savedTotal = (saved?.posts.length ?? 0) + (saved?.articles.length ?? 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={theme.colors.primary}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <ScreenHeader title={t('menu.profile')} />
        {error ? <Notice>{error}</Notice> : null}

        {me ? (
          <ProfileHero
            profile={me}
            onAvatarPress={() => setAvatarMenu(true)}
            stats={[
              { label: t('profile.posts'), value: me.stats.posts, onPress: () => setTab('album') },
              {
                label: t('profile.followers'),
                value: me.stats.followers,
                onPress: () =>
                  router.push({
                    pathname: '/follows/[id]',
                    params: { id: me.id, type: 'followers', name: me.displayName },
                  }),
              },
              {
                label: t('profile.following'),
                value: me.stats.following,
                onPress: () =>
                  router.push({
                    pathname: '/follows/[id]',
                    params: { id: me.id, type: 'following', name: me.displayName },
                  }),
              },
              {
                label: t('profile.saved'),
                value: social?.savedCount ?? 0,
                onPress: () => setTab('saved'),
              },
            ]}
            action={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('profile.edit')}
                style={s.edit}
                onPress={() => router.push('/profile-edit')}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="create-outline" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            }
          />
        ) : !error ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : null}

        {social?.progress ? (
          <GoalCard
            progress={social.progress}
            detail={social.progress}
            hidden={!social.profile.showProgress}
          />
        ) : null}

        <TrophyShelf trophies={trophies} own />

        <Button
          title={t('social.newPost')}
          icon="add-circle-outline"
          onPress={() => router.push('/post/new')}
        />

        <Segmented
          options={[
            { value: 'album' as Tab, label: t('profile.album'), icon: 'images-outline' },
            { value: 'saved' as Tab, label: t('profile.savedTab'), icon: 'bookmark-outline' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'album' ? (
          album === null ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : album.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="camera-outline" size={40} color={theme.colors.textMuted} />
              <Text style={s.emptyText}>{t('profile.albumEmpty')}</Text>
            </View>
          ) : (
            <>
              <PhotoGrid
                posts={album}
                onPress={(p) => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
              />
              {cursor ? (
                <Button
                  title={t('admin.loadMore')}
                  variant="ghost"
                  icon="chevron-down"
                  onPress={more}
                />
              ) : null}
            </>
          )
        ) : saved === null ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : savedTotal === 0 ? (
          <View style={s.empty}>
            <Ionicons name="bookmark-outline" size={40} color={theme.colors.textMuted} />
            <Text style={s.emptyText}>{t('profile.savedEmpty')}</Text>
          </View>
        ) : (
          <>
            {saved.posts.length ? (
              <>
                <View style={s.section}>
                  <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
                  <Text style={theme.font.heading}>{t('profile.savedPosts')}</Text>
                </View>
                <PhotoGrid
                  posts={saved.posts}
                  onPress={(p) => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
                />
              </>
            ) : null}
            {saved.articles.length ? (
              <>
                <View style={s.section}>
                  <Ionicons name="newspaper-outline" size={18} color={theme.colors.primary} />
                  <Text style={theme.font.heading}>{t('profile.savedArticles')}</Text>
                </View>
                {saved.articles.map((a) => (
                  <ArticleRow key={a.id} article={a} />
                ))}
              </>
            ) : null}
          </>
        )}

        <Card title={t('more.profile')} icon="person">
          <Row label={t('onboarding.personal.age')} value={`${profile.age} ${t('common.years')}`} />
          <Row
            label={t('onboarding.body.height')}
            value={`${profile.heightCm} ${t('common.cm')}`}
          />
          <Row
            label={t('onboarding.body.weight')}
            value={`${profile.weightKg} ${t('common.kg')}`}
          />
          <Row label={t('onboarding.goal.title')} value={t(`onboarding.goal.${profile.goal}`)} />
          {profile.targetWeightKg !== undefined ? (
            <Row
              label={t('onboarding.target.title')}
              value={`${profile.targetWeightKg} ${t('common.kg')} · ${formatWeeks(profile.weeks ?? 0)}`}
            />
          ) : null}
          <Row
            label={t('onboarding.activity.title')}
            value={t(`onboarding.activity.${profile.activityLevel}`)}
          />
          <Text style={[theme.font.caption, { fontSize: 12 }]}>{t('profile.privateData')}</Text>
        </Card>

        <Button
          title={t('progress.open')}
          icon="stats-chart"
          variant="secondary"
          onPress={() => router.push('/progress')}
        />
        <Button
          title={t('settings.title')}
          icon="settings-outline"
          variant="secondary"
          onPress={() => router.push('/settings')}
        />
        <Button
          title={t('more.resetProfile')}
          icon="refresh"
          variant="secondary"
          onPress={async () => {
            resetProfile();
            router.replace('/onboarding/personal');
          }}
        />
        <Button
          title={t('more.logout')}
          icon="log-out-outline"
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/welcome');
          }}
        />
      </ScrollView>

      <ActionSheet
        visible={avatarMenu}
        title={t('profile.changePhoto')}
        onClose={() => setAvatarMenu(false)}
        options={[
          {
            label: t('photo.camera'),
            icon: 'camera-outline',
            onPress: () => changeAvatar('camera'),
          },
          {
            label: t('photo.gallery'),
            icon: 'images-outline',
            onPress: () => changeAvatar('gallery'),
          },
          ...(me?.avatarId
            ? [
                {
                  label: t('profile.removePhoto'),
                  icon: 'trash-outline' as const,
                  danger: true,
                  onPress: removeAvatar,
                },
              ]
            : []),
        ]}
      />
    </SafeAreaView>
  );
}
