import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ArticleCard, BlogCategory } from '@/api/client';
import { Avatar, RemoteImage, RoleBadge } from '@/components/social';
import type { IconName } from '@/components/ui';
import { localeOf, useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

export const BLOG_CATEGORIES: BlogCategory[] = [
  'nutrition',
  'training',
  'health',
  'recipes',
  'motivation',
];

export const CATEGORY_ICONS: Record<BlogCategory, IconName> = {
  nutrition: 'nutrition-outline',
  training: 'barbell-outline',
  health: 'heart-outline',
  recipes: 'restaurant-outline',
  motivation: 'flame-outline',
};

/** Numar scurt: 1.2k, 15k. */
export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace('.0', '')}k`;
  return `${Math.round(n / 1000)}k`;
}

export function ArticleStats({ article }: { article: ArticleCard }) {
  const { t } = useI18n();
  const theme = useTheme();
  const item = (icon: IconName, text: string, label: string) => (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessible
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={14} color={theme.colors.textMuted} />
      <Text style={[theme.font.caption, { fontSize: 12 }]}>{text}</Text>
    </View>
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        flexWrap: 'wrap',
      }}
    >
      {item(
        'time-outline',
        t('blog.minutes', { n: article.readMinutes }),
        t('blog.minutes', { n: article.readMinutes }),
      )}
      {item('eye-outline', compact(article.viewCount), t('blog.views', { n: article.viewCount }))}
      {item(
        article.likedByMe ? 'heart' : 'heart-outline',
        compact(article.likeCount),
        t('blog.likes', { n: article.likeCount }),
      )}
    </View>
  );
}

/** Cardul mare din lista blogului. */
export function ArticleTile({ article, featured }: { article: ArticleCard; featured?: boolean }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    card: {
      backgroundColor: th.colors.surface,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      overflow: 'hidden',
    },
    cover: { width: '100%', aspectRatio: 16 / 9 },
    placeholder: {
      width: '100%',
      aspectRatio: 16 / 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: th.colors.primarySoft,
    },
    body: { padding: th.spacing.md, gap: th.spacing.sm },
    top: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    category: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.primarySoft,
    },
    categoryText: { fontSize: 12, fontWeight: '800', color: th.colors.primary },
    title: { ...th.font.heading, fontSize: featured ? 20 : 17, lineHeight: featured ? 26 : 22 },
    summary: { ...th.font.caption, fontSize: 14, lineHeight: 20 },
    author: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    authorName: { ...th.font.caption, fontWeight: '700', color: th.colors.text },
  }));
  const date = article.publishedAt ?? article.createdAt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={article.title}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push({ pathname: '/blog/[id]', params: { id: article.id } })}
    >
      {article.coverId ? (
        <RemoteImage mediaId={article.coverId} style={s.cover} />
      ) : (
        <View style={s.placeholder}>
          <Ionicons
            name={CATEGORY_ICONS[article.category]}
            size={44}
            color={theme.colors.primary}
          />
        </View>
      )}
      <View style={s.body}>
        <View style={s.top}>
          <View style={s.category}>
            <Ionicons
              name={CATEGORY_ICONS[article.category]}
              size={12}
              color={theme.colors.primary}
            />
            <Text style={s.categoryText}>{t(`blog.categories.${article.category}`)}</Text>
          </View>
          {article.pinned ? (
            <Ionicons
              name="pin"
              size={14}
              color={theme.colors.primary}
              accessibilityLabel={t('blog.pinned')}
            />
          ) : null}
          {article.savedByMe ? (
            <Ionicons name="bookmark" size={14} color={theme.colors.primary} />
          ) : null}
        </View>
        <Text style={s.title}>{article.title}</Text>
        {article.summary ? (
          <Text style={s.summary} numberOfLines={featured ? 3 : 2}>
            {article.summary}
          </Text>
        ) : null}
        <View style={s.author}>
          <Avatar name={article.author.name} avatarId={article.author.avatarId} size={26} />
          <Text style={s.authorName} numberOfLines={1}>
            {article.author.name}
          </Text>
          <RoleBadge role={article.author.role} />
          <Text style={[theme.font.caption, { marginLeft: 'auto', fontSize: 12 }]}>
            {new Date(date).toLocaleDateString(localeOf(language), {
              day: 'numeric',
              month: 'short',
            })}
          </Text>
        </View>
        <ArticleStats article={article} />
      </View>
    </Pressable>
  );
}

/** Rand compact (salvate, articolele mele, panoul administratorului). */
export function ArticleRow({
  article,
  onPress,
  right,
}: {
  article: ArticleCard;
  onPress?: () => void;
  right?: ReactNode;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const s = useStyles((th) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.sm + 2,
      borderRadius: th.radius.md,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    thumb: { width: 64, height: 64, borderRadius: th.radius.sm },
    thumbEmpty: {
      width: 64,
      height: 64,
      borderRadius: th.radius.sm,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { ...th.font.body, fontWeight: '700' },
  }));
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}
      onPress={
        onPress ?? (() => router.push({ pathname: '/blog/[id]', params: { id: article.id } }))
      }
    >
      {article.coverId ? (
        <RemoteImage mediaId={article.coverId} style={s.thumb} />
      ) : (
        <View style={s.thumbEmpty}>
          <Ionicons
            name={CATEGORY_ICONS[article.category]}
            size={26}
            color={theme.colors.primary}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={s.title} numberOfLines={2}>
          {article.title}
        </Text>
        <Text style={[theme.font.caption, { fontSize: 12 }]} numberOfLines={1}>
          {t(`blog.categories.${article.category}`)}
          {article.status !== 'published' ? ` · ${t(`blog.status.${article.status}`)}` : ''}
          {article.pinned ? ` · ${t('blog.pinned')}` : ''}
        </Text>
        <ArticleStats article={article} />
      </View>
      {right}
    </Pressable>
  );
}

/**
 * Textul articolului: paragrafe, subtitluri („## ”) si liste („- ”).
 * Formatul simplu permite scrierea articolelor direct din telefon.
 */
export function ArticleBody({ body }: { body: string }) {
  const theme = useTheme();
  const s = useStyles((th) => ({
    paragraph: { ...th.font.body, fontSize: 16, lineHeight: 25 },
    heading: { ...th.font.heading, fontSize: 19, marginTop: th.spacing.sm },
    bulletRow: { flexDirection: 'row', gap: th.spacing.sm, paddingLeft: 4 },
    bullet: { ...th.font.body, fontSize: 16, lineHeight: 25, color: th.colors.primary },
  }));
  const blocks = body.replace(/\r/g, '').split('\n');
  return (
    <View style={{ gap: theme.spacing.sm + 2 }}>
      {blocks.map((line, i) => {
        const text = line.trim();
        if (!text) return null;
        if (text.startsWith('## ') || text.startsWith('# ')) {
          return (
            <Text key={i} style={s.heading} accessibilityRole="header">
              {text.replace(/^#+\s*/, '')}
            </Text>
          );
        }
        if (/^[-•*]\s+/.test(text)) {
          return (
            <View key={i} style={s.bulletRow}>
              <Text style={s.bullet}>•</Text>
              <Text style={[s.paragraph, { flex: 1 }]}>{text.replace(/^[-•*]\s+/, '')}</Text>
            </View>
          );
        }
        return (
          <Text key={i} style={s.paragraph}>
            {text}
          </Text>
        );
      })}
    </View>
  );
}
