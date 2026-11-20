import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, TextInput, View } from 'react-native';
import { api, type ArticleInput, type BlogCategory } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { BLOG_CATEGORIES, CATEGORY_ICONS } from '@/components/blog';
import { FilterRow, RemoteImage } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Field, Notice, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { pickImage, type PickedImage } from '@/state/images';
import { useStyles, useTheme } from '@/theme';

/** Scrierea si modificarea unui articol (nutritionisti si administratori). */
export default function ArticleEditor() {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [loading, setLoading] = useState(Boolean(id));
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<BlogCategory>('nutrition');
  const [coverId, setCoverId] = useState<string | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const token = session?.token;

  useEffect(() => {
    if (!token || !id) return;
    api.blog
      .editable(token, id)
      .then((a) => {
        setTitle(a.title);
        setSummary(a.summary);
        setBody(a.body);
        setCategory(a.category);
        setCoverId(a.coverId);
        setPublished(a.status === 'published');
      })
      .catch((e) => toast(t(errorKey(e))))
      .finally(() => setLoading(false));
  }, [token, id, toast, t]);

  const titleError = title.trim().length < 5 ? t('blog.titleError') : null;
  const bodyError = body.trim().length < 20 ? t('blog.bodyError') : null;

  async function chooseCover() {
    const picked = await pickImage('gallery', { maxSide: 1600 });
    if (picked && picked !== 'denied') {
      setCover(picked);
      setRemoveCover(false);
    }
  }

  async function save(status: 'draft' | 'published') {
    if (!token || titleError || bodyError) return;
    const input: ArticleInput = {
      title: title.trim(),
      summary: summary.trim(),
      body: body.trim(),
      category,
      status,
      ...(cover ? { coverImage: cover.base64, coverMimeType: 'image/jpeg' as const } : {}),
      ...(removeCover && !cover ? { removeCover: true } : {}),
    };
    setSaving(true);
    try {
      const article = id
        ? await api.blog.update(token, id, input)
        : await api.blog.create(token, input);
      toast(t(status === 'published' ? 'blog.publishedDone' : 'blog.draftSaved'));
      if (id) router.back();
      else router.replace({ pathname: '/blog/[id]', params: { id: article.id } });
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!token || !id) return;
    Alert.alert(t('blog.deleteTitle'), t('blog.deleteText'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('social.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.blog.remove(token, id);
            toast(t('blog.deleted'));
            router.dismissTo('/blog/mine');
          } catch (e) {
            toast(t(errorKey(e)));
          }
        },
      },
    ]);
  }

  const s = useStyles((th) => ({
    label: { ...th.font.heading },
    cover: { width: '100%', aspectRatio: 16 / 9, borderRadius: th.radius.lg },
    coverEmpty: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: th.radius.lg,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: th.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: th.spacing.sm,
    },
    coverActions: {
      position: 'absolute',
      right: th.spacing.sm,
      bottom: th.spacing.sm,
      flexDirection: 'row',
      gap: th.spacing.sm,
    },
    coverButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    body: {
      minHeight: 280,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      padding: th.spacing.md - 4,
      color: th.colors.text,
      fontSize: 16,
      lineHeight: 23,
      textAlignVertical: 'top',
    },
    row: { flexDirection: 'row', gap: th.spacing.sm },
  }));

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title={t('blog.edit')} back />
        <ActivityIndicator color={theme.colors.primary} />
      </Screen>
    );
  }

  const showCover = cover?.uri ?? (!removeCover && coverId ? coverId : null);

  return (
    <Screen
      footer={
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <Button
              title={published ? t('blog.unpublish') : t('blog.saveDraft')}
              variant="secondary"
              icon="document-outline"
              disabled={saving || !!titleError || !!bodyError}
              onPress={() => save('draft')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title={published ? t('blog.update') : t('blog.publish')}
              icon="send"
              disabled={saving || !!titleError || !!bodyError}
              onPress={() => save('published')}
            />
          </View>
        </View>
      }
    >
      <ScreenHeader title={id ? t('blog.edit') : t('blog.newArticle')} back />

      {showCover ? (
        <View>
          {cover ? (
            <Image source={{ uri: cover.uri }} style={s.cover} resizeMode="cover" />
          ) : (
            <RemoteImage mediaId={coverId!} style={s.cover} />
          )}
          <View style={s.coverActions}>
            <Pressable accessibilityRole="button" style={s.coverButton} onPress={chooseCover}>
              <Ionicons name="images-outline" size={16} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{t('social.changePhoto')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('blog.removeCover')}
              style={s.coverButton}
              onPress={() => {
                setCover(null);
                setRemoveCover(true);
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="button" style={s.coverEmpty} onPress={chooseCover}>
          <Ionicons name="image-outline" size={36} color={theme.colors.primary} />
          <Text style={theme.font.caption}>{t('blog.addCover')}</Text>
        </Pressable>
      )}

      <Field
        label={t('blog.titleLabel')}
        value={title}
        onChangeText={setTitle}
        maxLength={140}
        error={title ? titleError : null}
      />
      <Field
        label={t('blog.summaryLabel')}
        value={summary}
        onChangeText={setSummary}
        maxLength={300}
        multiline
        placeholder={t('blog.summaryHint')}
      />
      <Text style={s.label}>{t('blog.categoryLabel')}</Text>
      <FilterRow
        options={BLOG_CATEGORIES.map((c) => ({
          value: c,
          label: t(`blog.categories.${c}`),
          icon: CATEGORY_ICONS[c],
        }))}
        value={category}
        onChange={setCategory}
      />
      <Text style={s.label}>{t('blog.bodyLabel')}</Text>
      <Notice tone="info">{t('blog.formatHint')}</Notice>
      <TextInput
        style={s.body}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={20000}
        placeholder={t('blog.bodyHint')}
        placeholderTextColor={theme.colors.textMuted}
      />
      <Text style={[theme.font.caption, { textAlign: 'right' }]}>
        {body.length}/20000 ·{' '}
        {t('blog.minutes', {
          n: Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200)),
        })}
      </Text>
      {id ? (
        <Button
          title={t('blog.delete')}
          icon="trash-outline"
          variant="ghost"
          onPress={confirmDelete}
        />
      ) : null}
    </Screen>
  );
}
