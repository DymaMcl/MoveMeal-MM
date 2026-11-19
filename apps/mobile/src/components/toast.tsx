import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Animated, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

/** Mesajele de confirmare sunt afisate 3 secunde (Laboratorul 2). */
const DURATION_MS = 3000;

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(text);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setMessage(null),
        );
      }, DURATION_MS);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + 8,
            opacity,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: theme.radius.md,
            backgroundColor: theme.scheme === 'dark' ? '#1E2A3B' : '#0E1525',
            ...theme.elevation,
          }}
        >
          <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
          <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 15, flex: 1 }}>
            {message}
          </Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}
