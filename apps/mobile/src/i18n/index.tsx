import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en } from './en';
import { ro, type Dictionary } from './ro';

export type Language = 'ro' | 'en';

const dictionaries: Record<Language, Dictionary> = { ro, en };

type Params = Record<string, string | number>;

function lookup(dict: Dictionary, key: string): string {
  const value = key.split('.').reduce<unknown>((node, part) => {
    return node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined;
  }, dict);
  return typeof value === 'string' ? value : key;
}

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Numar cu cel mult `digits` zecimale; in romana separatorul zecimal este virgula. */
export function formatNumber(value: number, language: Language, digits = 2): string {
  const factor = 10 ** digits;
  const text = String(Math.round(value * factor) / factor);
  return language === 'ro' ? text.replace('.', ',') : text;
}

/**
 * „1 săptămână”, „5 săptămâni”, „23 de săptămâni”.
 * In romana, dupa numerele care se termina in 00 sau 20–99 se adauga „de”.
 */
export function formatWeeks(n: number, language: Language): string {
  if (language === 'en') return n === 1 ? '1 week' : `${n} weeks`;
  if (n === 1) return 'o săptămână';
  const lastTwo = n % 100;
  const withDe = lastTwo === 0 || lastTwo >= 20;
  return `${n} ${withDe ? 'de ' : ''}săptămâni`;
}

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Params) => string;
  formatNumber: (value: number, digits?: number) => string;
  formatWeeks: (n: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const LANGUAGE_KEY = 'movemeal.language';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ro');

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => {
        if (saved === 'ro' || saved === 'en') setLanguageState(saved);
      })
      .catch(() => undefined);
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => undefined);
  }, []);
  const t = useCallback(
    (key: string, params?: Params) => interpolate(lookup(dictionaries[language], key), params),
    [language],
  );
  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      t,
      formatNumber: (n, digits) => formatNumber(n, language, digits),
      formatWeeks: (n) => formatWeeks(n, language),
    }),
    [language, setLanguage, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n trebuie folosit in interiorul I18nProvider');
  return ctx;
}
