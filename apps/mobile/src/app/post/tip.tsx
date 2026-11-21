import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Field, Notice, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** Sfat text al echipei (nutritionist sau administrator), publicat direct in comunitate. */
export default function NewTip() {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = useStyles((th) => ({
    preview: { borderRadius: th.radius.xl, padding: th.spacing.lg, gap: th.spacing.sm },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    badgeText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12 },
    title: { color: '#FFFFFF', fontWeight: '900', fontSize: 22, lineHeight: 28 },
    text: { color: 'rgba(255,255,255,0.94)', fontSize: 15, lineHeight: 22 },
  }));

  const valid = title.trim().length >= 3 && caption.trim().length >= 10;

  async function publish() {
    if (!session || !valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.social.createTip(session.token, { title: title.trim(), caption: caption.trim() });
      toast(t('social.tipPublished'));
      router.back();
    } catch (e) {
      setError(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title={t('social.publishTip')}
          icon="bulb"
          disabled={!valid || busy}
          onPress={publish}
        />
      }
    >
      <ScreenHeader title={t('social.composeTip')} subtitle={t('social.tipSubtitle')} back />
      <LinearGradient
        colors={theme.gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.preview}
      >
        <View style={s.badge}>
          <Ionicons name="bulb" size={14} color="#FFFFFF" />
          <Text style={s.badgeText}>{t('social.tipBadge')}</Text>
        </View>
        <Text style={s.title}>{title.trim() || t('social.tipTitlePlaceholder')}</Text>
        <Text style={s.text}>{caption.trim() || t('social.tipTextPlaceholder')}</Text>
      </LinearGradient>
      <Field
        label={t('social.tipTitle')}
        value={title}
        onChangeText={setTitle}
        placeholder={t('social.tipTitlePlaceholder')}
        maxLength={80}
      />
      <Field
        label={t('social.tipText')}
        value={caption}
        onChangeText={setCaption}
        placeholder={t('social.tipTextPlaceholder')}
        multiline
        maxLength={500}
        style={{ minHeight: 120, textAlignVertical: 'top', paddingTop: 14, fontSize: 16 }}
      />
      <Text style={theme.font.caption}>{t('social.tipHint')}</Text>
      {error ? <Notice>{error}</Notice> : null}
    </Screen>
  );
}
