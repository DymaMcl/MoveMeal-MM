import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, type FollowUser } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { Avatar, FilterRow } from '@/components/social';
import { Notice } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

type Direction = 'followers' | 'following';

/** Urmaritorii unui utilizator si persoanele pe care le urmareste. */
export default function Follows() {
  const { t } = useI18n();
  const theme = useTheme();
  const { session } = useAppState();
  const params = useLocalSearchParams<{ id: string; type?: Direction; name?: string }>();
  const [direction, setDirection] = useState<Direction>(
    params.type === 'following' ? 'following' : 'followers',
  );
  const [users, setUsers] = useState<FollowUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = session?.token;

  useEffect(() => {
    if (!token || !params.id) return;
    setUsers(null);
    setError(null);
    (direction === 'followers'
      ? api.social.followers(token, params.id)
      : api.social.following(token, params.id)
    )
      .then(setUsers)
      .catch((e) => setError(t(errorKey(e))));
  }, [token, params.id, direction, t]);

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: th.colors.background },
    top: { paddingHorizontal: th.spacing.lg, paddingTop: th.spacing.lg, gap: th.spacing.md },
    list: { padding: th.spacing.lg, gap: th.spacing.sm, paddingBottom: th.spacing.xl },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      padding: th.spacing.md,
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
    },
    name: { ...th.font.body, fontWeight: '700', flex: 1 },
    empty: { alignItems: 'center', gap: th.spacing.sm, paddingVertical: th.spacing.xl },
  }));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.top}>
        <ScreenHeader title={params.name ?? t('profile.title')} back />
        <FilterRow
          options={[
            { value: 'followers' as Direction, label: t('profile.followers'), icon: 'people' },
            { value: 'following' as Direction, label: t('profile.following'), icon: 'person-add' },
          ]}
          value={direction}
          onChange={setDirection}
        />
        {error ? <Notice>{error}</Notice> : null}
      </View>
      {!users && !error ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
      ) : null}
      {users ? (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="people-outline" size={40} color={theme.colors.textMuted} />
              <Text style={[theme.font.caption, { textAlign: 'center' }]}>
                {t(direction === 'followers' ? 'profile.noFollowers' : 'profile.noFollowing')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
            >
              <Avatar name={item.name} avatarId={item.avatarId} />
              <Text style={s.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}
