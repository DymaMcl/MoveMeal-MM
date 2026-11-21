import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, View } from 'react-native';
import { api, type ModerationFilter, type ModerationItem } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ActionSheet, FilterRow, RemoteImage, timeAgo } from '@/components/social';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { Chips } from '@/components/chips';
import { useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

const FILTERS: ModerationFilter[] = ['pending', 'reported', 'removed', 'all'];
const PRESET_REASONS = ['adult', 'violence', 'spam', 'harassment', 'not_relevant'] as const;

/** Postarile care asteapta verificarea, cele raportate si cele ascunse. */
export function ModerationSection({
  token,
  initialFilter,
}: {
  token: string;
  initialFilter?: string;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [filter, setFilter] = useState<ModerationFilter>(
    FILTERS.includes(initialFilter as ModerationFilter)
      ? (initialFilter as ModerationFilter)
      : 'pending',
  );
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ModerationItem | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setItems(null);
    try {
      const page = await api.admin.moderation(token, filter);
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch (e) {
      toast(t(errorKey(e)));
      setItems([]);
    }
  }, [token, filter, toast, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(item: ModerationItem, action: () => Promise<void>, message: string) {
    try {
      await action();
      toast(message);
      setItems((prev) => prev?.filter((p) => p.id !== item.id) ?? prev);
    } catch (e) {
      toast(t(errorKey(e)));
    }
  }

  const s = useStyles((th) => ({
    card: {
      borderRadius: th.radius.lg,
      borderWidth: 1,
      borderColor: th.colors.border,
      backgroundColor: th.colors.surface,
      overflow: 'hidden',
    },
    image: { width: '100%', aspectRatio: 4 / 3 },
    body: { padding: th.spacing.md - 2, gap: th.spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.sm },
    pill: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: th.radius.pill,
      backgroundColor: th.colors.surfaceAlt,
    },
    pillText: { fontSize: 11, fontWeight: '800', color: th.colors.text },
    report: {
      flexDirection: 'row',
      gap: 6,
      padding: th.spacing.sm,
      borderRadius: th.radius.sm,
      backgroundColor: th.colors.warningSoft,
    },
    actions: { flexDirection: 'row', gap: th.spacing.sm, flexWrap: 'wrap' },
    input: {
      minHeight: 70,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      padding: th.spacing.sm + 2,
      color: th.colors.text,
      fontSize: 15,
      textAlignVertical: 'top',
    },
  }));

  const removeReason = preset ? t(`admin.rejectReasons.${preset}`) : reason.trim();

  return (
    <View style={{ gap: theme.spacing.md }}>
      <FilterRow
        options={FILTERS.map((f) => ({ value: f, label: t(`admin.filters.${f}`) }))}
        value={filter}
        onChange={setFilter}
      />
      {items === null ? <ActivityIndicator color={theme.colors.primary} /> : null}
      {items && items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
          <Ionicons name="checkmark-done-circle-outline" size={44} color={theme.colors.primary} />
          <Text style={theme.font.caption}>{t('admin.queueEmpty')}</Text>
        </View>
      ) : null}
      {items?.map((item) => (
        <View key={item.id} style={s.card}>
          {item.mediaId ? <RemoteImage mediaId={item.mediaId} style={s.image} /> : null}
          <View style={s.body}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.font.body, { fontWeight: '800' }]}>{item.author.name}</Text>
                <Text style={[theme.font.caption, { fontSize: 12 }]}>
                  {item.author.email} · {timeAgo(item.createdAt, t, language)}
                </Text>
              </View>
              <View style={s.pill}>
                <Text style={s.pillText}>{t(`admin.postStatus.${item.status}`)}</Text>
              </View>
            </View>
            <Text style={theme.font.caption}>
              {t(`social.kinds.${item.kind}`)} ·{' '}
              {item.visibility === 'public' ? t('social.public') : t('social.private')} ·{' '}
              {item.moderation.verdict === 'approved'
                ? t('admin.aiApproved')
                : t('admin.aiUnchecked')}
            </Text>
            {item.caption ? <Text style={theme.font.body}>„{item.caption}”</Text> : null}
            {item.removedReason ? (
              <Text style={[theme.font.caption, { color: theme.colors.danger }]}>
                {t('admin.removedFor', { reason: item.removedReason })}
              </Text>
            ) : null}
            {item.reports.map((r, i) => (
              <View key={i} style={s.report}>
                <Ionicons name="flag" size={14} color={theme.colors.warning} />
                <Text style={[theme.font.caption, { color: theme.colors.warning, flex: 1 }]}>
                  {t(`social.reasons.${r.reason}`)}
                  {r.note ? `: ${r.note}` : ''}
                </Text>
              </View>
            ))}
            <View style={s.actions}>
              {item.status !== 'published' || item.reports.length ? (
                <View style={{ flexGrow: 1 }}>
                  <Button
                    title={item.status === 'removed' ? t('admin.restore') : t('admin.approve')}
                    icon="checkmark"
                    onPress={() =>
                      act(
                        item,
                        () => api.admin.approvePost(token, item.id),
                        t('admin.approvedDone'),
                      )
                    }
                  />
                </View>
              ) : null}
              {item.status !== 'removed' ? (
                <View style={{ flexGrow: 1 }}>
                  <Button
                    title={t('admin.remove')}
                    icon="eye-off-outline"
                    variant="secondary"
                    onPress={() => {
                      setPreset(null);
                      setReason('');
                      setRemoving(item);
                    }}
                  />
                </View>
              ) : null}
            </View>
            <View style={s.actions}>
              {item.reports.length && item.status !== 'removed' ? (
                <View style={{ flexGrow: 1 }}>
                  <Button
                    title={t('admin.dismiss')}
                    icon="close-circle-outline"
                    variant="ghost"
                    onPress={() =>
                      act(
                        item,
                        () => api.admin.dismissReports(token, item.id),
                        t('admin.dismissedDone'),
                      )
                    }
                  />
                </View>
              ) : null}
              <View style={{ flexGrow: 1 }}>
                <Button
                  title={t('admin.deleteForever')}
                  icon="trash-outline"
                  variant="ghost"
                  onPress={() =>
                    Alert.alert(t('admin.deleteForever'), t('admin.deleteForeverText'), [
                      { text: t('common.cancel'), style: 'cancel' },
                      {
                        text: t('social.delete'),
                        style: 'destructive',
                        onPress: () =>
                          act(
                            item,
                            () => api.admin.deletePost(token, item.id),
                            t('social.deleted'),
                          ),
                      },
                    ])
                  }
                />
              </View>
            </View>
          </View>
        </View>
      ))}
      {cursor ? (
        <Button
          title={t('admin.loadMore')}
          variant="ghost"
          onPress={async () => {
            const page = await api.admin.moderation(token, filter, cursor).catch(() => null);
            if (page) {
              setItems((prev) => [...(prev ?? []), ...page.items]);
              setCursor(page.nextCursor);
            }
          }}
        />
      ) : null}

      <ActionSheet
        visible={removing !== null}
        title={t('admin.removeTitle')}
        onClose={() => setRemoving(null)}
      >
        <Text style={theme.font.caption}>{t('admin.removeHint')}</Text>
        <Chips
          options={PRESET_REASONS.map((r) => ({ value: r, label: t(`admin.rejectReasons.${r}`) }))}
          selected={preset ? [preset as (typeof PRESET_REASONS)[number]] : []}
          onToggle={(v) => setPreset(preset === v ? null : v)}
        />
        {!preset ? (
          <TextInput
            style={s.input}
            value={reason}
            onChangeText={setReason}
            placeholder={t('admin.customReason')}
            placeholderTextColor={theme.colors.textMuted}
            maxLength={300}
            multiline
          />
        ) : null}
        <Button
          title={t('admin.remove')}
          icon="eye-off-outline"
          disabled={removeReason.length < 3}
          onPress={() => {
            const item = removing;
            setRemoving(null);
            if (item) {
              act(
                item,
                () => api.admin.removePost(token, item.id, removeReason),
                t('admin.removedDone'),
              );
            }
          }}
        />
      </ActionSheet>
    </View>
  );
}
