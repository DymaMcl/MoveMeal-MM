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

/**
 * Stilul aplicatiei: fundal alb (zi) sau negru (noapte), iar liniile, contururile si accentele
 * in albastru inchis. Macronutrientii folosesc trei nuante echilibrate de albastru.
 * Rosul ramane doar pentru erori.
 */
const light = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F4FA',
  text: '#0B1220',
  textMuted: '#5B6478',
  border: 'rgba(30, 58, 138, 0.28)',
  primary: '#1E3A8A',
  primaryStrong: '#172E6E',
  primarySoft: '#E6ECF8',
  onPrimary: '#FFFFFF',
  accent: '#2F5BC4',
  accentSoft: '#E3EAFA',
  info: '#3B6FD8',
  infoSoft: '#E6EEFC',
  danger: '#D92D20',
  warning: '#8A5300',
  warningSoft: '#FFF6E5',
  protein: '#1E3A8A',
  carbs: '#3B6FD8',
  fat: '#8FB3EE',
  tabBar: '#FFFFFF',
  shadow: '#000000',
};

export type Palette = typeof light;

const dark: Palette = {
  background: '#000000',
  surface: '#0B0F17',
  surfaceAlt: '#141B28',
  text: '#F5F7FB',
  textMuted: '#9AA4B8',
  border: 'rgba(96, 140, 230, 0.35)',
  // Pe negru, albastrul foarte inchis nu s-ar vedea; se foloseste o nuanta putin mai deschisa.
  primary: '#4A78E0',
  primaryStrong: '#8AACF2',
  primarySoft: '#0F1B36',
  onPrimary: '#FFFFFF',
  accent: '#6E93E8',
  accentSoft: '#111D38',
  info: '#7FA3F0',
  infoSoft: '#111D38',
  danger: '#FF6369',
  warning: '#F2B95A',
  warningSoft: '#2E2410',
  protein: '#BBD0FA',
  carbs: '#6E93E8',
  fat: '#2F5BC4',
  tabBar: '#000000',
  shadow: '#000000',
};

const gradients = {
  light: {
    hero: ['#0F2557', '#1E3A8A'] as const,
    warm: ['#1E3A8A', '#2F5BC4'] as const,
    primary: ['#1E3A8A', '#172E6E'] as const,
  },
  dark: {
    hero: ['#0E1E47', '#1C3474'] as const,
    warm: ['#173068', '#2A4F9E'] as const,
    primary: ['#3A66CF', '#1E3A8A'] as const,
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
    /** Cardurile au un contur subtire albastru in loc de umbra (stil plat, alb/negru). */
    elevation: { borderWidth: 1, borderColor: colors.border } as ViewStyle,
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
