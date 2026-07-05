'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { translations, type Locale } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
  formatSaves: (count: number) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>('en');

  const t = (keyPath: string, variables?: Record<string, string | number>): string => {
    const keys = keyPath.split('.');
    let current: unknown = translations[locale];
    
    for (const key of keys) {
      if (typeof current !== 'object' || current === null || !(key in current)) {
        return keyPath;
      }
      current = (current as Record<string, unknown>)[key];
    }

    if (typeof current !== 'string') {
      return keyPath;
    }

    let result = current;
    if (variables) {
      Object.entries(variables).forEach(([k, v]) => {
        result = result.replace(`{${k}}`, String(v));
      });
    }
    return result;
  };

  const formatSaves = (count: number): string => {
    const pluralKey = count === 0 ? 'zero' : count === 1 ? 'one' : 'other';
    const translation = translations[locale].saves[pluralKey];
    return translation.replace('{count}', String(count));
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, formatSaves }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
