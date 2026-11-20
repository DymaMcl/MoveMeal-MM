import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type ArticleCard } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { ArticleRow } from '@/components/blog';
import { Button, Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** Articolele autorului (ciorne, publicate, arhivate). */
export default function MyArticles() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const [items, setItems] = useState<ArticleCard[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = session?.token;
  const staff = session?.role === 'nutritionist' || session?.role === 'admin';

  useFocusEffect(
    useCallback(() => {
      if (!token || !staff) return;
      api.blog
        .authored(token)
        .then((page) => {
          // Administratorul vede toate articolele; aici raman doar ale sale.
          setItems(page.items.filter((a) => a.isMine));
          setCursor(page.nextCursor);
        })
        .catch((e) => setError(t(errorKey(e))));
    }, [token, staff, t]),
  );

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.sm + 2, paddingBottom: th.spacing.xl },
  }));

  if (session && !staff) return <Redirect href="/blog" />;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('blog.myArticles')} back />
        <Button
          title={t('blog.newArticle')}
          icon="add"
          onPress={() => router.push('/blog/editor')}
        />
        {error ? <Notice>{error}</Notice> : null}
        {!items && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {items && items.length === 0 ? (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 32 }}>
            <Ionicons name="document-text-outline" size={44} color={theme.colors.textMuted} />
            <Text style={[theme.font.body, { color: theme.colors.textMuted }]}>
              {t('blog.noArticles')}
            </Text>
          </View>
        ) : null}
        {items?.map((a) => (
          <ArticleRow
            key={a.id}
            article={a}
            onPress={() =>
              router.push(
                a.status === 'published'
                  ? { pathname: '/blog/[id]', params: { id: a.id } }
                  : { pathname: '/blog/editor', params: { id: a.id } },
              )
            }
          />
        ))}
        {cursor ? (
          <Button
            title={t('admin.loadMore')}
            variant="ghost"
            icon="chevron-down"
            onPress={async () => {
              if (!token) return;
              const page = await api.blog.authored(token, cursor).catch(() => null);
              if (page) {
                setItems((prev) => [...(prev ?? []), ...page.items.filter((a) => a.isMine)]);
                setCursor(page.nextCursor);
              }
            }}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
