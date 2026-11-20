import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { api } from '@/api/client';
import { errorKey } from '@/api/errors';
import { ScreenHeader } from '@/components/app-menu';
import { useToast } from '@/components/toast';
import { Button, Card, Field, Screen } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { useStyles, useTheme } from '@/theme';

/** Numele afisat, descrierea scurta si vizibilitatea progresului in profilul public. */
export default function ProfileEdit() {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [showProgress, setShowProgress] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    api.social
      .me(session.token)
      .then((me) => {
        setName(me.profile.displayName);
        setBio(me.profile.bio);
        setShowProgress(me.profile.showProgress);
        setLoaded(true);
      })
      .catch((e) => toast(t(errorKey(e))));
  }, [session, toast, t]);

  const s = useStyles((th) => ({
    row: { flexDirection: 'row', alignItems: 'center', gap: th.spacing.md },
  }));

  const nameError = name.trim().length < 2 ? t('profile.nameError') : null;

  async function save() {
    if (!session || nameError) return;
    setSaving(true);
    try {
      await api.social.updateMe(session.token, {
        displayName: name.trim(),
        bio: bio.trim(),
        showProgress,
      });
      toast(t('profile.savedDone'));
      router.back();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title={t('common.save')}
          icon="checkmark"
          disabled={!loaded || saving || !!nameError}
          onPress={save}
        />
      }
    >
      <ScreenHeader title={t('profile.edit')} back />
      {!loaded ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <>
          <Field
            label={t('profile.displayName')}
            value={name}
            onChangeText={setName}
            maxLength={40}
            error={name ? nameError : null}
            icon="person-outline"
          />
          <Field
            label={t('profile.bio')}
            value={bio}
            onChangeText={setBio}
            maxLength={160}
            placeholder={t('profile.bioHint')}
            icon="chatbox-ellipses-outline"
            hint={<Text style={theme.font.caption}>{bio.length}/160</Text>}
          />
          <Card>
            <View style={s.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={theme.font.heading}>{t('profile.showProgress')}</Text>
                <Text style={theme.font.caption}>{t('profile.showProgressHint')}</Text>
              </View>
              <Switch
                value={showProgress}
                onValueChange={setShowProgress}
                trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
                thumbColor="#FFFFFF"
                accessibilityLabel={t('profile.showProgress')}
              />
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}
