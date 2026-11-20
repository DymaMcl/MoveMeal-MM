import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Article } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ArticleBody, CATEGORY_ICONS, compact } from '@/components/blog';
import { Avatar, RemoteImage, RoleBadge } from '@/components/social';
import { useToast } from '@/components/toast';
import { Notice } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** Articolul deschis; serverul numara cititorul o singura data. */
export default function ArticleScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = session?.token;
  const canEdit = article && (article.isMine || session?.role === 'admin');

  useEffect(() => {
    if (!token || !id) return;
    api.blog
      .get(token, id)
      .then(setArticle)
      .catch((e) => setError(t(errorKey(e))));
  }, [token, id, t]);

  async function toggle(kind: 'like' | 'save') {
    if (!token || !article) return;
    const value = kind === 'like' ? !article.likedByMe : !article.savedByMe;
    const optimistic =
      kind === 'like'
        ? { ...article, likedByMe: value, likeCount: article.likeCount + (value ? 1 : -1) }
        : { ...article, savedByMe: value, saveCount: article.saveCount + (value ? 1 : -1) };
    setArticle(optimistic);
    try {
      const res = await (kind === 'like'
        ? api.blog.like(token, article.id, value)
        : api.blog.save(token, article.id, value));
      setArticle({ ...optimistic, likeCount: res.likeCount, saveCount: res.saveCount });
      if (kind === 'save') toast(t(value ? 'social.savedDone' : 'social.unsavedDone'));
    } catch (e) {
      setArticle(article);
      toast(t(errorKey(e)));
    }
  }

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { paddingBottom: 120 },
    cover: { width: '100%', aspectRatio: 16 / 10 },
    coverEmpty: {
      width: '100%',
      aspectRatio: 16 / 7,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    topBar: {
      position: 'absolute',
      top: th.spacing.sm,
      left: th.spacing.md,
      right: th.spacing.md,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    round: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { padding: th.spacing.lg, gap: th.spacing.md },
    category: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    categoryText: { fontWeight: '800', color: th.colors.primary, fontSize: 13 },
    title: { ...th.font.title, fontSize: 26, lineHeight: 33 },
    summary: { ...th.font.body, fontSize: 17, lineHeight: 25, color: th.colors.textMuted },
    author: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      paddingVertical: th.spacing.sm,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: th.colors.border,
    },
    meta: { ...th.font.caption, fontSize: 12 },
    bar: {
      position: 'absolute',
      left: th.spacing.lg,
      right: th.spacing.lg,
      bottom: th.spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.lg,
      paddingHorizontal: th.spacing.lg,
      height: 58,
      borderRadius: 29,
      backgroundColor: th.colors.surface,
      borderWidth: 1,
      borderColor: th.colors.border,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 8,
    },
    barItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    barText: { ...th.font.body, fontWeight: '700' },
  }));

  if (error) {
    return (
      <SafeAreaView style={[s.safe, { padding: theme.spacing.lg, gap: theme.spacing.md }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={s.round}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Notice>{error}</Notice>
      </SafeAreaView>
    );
  }
  if (!article) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  const date = article.publishedAt ?? article.createdAt;
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <View>
          {article.coverId ? (
            <RemoteImage mediaId={article.coverId} style={s.cover} />
          ) : (
            <View style={s.coverEmpty}>
              <Ionicons
                name={CATEGORY_ICONS[article.category]}
                size={56}
                color={theme.colors.primary}
              />
            </View>
          )}
          <View style={s.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              onPress={() => router.back()}
              style={s.round}
            >
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </Pressable>
            {canEdit ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('blog.edit')}
                onPress={() =>
                  router.push({ pathname: '/blog/editor', params: { id: article.id } })
                }
                style={s.round}
              >
                <Ionicons name="create-outline" size={22} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={s.body}>
          <View style={s.category}>
            <Ionicons
              name={CATEGORY_ICONS[article.category]}
              size={16}
              color={theme.colors.primary}
            />
            <Text style={s.categoryText}>{t(`blog.categories.${article.category}`)}</Text>
            {article.status !== 'published' ? (
              <Text style={[s.categoryText, { color: theme.colors.warning }]}>
                · {t(`blog.status.${article.status}`)}
              </Text>
            ) : null}
          </View>
          <Text style={s.title} accessibilityRole="header">
            {article.title}
          </Text>
          {article.summary ? <Text style={s.summary}>{article.summary}</Text> : null}
          <View style={s.author}>
            <Avatar name={article.author.name} avatarId={article.author.avatarId} size={42} />
            <View style={{ flex: 1, gap: 2 }}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
              >
                <Text style={[theme.font.body, { fontWeight: '800' }]}>{article.author.name}</Text>
                <RoleBadge role={article.author.role} />
              </View>
              <Text style={s.meta}>
                {[
                  article.author.title,
                  new Date(date).toLocaleDateString(localeOf(language), {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                  t('blog.minutes', { n: article.readMinutes }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
          </View>
          <ArticleBody body={article.body} />
          <Text style={[theme.font.caption, { marginTop: theme.spacing.md }]}>
            {t('common.disclaimer')}
          </Text>
        </View>
      </ScrollView>

      {article.status === 'published' ? (
        <View style={s.bar}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: article.likedByMe }}
            accessibilityLabel={t('social.like')}
            style={s.barItem}
            onPress={() => toggle('like')}
          >
            <Ionicons
              name={article.likedByMe ? 'heart' : 'heart-outline'}
              size={24}
              color={article.likedByMe ? theme.colors.danger : theme.colors.text}
            />
            <Text style={s.barText}>{compact(article.likeCount)}</Text>
          </Pressable>
          <View
            style={s.barItem}
            accessible
            accessibilityLabel={t('blog.views', { n: article.viewCount })}
          >
            <Ionicons name="eye-outline" size={22} color={theme.colors.text} />
            <Text style={s.barText}>{compact(article.viewCount)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: article.savedByMe }}
            accessibilityLabel={t('social.save')}
            style={s.barItem}
            onPress={() => toggle('save')}
          >
            <Ionicons
              name={article.savedByMe ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={article.savedByMe ? theme.colors.primary : theme.colors.text}
            />
            <Text style={s.barText}>{t(article.savedByMe ? 'blog.saved' : 'blog.save')}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
