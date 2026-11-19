import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Params) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('ro');
  const t = useCallback(
    (key: string, params?: Params) => interpolate(lookup(dictionaries[language], key), params),
    [language],
  );
  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n trebuie folosit in interiorul I18nProvider');
  return ctx;
}
