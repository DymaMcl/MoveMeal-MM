import { router } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { api, type Appointment } from '@/api/client';
import { errorKey } from '@/api/errors';
import { AppointmentCard } from '@/components/appointment-card';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useStyles, useTheme } from '@/theme';

/** Solicitarile noi, programarile confirmate si istoricul nutritionistului. */
export function AppointmentsSection({
  token,
  appointments,
  onChanged,
}: {
  token: string;
  appointments: Appointment[];
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const pending = appointments.filter((a) => a.status === 'requested' && !a.past);
  const upcoming = appointments.filter((a) => a.status === 'confirmed' && !a.past);
  const past = appointments
    .filter((a) => !pending.includes(a) && !upcoming.includes(a))
    .reverse()
    .slice(0, 20);

  async function act(a: Appointment, action: 'confirm' | 'reject') {
    setBusy(a.id);
    try {
      const note = notes[a.id]?.trim() || undefined;
      if (action === 'confirm') await api.panel.confirm(token, a.id, note);
      else await api.panel.reject(token, a.id, note);
      toast(t(action === 'confirm' ? 'panel.confirmed' : 'panel.rejected'));
      onChanged();
    } catch (e) {
      toast(t(errorKey(e)));
    } finally {
      setBusy(null);
    }
  }

  const s = useStyles((th) => ({
    section: { ...th.font.heading, marginTop: th.spacing.sm },
    empty: { ...th.font.caption },
    label: { ...th.font.caption, fontWeight: '800' },
    note: { ...th.font.body, fontSize: 14 },
    input: {
      minHeight: 44,
      borderWidth: 1,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
      paddingVertical: 8,
      color: th.colors.text,
      fontSize: 14,
    },
    actions: { gap: th.spacing.sm },
    row: { flexDirection: 'row', gap: th.spacing.sm },
    half: { flex: 1 },
    free: { color: th.colors.primary, fontWeight: '800', fontSize: 13 },
  }));

  const replyInput = (a: Appointment) => (
    <TextInput
      style={s.input}
      value={notes[a.id] ?? ''}
      onChangeText={(text) => setNotes((prev) => ({ ...prev, [a.id]: text }))}
      placeholder={t('panel.replyPlaceholder')}
      placeholderTextColor={theme.colors.textMuted}
      maxLength={500}
    />
  );

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text style={s.section}>
        {t('panel.pending')} {pending.length ? `(${pending.length})` : ''}
      </Text>
      {pending.length === 0 ? <Text style={s.empty}>{t('panel.noPending')}</Text> : null}
      {pending.map((a) => (
        <AppointmentCard key={a.id} appointment={a} title={a.clientName}>
          {a.userNote ? (
            <>
              <Text style={s.label}>{t('panel.clientNote')}</Text>
              <Text style={s.note}>{a.userNote}</Text>
            </>
          ) : null}
          {replyInput(a)}
          <View style={s.actions}>
            <Button
              title={t('panel.confirm')}
              icon="checkmark"
              disabled={busy === a.id}
              onPress={() => act(a, 'confirm')}
            />
            <View style={s.row}>
              <View style={s.half}>
                <Button
                  title={t('panel.reschedule')}
                  variant="secondary"
                  disabled={busy === a.id}
                  onPress={() =>
                    router.push({ pathname: '/panel/reschedule/[id]', params: { id: a.id } })
                  }
                />
              </View>
              <View style={s.half}>
                <Button
                  title={t('panel.reject')}
                  variant="ghost"
                  disabled={busy === a.id}
                  onPress={() => act(a, 'reject')}
                />
              </View>
            </View>
          </View>
        </AppointmentCard>
      ))}

      <Text style={s.section}>{t('panel.upcoming')}</Text>
      {upcoming.length === 0 ? <Text style={s.empty}>{t('panel.noUpcoming')}</Text> : null}
      {upcoming.map((a) => (
        <AppointmentCard key={a.id} appointment={a} title={a.clientName}>
          {a.userNote ? <Text style={s.note}>{a.userNote}</Text> : null}
          <View style={s.row}>
            <View style={s.half}>
              <Button
                title={t('panel.reschedule')}
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/panel/reschedule/[id]', params: { id: a.id } })
                }
              />
            </View>
            <View style={s.half}>
              <Button
                title={t('consult.cancel')}
                variant="ghost"
                disabled={busy === a.id}
                onPress={() => act(a, 'reject')}
              />
            </View>
          </View>
        </AppointmentCard>
      ))}

      {past.length > 0 ? (
        <>
          <Text style={s.section}>{t('panel.past')}</Text>
          {past.map((a) => (
            <AppointmentCard key={a.id} appointment={a} title={a.clientName} />
          ))}
        </>
      ) : null}
    </View>
  );
}
