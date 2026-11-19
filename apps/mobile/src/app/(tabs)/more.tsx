import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { colors, font, spacing } from '@/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={font.caption}>{label}</Text>
      <Text style={font.body}>{value}</Text>
    </View>
  );
}

export default function More() {
  const { t, language, setLanguage, formatWeeks } = useI18n();
  const { profile, session, signOut, resetProfile } = useAppState();
  if (!profile) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={font.title}>{t('tabs.more')}</Text>

        <Card title={t('more.profile')}>
          <Row label={t('onboarding.personal.name')} value={profile.name} />
          <Row label={t('auth.email')} value={session?.email ?? ''} />
          <Row label={t('onboarding.personal.age')} value={`${profile.age} ${t('common.years')}`} />
          <Row
            label={t('onboarding.body.height')}
            value={`${profile.heightCm} ${t('common.cm')}`}
          />
          <Row
            label={t('onboarding.body.weight')}
            value={`${profile.weightKg} ${t('common.kg')}`}
          />
          <Row label={t('onboarding.goal.title')} value={t(`onboarding.goal.${profile.goal}`)} />
          {profile.targetWeightKg !== undefined ? (
            <Row
              label={t('onboarding.target.title')}
              value={`${profile.targetWeightKg} ${t('common.kg')} · ${formatWeeks(profile.weeks ?? 0)}`}
            />
          ) : null}
          <Row
            label={t('onboarding.activity.title')}
            value={t(`onboarding.activity.${profile.activityLevel}`)}
          />
        </Card>

        <Card title={t('more.language')}>
          <View style={styles.langs}>
            <View style={styles.flex}>
              <Button
                title="Română"
                variant={language === 'ro' ? 'primary' : 'secondary'}
                onPress={() => setLanguage('ro')}
              />
            </View>
            <View style={styles.flex}>
              <Button
                title="English"
                variant={language === 'en' ? 'primary' : 'secondary'}
                onPress={() => setLanguage('en')}
              />
            </View>
          </View>
        </Card>

        <Button
          title={t('more.resetProfile')}
          variant="secondary"
          onPress={async () => {
            await resetProfile();
            router.replace('/onboarding/personal');
          }}
        />
        <Button
          title={t('more.logout')}
          variant="ghost"
          onPress={async () => {
            await signOut();
            router.replace('/welcome');
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  langs: { flexDirection: 'row', gap: spacing.sm },
});
