import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type ArticleCard, type BlogCategory } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { ArticleTile, BLOG_CATEGORIES, CATEGORY_ICONS } from '@/components/blog';
import { FilterRow } from '@/components/social';
import { Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

type Filter = BlogCategory | 'all';

/** Blogul: articole despre alimentatie si sport scrise de nutritionisti si administratori. */
export default function Blog() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const token = session?.token;
  const staff = session?.role === 'nutritionist' || session?.role === 'admin';
  const [category, setCategory] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [pinned, setPinned] = useState<ArticleCard[]>([]);
  const [items, setItems] = useState<ArticleCard[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const load = useCallback(async () => {
    if (!token) return;
    const id = ++request.current;
    try {
      const page = await api.blog.list(token, {
        category: category === 'all' ? null : category,
        q: query.trim() || undefined,
      });
      if (id !== request.current) return;
      setPinned(page.pinned);
      setItems(page.items);
      setCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      if (id === request.current) setError(t(errorKey(e)));
    }
  }, [token, category, query, t]);

  // Cautarea porneste la scurt timp dupa ultima tasta.
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => clearTimeout(timer);
  }, [load]);

  // La revenirea din articol se actualizeaza contoarele (vizualizari, aprecieri).
  useFocusEffect(
    useCallback(() => {
      if (items) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  async function more() {
    if (!token || !cursor) return;
    const page = await api.blog
      .list(token, { category: category === 'all' ? null : category, q: query.trim(), cursor })
      .catch(() => null);
    if (page) {
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    list: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: 110 },
    header: { gap: th.spacing.md },
    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.pill,
      paddingHorizontal: th.spacing.md,
      backgroundColor: th.colors.surface,
    },
    input: { flex: 1, minHeight: 46, fontSize: 15, color: th.colors.text },
    pinnedTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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
    },
    fabText: { color: th.colors.onPrimary, fontWeight: '800', fontSize: 15 },
    empty: { alignItems: 'center', gap: th.spacing.sm, paddingVertical: th.spacing.xl },
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <FlatList
        data={items ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={s.list}
        renderItem={({ item }) => <ArticleTile article={item} />}
        onEndReachedThreshold={0.6}
        onEndReached={more}
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
        ListHeaderComponent={
          <View style={s.header}>
            <ScreenHeader title={t('blog.title')} subtitle={t('blog.subtitle')} back />
            <View style={s.search}>
              <Ionicons name="search" size={18} color={theme.colors.textMuted} />
              <TextInput
                style={s.input}
                value={query}
                onChangeText={setQuery}
                placeholder={t('blog.search')}
                placeholderTextColor={theme.colors.textMuted}
                returnKeyType="search"
              />
            </View>
            <FilterRow
              options={[
                { value: 'all' as Filter, label: t('social.all'), icon: 'apps-outline' },
                ...BLOG_CATEGORIES.map((c) => ({
                  value: c as Filter,
                  label: t(`blog.categories.${c}`),
                  icon: CATEGORY_ICONS[c],
                })),
              ]}
              value={category}
              onChange={setCategory}
            />
            {error ? <Notice>{error}</Notice> : null}
            {pinned.length ? (
              <>
                <View style={s.pinnedTitle}>
                  <Ionicons name="pin" size={16} color={theme.colors.primary} />
                  <Text style={theme.font.heading}>{t('blog.recommended')}</Text>
                </View>
                {pinned.map((a) => (
                  <ArticleTile key={a.id} article={a} featured />
                ))}
                <Text style={theme.font.heading}>{t('blog.latest')}</Text>
              </>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          items === null && !error ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : !error && !pinned.length ? (
            <View style={s.empty}>
              <Ionicons name="newspaper-outline" size={48} color={theme.colors.textMuted} />
              <Text
                style={[theme.font.body, { color: theme.colors.textMuted, textAlign: 'center' }]}
              >
                {t('blog.empty')}
              </Text>
            </View>
          ) : undefined
        }
      />
      {staff ? (
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [s.fab, pressed && { opacity: 0.9 }]}
          onPress={() => router.push('/blog/mine')}
        >
          <Ionicons name="create-outline" size={22} color={theme.colors.onPrimary} />
          <Text style={s.fabText}>{t('blog.myArticles')}</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
