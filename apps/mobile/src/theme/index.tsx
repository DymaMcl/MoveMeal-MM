import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  useColorScheme,
  type ImageStyle,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

/** Preferinta utilizatorului: tema sistemului sau una fixa. */
export type ThemeMode = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const light = {
  background: '#F3F5FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF0F6',
  text: '#0E1525',
  textMuted: '#667089',
  border: '#E3E7EF',
  primary: '#12B76A',
  primaryStrong: '#039855',
  primarySoft: '#DDF7EA',
  onPrimary: '#FFFFFF',
  accent: '#FF7A45',
  accentSoft: '#FFE9DF',
  info: '#3E7BFA',
  infoSoft: '#E3ECFF',
  danger: '#E5484D',
  warning: '#B54708',
  warningSoft: '#FFF4DE',
  protein: '#5B7CFF',
  carbs: '#F5B400',
  fat: '#FF5C7A',
  tabBar: '#FFFFFF',
  shadow: '#0E1525',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#0A0E16',
  surface: '#141A25',
  surfaceAlt: '#1C2432',
  text: '#F2F5FA',
  textMuted: '#93A0B8',
  border: '#252F40',
  primary: '#2BD48A',
  primaryStrong: '#1FB574',
  primarySoft: '#123526',
  onPrimary: '#05130C',
  accent: '#FF8A5C',
  accentSoft: '#3A2219',
  info: '#6E9BFF',
  infoSoft: '#18244A',
  danger: '#FF6369',
  warning: '#F7B955',
  warningSoft: '#3A2D14',
  protein: '#7D96FF',
  carbs: '#FFCB3D',
  fat: '#FF7A93',
  tabBar: '#10151F',
  shadow: '#000000',
};

const gradients = {
  light: {
    hero: ['#12B76A', '#0BA5EC'] as const,
    warm: ['#FF7A45', '#FF4D8D'] as const,
    primary: ['#16C47F', '#039855'] as const,
  },
  dark: {
    hero: ['#0F7A4C', '#0B5E8A'] as const,
    warm: ['#C2502A', '#B3265F'] as const,
    primary: ['#2BD48A', '#16A86A'] as const,
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

function buildTheme(scheme: Scheme) {
  const colors = scheme === 'dark' ? dark : light;
  return {
    scheme,
    colors,
    gradients: gradients[scheme],
    spacing,
    radius,
    font: {
      display: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
      title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
      heading: { fontSize: 17, fontWeight: '700', color: colors.text },
      body: { fontSize: 15, color: colors.text, lineHeight: 21 },
      caption: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
    } satisfies Record<string, TextStyle>,
    /** Umbra discreta pentru carduri (in tema intunecata se foloseste doar conturul). */
    elevation: (scheme === 'dark'
      ? {}
      : {
          shadowColor: colors.shadow,
          shadowOpacity: 0.06,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 2,
        }) as ViewStyle,
  };
}

export type Theme = ReturnType<typeof buildTheme>;

const THEME_KEY = 'movemeal.themeMode';

interface ThemeValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  }, []);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = useMemo(() => buildTheme(scheme), [scheme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme]);

  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeSettings(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeSettings trebuie folosit in interiorul ThemeProvider');
  return ctx;
}

export function useTheme(): Theme {
  return useThemeSettings().theme;
}

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

/** Creeaza stilurile unui ecran si le recalculeaza doar cand se schimba tema. */
export function useStyles<T extends NamedStyles>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => StyleSheet.create(factory(theme)), [theme]);
}
