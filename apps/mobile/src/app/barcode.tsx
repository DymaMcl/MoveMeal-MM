import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ApiError, type LogMeal } from '@/api/client';
import { errorKey } from '@/api/errors';
import { useToast } from '@/components/toast';
import { Button } from '@/components/ui';
import { useI18n } from '@/i18n';
import { useAppState } from '@/state/app-state';
import { setPendingProduct } from '@/state/pending';
import { useStyles, useTheme } from '@/theme';

const BARCODE = /^[0-9]{8,14}$/;

/** Ce s-a intamplat dupa citirea codului. */
type Status =
  | { kind: 'scanning' }
  | { kind: 'searching'; code: string }
  | { kind: 'missing'; code: string; name: string | null; brand: string | null };

/** Scanarea codului de bare (Open Food Facts) pentru produsele ambalate. */
export default function Barcode() {
  const { t } = useI18n();
  const theme = useTheme();
  const toast = useToast();
  const { session } = useAppState();
  const params = useLocalSearchParams<{ day: string; meal: LogMeal }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState<Status>({ kind: 'scanning' });
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState('');
  /** Camera trimite acelasi cod de mai multe ori pe secunda; se proceseaza doar primul. */
  const locked = useRef(false);
  const insets = useSafeAreaInsets();

  const s = useStyles((th) => ({
    safe: { flex: 1, backgroundColor: '#000000' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: th.spacing.md,
      paddingHorizontal: th.spacing.lg,
      paddingBottom: th.spacing.md,
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    round: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    title: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
    frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    frame: {
      width: '78%',
      aspectRatio: 1.6,
      borderRadius: th.radius.lg,
      borderWidth: 3,
      borderColor: '#FFFFFF',
      backgroundColor: 'transparent',
    },
    frameText: {
      color: '#FFFFFF',
      marginTop: th.spacing.md,
      fontWeight: '700',
      textAlign: 'center',
      paddingHorizontal: 32,
      textShadowColor: 'rgba(0,0,0,0.8)',
      textShadowRadius: 6,
    },
    sheet: {
      backgroundColor: th.colors.surface,
      borderTopLeftRadius: th.radius.xl,
      borderTopRightRadius: th.radius.xl,
      padding: th.spacing.lg,
      gap: th.spacing.md,
    },
    manualRow: { flexDirection: 'row', gap: th.spacing.sm, alignItems: 'center' },
    input: {
      flex: 1,
      minHeight: 50,
      borderWidth: 1.5,
      borderColor: th.colors.border,
      borderRadius: th.radius.md,
      paddingHorizontal: th.spacing.md,
      fontSize: 17,
      letterSpacing: 1,
      color: th.colors.text,
    },
    go: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: th.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: th.spacing.xl,
      gap: th.spacing.md,
      backgroundColor: th.colors.background,
    },
    icon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: th.colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
  }));

  async function lookup(code: string) {
    if (!session || locked.current) return;
    locked.current = true;
    setStatus({ kind: 'searching', code });
    try {
      const product = await api.products.byBarcode(session.token, code);
      setPendingProduct(product);
      router.back();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404 && e.data.code) {
        setStatus({
          kind: 'missing',
          code,
          name: typeof e.data.name === 'string' ? e.data.name : null,
          brand: typeof e.data.brand === 'string' ? e.data.brand : null,
        });
      } else {
        toast(t(errorKey(e)));
        rescan();
      }
    }
  }

  function rescan() {
    setStatus({ kind: 'scanning' });
    // Scurta pauza, ca acelasi cod aflat inca in cadru sa nu fie citit imediat din nou.
    setTimeout(() => {
      locked.current = false;
    }, 800);
  }

  function onScanned(result: BarcodeScanningResult) {
    const code = result.data.trim();
    if (BARCODE.test(code)) void lookup(code);
  }

  const back = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      style={s.round}
      onPress={() => router.back()}
    >
      <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
    </Pressable>
  );

  if (!permission) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={s.center}>
          <View style={s.icon}>
            <Ionicons name="camera-outline" size={40} color={theme.colors.primary} />
          </View>
          <Text style={[theme.font.title, { textAlign: 'center', fontSize: 22 }]}>
            {t('quick.cameraTitle')}
          </Text>
          <Text style={[theme.font.body, { textAlign: 'center' }]}>{t('quick.cameraText')}</Text>
          {permission.canAskAgain ? (
            <Button
              title={t('quick.allowCamera')}
              icon="camera"
              onPress={() => {
                void requestPermission();
              }}
            />
          ) : (
            // Permisiunea a fost refuzata definitiv: se poate acorda doar din setarile telefonului.
            <Button
              title={t('quick.openSettings')}
              icon="settings-outline"
              onPress={() => {
                void Linking.openSettings();
              }}
            />
          )}
          <Button
            title={t('common.back')}
            variant="ghost"
            icon="chevron-back"
            onPress={() => router.back()}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={s.safe} behavior="padding">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={status.kind === 'scanning' ? onScanned : undefined}
      />

      <View style={[s.header, { paddingTop: insets.top + theme.spacing.sm }]}>
        {back}
        <Text style={s.title} numberOfLines={1}>
          {t('quick.scanTitle')}
        </Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel={t('quick.torch')}
          style={s.round}
          onPress={() => setTorch((v) => !v)}
        >
          <Ionicons name={torch ? 'flashlight' : 'flashlight-outline'} size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View style={s.frameWrap} pointerEvents="none">
        <View style={s.frame} />
        <Text style={s.frameText}>
          {status.kind === 'searching' ? t('quick.searching') : t('quick.aimHint')}
        </Text>
        {status.kind === 'searching' ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 12 }} />
        ) : null}
      </View>

      <View style={[s.sheet, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
        {status.kind === 'missing' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ionicons name="help-circle" size={28} color={theme.colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={theme.font.heading}>{status.name ?? t('quick.notFoundTitle')}</Text>
                <Text style={theme.font.caption}>
                  {status.name ? t('quick.incomplete') : t('quick.notFound')} · {status.code}
                </Text>
              </View>
            </View>
            <Button
              title={t('quick.addProduct')}
              icon="add-circle"
              onPress={() =>
                router.replace({
                  pathname: '/product-edit',
                  params: {
                    day: params.day,
                    meal: params.meal,
                    barcode: status.code,
                    ...(status.name ? { name: status.name } : {}),
                    ...(status.brand ? { brand: status.brand } : {}),
                  },
                })
              }
            />
            <Button
              title={t('quick.scanAgain')}
              icon="scan-outline"
              variant="secondary"
              onPress={rescan}
            />
          </>
        ) : (
          <>
            <Text style={theme.font.heading}>{t('quick.manualTitle')}</Text>
            <View style={s.manualRow}>
              <TextInput
                style={s.input}
                value={manual}
                onChangeText={(v) => setManual(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={14}
                placeholder="5941234567890"
                placeholderTextColor={theme.colors.textMuted}
                editable={status.kind === 'scanning'}
                returnKeyType="search"
                onSubmitEditing={() => {
                  if (BARCODE.test(manual)) void lookup(manual);
                }}
                accessibilityLabel={t('quick.manualTitle')}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('quick.search')}
                style={[s.go, !BARCODE.test(manual) && { opacity: 0.4 }]}
                disabled={!BARCODE.test(manual) || status.kind !== 'scanning'}
                onPress={() => lookup(manual)}
              >
                <Ionicons name="arrow-forward" size={22} color={theme.colors.onPrimary} />
              </Pressable>
            </View>
            <Text style={[theme.font.caption, { fontSize: 12 }]}>{t('quick.offCredit')}</Text>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
