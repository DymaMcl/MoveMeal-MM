import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Post, type PostKind } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { ActionSheet, FilterRow, KIND_ICONS, POST_KINDS, PostCard } from '@/components/social';
import { Button, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** following = doar persoanele urmarite; tip = sfaturile echipei. */
type Filter = PostKind | 'all' | 'following';

function query(filter: Filter): { kind: PostKind | null; scope: 'all' | 'following' } {
  if (filter === 'following') return { kind: null, scope: 'following' };
  return { kind: filter === 'all' ? null : filter, scope: 'all' };
}

/** Lenta comunitatii: fotografii cu mese si activitati sportive, ca idei pentru ceilalti. */
export default function Community() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const token = session?.token;
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const request = useRef(0);
  // Nutritionistii si administratorii pot publica si sfaturi text.
  const staff = session?.role === 'nutritionist' || session?.role === 'admin';

  const load = useCallback(
    async (kind: Filter) => {
      if (!token) return;
      const id = ++request.current;
      try {
        const q = query(kind);
        const page = await api.social.feed(token, q.kind, null, q.scope);
        if (id !== request.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setError(null);
      } catch (e) {
        if (id === request.current) setError(t(errorKey(e)));
      }
    },
    [token, t],
  );

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  async function more() {
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(filter);
      const page = await api.social.feed(token, q.kind, cursor, q.scope);
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // Se reincearca la urmatoarea derulare.
    } finally {
      setLoadingMore(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    await load(filter);
    setRefreshing(false);
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    list: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: 110 },
    header: { gap: th.spacing.md },
    empty: { alignItems: 'center', gap: th.spacing.sm, paddingVertical: th.spacing.xl },
    emptyText: { ...th.font.body, textAlign: 'center', color: th.colors.textMuted },
    fab: {
      position: 'absolute',
      right: th.spacing.lg,
      bottom: th.spacing.lg,
      height: 56,
      borderRadius: 28,
      paddingHorizontal: th.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      backgroundColor: th.colors.primary,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    fabText: { color: th.colors.onPrimary, fontWeight: '800', fontSize: 15 },
    blog: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
  }));

  const replace = (post: Post) =>
    setItems((prev) => prev?.map((p) => (p.id === post.id ? post : p)) ?? prev);
  const remove = (id: string) => setItems((prev) => prev?.filter((p) => p.id !== id) ?? prev);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FlatList
        data={items ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => <PostCard post={item} onChange={replace} onDeleted={remove} />}
        onEndReachedThreshold={0.6}
        onEndReached={more}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={s.header}>
            <ScreenHeader title={t('social.title')} subtitle={t('social.subtitle')} />
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [s.blog, pressed && { opacity: 0.85 }]}
              onPress={() => router.push('/blog')}
            >
              <Ionicons name="newspaper-outline" size={26} color={theme.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={theme.font.heading}>{t('blog.title')}</Text>
                <Text style={theme.font.caption}>{t('blog.teaser')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
            </Pressable>
            <FilterRow
              options={[
                { value: 'all' as Filter, label: t('social.all'), icon: 'apps-outline' },
                {
                  value: 'following' as Filter,
                  label: t('social.following'),
                  icon: 'people-outline',
                },
                { value: 'tip' as Filter, label: t('social.tips'), icon: KIND_ICONS.tip },
                ...POST_KINDS.map((k) => ({
                  value: k as Filter,
                  label: t(`social.kinds.${k}`),
                  icon: KIND_ICONS[k],
                })),
              ]}
              value={filter}
              onChange={(f) => {
                setItems(null);
                setFilter(f);
              }}
            />
            {error ? <Notice>{error}</Notice> : null}
          </View>
        }
        ListEmptyComponent={
          items === null && !error ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : !error ? (
            <View style={s.empty}>
              <Ionicons
                name={filter === 'following' ? 'people-outline' : 'images-outline'}
                size={48}
                color={theme.colors.textMuted}
              />
              <Text style={s.emptyText}>
                {filter === 'following' ? t('social.followingEmpty') : t('social.empty')}
              </Text>
              {filter === 'following' ? null : (
                <Button
                  title={t('social.first')}
                  icon="add"
                  onPress={() => router.push('/post/new')}
                />
              )}
            </View>
          ) : undefined
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.colors.primary} /> : undefined
        }
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('social.newPost')}
        style={({ pressed }) => [s.fab, pressed && { opacity: 0.9 }]}
        onPress={() => (staff ? setComposer(true) : router.push('/post/new'))}
      >
        <Ionicons name="add" size={24} color={theme.colors.onPrimary} />
        <Text style={s.fabText}>{t('social.newPost')}</Text>
      </Pressable>
      <ActionSheet
        visible={composer}
        title={t('social.newPost')}
        onClose={() => setComposer(false)}
        options={[
          {
            label: t('social.composePhoto'),
            icon: 'camera-outline',
            onPress: () => router.push('/post/new'),
          },
          {
            label: t('social.composeTip'),
            icon: 'bulb-outline',
            onPress: () => router.push('/post/tip'),
          },
        ]}
      />
    </SafeAreaView>
  );
}
