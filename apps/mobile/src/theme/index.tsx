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
/** Culoarea interfetei aleasa de utilizator. */
export type Accent = 'blue' | 'pink' | 'red' | 'green';
export const ACCENTS: Accent[] = ['blue', 'pink', 'red', 'green'];

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

type Gradients = {
  hero: readonly [string, string];
  warm: readonly [string, string];
  primary: readonly [string, string];
};

/** Fundalul ramane neutru; se schimba doar accentele (butoane, contururi, grafice). */
const DARK_NEUTRAL = { surface: '#0E0F12', surfaceAlt: '#1A1C21' };

const accents: Record<
  Exclude<Accent, 'blue'>,
  {
    swatch: string;
    light: Partial<Palette>;
    dark: Partial<Palette>;
    gradients: Record<Scheme, Gradients>;
  }
> = {
  pink: {
    swatch: '#DB2777',
    light: {
      surfaceAlt: '#FBF1F6',
      border: 'rgba(190, 24, 93, 0.26)',
      primary: '#BE185D',
      primaryStrong: '#9D174D',
      primarySoft: '#FCE7F3',
      accent: '#DB2777',
      accentSoft: '#FDF2F8',
      info: '#BE185D',
      infoSoft: '#FDF2F8',
      protein: '#9D174D',
      carbs: '#DB2777',
      fat: '#F9A8D4',
    },
    dark: {
      ...DARK_NEUTRAL,
      border: 'rgba(236, 72, 153, 0.35)',
      primary: '#DB2777',
      primaryStrong: '#F9A8D4',
      primarySoft: '#3A0F24',
      accent: '#F472B6',
      accentSoft: '#2E0C1D',
      info: '#F9A8D4',
      infoSoft: '#2E0C1D',
      protein: '#FBCFE8',
      carbs: '#F472B6',
      fat: '#BE185D',
    },
    gradients: {
      light: {
        hero: ['#831843', '#BE185D'],
        warm: ['#BE185D', '#DB2777'],
        primary: ['#BE185D', '#9D174D'],
      },
      dark: {
        hero: ['#4A0F2A', '#831843'],
        warm: ['#831843', '#BE185D'],
        primary: ['#DB2777', '#9D174D'],
      },
    },
  },
  red: {
    swatch: '#DC2626',
    light: {
      surfaceAlt: '#FAF2F2',
      border: 'rgba(185, 28, 28, 0.26)',
      primary: '#B91C1C',
      primaryStrong: '#991B1B',
      primarySoft: '#FDE8E8',
      accent: '#DC2626',
      accentSoft: '#FEF2F2',
      info: '#B91C1C',
      infoSoft: '#FEF2F2',
      protein: '#991B1B',
      carbs: '#DC2626',
      fat: '#FCA5A5',
    },
    dark: {
      ...DARK_NEUTRAL,
      border: 'rgba(239, 68, 68, 0.35)',
      primary: '#DC2626',
      primaryStrong: '#FCA5A5',
      primarySoft: '#3B0D0D',
      accent: '#F87171',
      accentSoft: '#2B0B0B',
      info: '#FCA5A5',
      infoSoft: '#2B0B0B',
      protein: '#FECACA',
      carbs: '#F87171',
      fat: '#B91C1C',
    },
    gradients: {
      light: {
        hero: ['#7F1D1D', '#B91C1C'],
        warm: ['#B91C1C', '#DC2626'],
        primary: ['#B91C1C', '#991B1B'],
      },
      dark: {
        hero: ['#450A0A', '#7F1D1D'],
        warm: ['#7F1D1D', '#B91C1C'],
        primary: ['#DC2626', '#991B1B'],
      },
    },
  },
  green: {
    swatch: '#16A34A',
    light: {
      surfaceAlt: '#F0F7F2',
      border: 'rgba(21, 128, 61, 0.26)',
      primary: '#15803D',
      primaryStrong: '#166534',
      primarySoft: '#E3F4E8',
      accent: '#16A34A',
      accentSoft: '#F0FAF3',
      info: '#15803D',
      infoSoft: '#ECF7EF',
      protein: '#166534',
      carbs: '#16A34A',
      fat: '#86EFAC',
    },
    dark: {
      ...DARK_NEUTRAL,
      border: 'rgba(34, 197, 94, 0.35)',
      primary: '#16A34A',
      primaryStrong: '#86EFAC',
      primarySoft: '#0D2A18',
      accent: '#4ADE80',
      accentSoft: '#0B2214',
      info: '#86EFAC',
      infoSoft: '#0B2214',
      protein: '#BBF7D0',
      carbs: '#4ADE80',
      fat: '#15803D',
    },
    gradients: {
      light: {
        hero: ['#14532D', '#15803D'],
        warm: ['#15803D', '#16A34A'],
        primary: ['#15803D', '#166534'],
      },
      dark: {
        hero: ['#0A2E18', '#14532D'],
        warm: ['#14532D', '#15803D'],
        primary: ['#16A34A', '#166534'],
      },
    },
  },
};

/** Culoarea afisata in selectorul din Setari. */
export const ACCENT_SWATCH: Record<Accent, string> = {
  blue: '#1E3A8A',
  pink: accents.pink.swatch,
  red: accents.red.swatch,
  green: accents.green.swatch,
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 } as const;

function buildTheme(scheme: Scheme, accent: Accent) {
  const base = scheme === 'dark' ? dark : light;
  const colors: Palette = accent === 'blue' ? base : { ...base, ...accents[accent][scheme] };
  return {
    scheme,
    accent,
    colors,
    gradients: (accent === 'blue'
      ? gradients[scheme]
      : accents[accent].gradients[scheme]) as Gradients,
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
const ACCENT_KEY = 'movemeal.accent';

interface ThemeValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [accent, setAccentState] = useState<Accent>('blue');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
      })
      .catch(() => undefined);
    AsyncStorage.getItem(ACCENT_KEY)
      .then((saved) => {
        if (ACCENTS.includes(saved as Accent)) setAccentState(saved as Accent);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
  }, []);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    AsyncStorage.setItem(ACCENT_KEY, next).catch(() => undefined);
  }, []);

  const scheme: Scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = useMemo(() => buildTheme(scheme, accent), [scheme, accent]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
  }, [theme]);

  const value = useMemo(
    () => ({ theme, mode, setMode, accent, setAccent }),
    [theme, mode, setMode, accent, setAccent],
  );
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
