import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type Post } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { PostCard } from '@/components/social';
import { Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** O singura postare (din album, salvate sau notificari). */
export default function PostDetail() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    content: { padding: th.spacing.lg, gap: th.spacing.md, paddingBottom: th.spacing.xl },
  }));

  useEffect(() => {
    if (!session || !id) return;
    api.social
      .post(session.token, id)
      .then(setPost)
      .catch((e) => setError(t(errorKey(e))));
  }, [session, id, t]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={s.content}>
        <ScreenHeader title={t('social.post')} back />
        {error ? <Notice>{error}</Notice> : null}
        {!post && !error ? <ActivityIndicator color={theme.colors.primary} /> : null}
        {post ? <PostCard post={post} onChange={setPost} onDeleted={() => router.back()} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
