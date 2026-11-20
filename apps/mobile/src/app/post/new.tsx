import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, TextInput, View } from 'react-native';
import { api, type PostKind, type Visibility } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { FilterRow, KIND_ICONS, POST_KINDS } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button, Notice, OptionCard, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { pickImage, takeStashedImage, type PickedImage } from '@/state/images';
import { useStyles, useTheme } from '@/theme';

const MAX_CAPTION = 500;

/**
 * Postarea unei fotografii: doar in albumul propriu (privat) sau si in lenta comunitatii.
 * Inainte de salvare, serverul verifica imaginea automat (AI).
 */
export default function NewPost() {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const params = useLocalSearchParams<{
    imageKey?: string;
    foodPhotoId?: string;
    dish?: string;
    kcal?: string;
  }>();
  // Fotografia mesei vine din ecranul „Fotografiaza masa” (deja micsorata).
  const [image, setImage] = useState<PickedImage | null>(() => takeStashedImage(params.imageKey));
  const [kind, setKind] = useState<PostKind>('meal');
  const [caption, setCaption] = useState(params.dish ?? '');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [publishing, setPublishing] = useState(false);

  async function choose(source: 'camera' | 'gallery') {
    const picked = await pickImage(source);
    if (picked === 'denied') toast(t('photo.permissionCamera'));
    else if (picked) setImage(picked);
  }

  async function publish() {
    if (!session || !image) return;
    setPublishing(true);
    try {
      const post = await api.social.createPost(session.token, {
        image: image.base64,
        mimeType: 'image/jpeg',
        caption: caption.trim(),
        kind,
        visibility,
        ...(params.foodPhotoId ? { foodPhotoId: params.foodPhotoId } : {}),
      });
      toast(
        t(
          post.status === 'pending'
            ? 'social.sentForReview'
            : visibility === 'public'
              ? 'social.published'
              : 'social.savedToAlbum',
        ),
      );
      router.back();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setPublishing(false);
    }
  }

  const s = useStyles((th) => ({
    preview: { width: '100%', aspectRatio: 1, borderRadius: th.radius.lg },
    change: {
      position: 'absolute',
      right: th.spacing.sm,
      bottom: th.spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: th.radius.pill,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    changeText: { color: '#FFFFFF', fontWeight: '700' },
    pick: {
      aspectRatio: 1.4,
      borderRadius: th.radius.lg,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: th.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: th.spacing.md,
      padding: th.spacing.lg,
    },
    pickRow: { flexDirection: 'row', gap: th.spacing.sm, alignSelf: 'stretch' },
    label: { ...th.font.heading },
    input: {
      minHeight: 96,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      padding: th.spacing.md - 4,
      color: th.colors.text,
      fontSize: 16,
      textAlignVertical: 'top',
    },
    counter: { ...th.font.caption, textAlign: 'right' },
    meal: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.sm,
      padding: th.spacing.md - 4,
      borderRadius: th.radius.md,
      backgroundColor: th.colors.primarySoft,
    },
  }));

  return (
    <Screen
      footer={
        <Button
          title={publishing ? t('social.checking') : t('social.publish')}
          icon={visibility === 'public' ? 'globe-outline' : 'lock-closed-outline'}
          disabled={!image || publishing}
          onPress={publish}
        />
      }
    >
      <ScreenHeader title={t('social.newPost')} back />

      {image ? (
        <View>
          <Image source={{ uri: image.uri }} style={s.preview} resizeMode="cover" />
          {publishing ? (
            <View
              style={[
                s.preview,
                {
                  position: 'absolute',
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                },
              ]}
            >
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{t('social.checking')}</Text>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              style={s.change}
              onPress={() => choose('gallery')}
            >
              <Ionicons name="images-outline" size={16} color="#FFFFFF" />
              <Text style={s.changeText}>{t('social.changePhoto')}</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={s.pick}>
          <Ionicons name="image-outline" size={48} color={theme.colors.primary} />
          <Text style={[theme.font.body, { textAlign: 'center' }]}>{t('social.pickHint')}</Text>
          <View style={s.pickRow}>
            <View style={{ flex: 1 }}>
              <Button title={t('photo.camera')} icon="camera" onPress={() => choose('camera')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title={t('photo.gallery')}
                icon="images-outline"
                variant="secondary"
                onPress={() => choose('gallery')}
              />
            </View>
          </View>
        </View>
      )}

      {params.foodPhotoId && params.kcal ? (
        <View style={s.meal}>
          <Ionicons name="nutrition-outline" size={20} color={theme.colors.primaryStrong} />
          <Text style={[theme.font.caption, { flex: 1, color: theme.colors.primaryStrong }]}>
            {t('social.mealAttached', { dish: params.dish ?? '', kcal: params.kcal })}
          </Text>
        </View>
      ) : null}

      <Text style={s.label}>{t('social.kindLabel')}</Text>
      <FilterRow
        options={POST_KINDS.map((k) => ({
          value: k,
          label: t(`social.kinds.${k}`),
          icon: KIND_ICONS[k],
        }))}
        value={kind}
        onChange={setKind}
      />

      <Text style={s.label}>{t('social.captionLabel')}</Text>
      <TextInput
        style={s.input}
        value={caption}
        onChangeText={setCaption}
        placeholder={t('social.captionHint')}
        placeholderTextColor={theme.colors.textMuted}
        maxLength={MAX_CAPTION}
        multiline
      />
      <Text style={s.counter}>
        {caption.length}/{MAX_CAPTION}
      </Text>

      <Text style={s.label}>{t('social.visibilityLabel')}</Text>
      <OptionCard
        title={t('social.public')}
        hint={t('social.publicHint')}
        icon="globe-outline"
        selected={visibility === 'public'}
        onPress={() => setVisibility('public')}
      />
      <OptionCard
        title={t('social.privateOnly')}
        hint={t('social.privateHint')}
        icon="lock-closed-outline"
        selected={visibility === 'private'}
        onPress={() => setVisibility('private')}
      />
      <Notice tone="info">{t('social.rules')}</Notice>
    </Screen>
  );
}
