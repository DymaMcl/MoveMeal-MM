import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { api, type NutritionistCard } from '@/api/client';
import { errorKey } from '@/api/errors';
import { useToast } from '@/components/toast';
import { Button, Card, Field, parseNumber, Segmented } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';

const SLOTS = ['30', '45', '60', '90'] as const;

/** Profilul public al nutritionistului (afisat utilizatorilor pe pagina „Nutritionist”). */
export function ProfileSection({
  token,
  profile,
  onSaved,
}: {
  token: string;
  profile: NutritionistCard;
  onSaved: (profile: NutritionistCard) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [form, setForm] = useState({
    displayName: profile.displayName,
    title: profile.title,
    bio: profile.bio,
    qualifications: profile.qualifications,
    experienceYears: String(profile.experienceYears),
    services: profile.services,
    priceMdl: String(profile.priceMdl),
    slotMinutes: String(profile.slotMinutes) as (typeof SLOTS)[number],
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      displayName: profile.displayName,
      title: profile.title,
      bio: profile.bio,
      qualifications: profile.qualifications,
      experienceYears: String(profile.experienceYears),
      services: profile.services,
      priceMdl: String(profile.priceMdl),
      slotMinutes: String(profile.slotMinutes) as (typeof SLOTS)[number],
    });
  }, [profile]);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const years = parseNumber(form.experienceYears);
  const price = parseNumber(form.priceMdl);
  const valid =
    form.displayName.trim().length >= 2 &&
    years !== undefined &&
    Number.isInteger(years) &&
    years >= 0 &&
    years <= 60 &&
    price !== undefined &&
    Number.isInteger(price) &&
    price >= 0;

  async function save() {
    if (!valid) return;
    setBusy(true);
    try {
      const saved = await api.panel.saveProfile(token, {
        displayName: form.displayName.trim(),
        title: form.title.trim(),
        bio: form.bio.trim(),
        qualifications: form.qualifications.trim(),
        experienceYears: years!,
        services: form.services.trim(),
        priceMdl: price!,
        slotMinutes: Number(form.slotMinutes),
      });
      onSaved(saved);
      toast(t('panel.profileSaved'));
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(false);
    }
  }

  const multiline = {
    multiline: true,
    style: {
      minHeight: 90,
      textAlignVertical: 'top' as const,
      paddingTop: 12,
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
    },
  };

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Card>
        <Field
          label={t('panel.displayName')}
          value={form.displayName}
          onChangeText={set('displayName')}
          maxLength={80}
        />
        <Field
          label={t('panel.profileTitle')}
          value={form.title}
          onChangeText={set('title')}
          maxLength={120}
        />
        <Field
          label={t('panel.bio')}
          value={form.bio}
          onChangeText={set('bio')}
          maxLength={2000}
          {...multiline}
        />
        <Field
          label={t('panel.qualifications')}
          value={form.qualifications}
          onChangeText={set('qualifications')}
          maxLength={1000}
          {...multiline}
        />
        <Field
          label={t('panel.services')}
          value={form.services}
          onChangeText={set('services')}
          maxLength={1000}
          {...multiline}
        />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('panel.experience')}
              value={form.experienceYears}
              onChangeText={set('experienceYears')}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label={t('panel.price')}
              value={form.priceMdl}
              onChangeText={set('priceMdl')}
              keyboardType="number-pad"
              suffix="MDL"
            />
          </View>
        </View>
        <Text style={theme.font.caption}>{t('panel.slot')}</Text>
        <Segmented
          options={SLOTS.map((v) => ({ value: v, label: t('consult.duration', { min: v }) }))}
          value={form.slotMinutes}
          onChange={(v) => setForm((prev) => ({ ...prev, slotMinutes: v }))}
        />
      </Card>
      <Button
        title={t('panel.saveProfile')}
        icon="save-outline"
        disabled={!valid || busy}
        onPress={save}
      />
    </View>
  );
}
