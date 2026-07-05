import { describe, it, expect } from 'vitest';
import { translations } from './translations';

describe('i18n Pluralization Tests', () => {
  const formatSaves = (locale: 'en' | 'es', count: number): string => {
    const pluralKey = count === 0 ? 'zero' : count === 1 ? 'one' : 'other';
    const translation = translations[locale].saves[pluralKey];
    return translation.replace('{count}', String(count));
  };

  it('should format saves count correctly in English', () => {
    expect(formatSaves('en', 0)).toBe('0 saves');
    expect(formatSaves('en', 1)).toBe('1 save');
    expect(formatSaves('en', 12)).toBe('12 saves');
  });

  it('should format saves count correctly in Spanish', () => {
    expect(formatSaves('es', 0)).toBe('0 guardados');
    expect(formatSaves('es', 1)).toBe('1 guardado');
    expect(formatSaves('es', 12)).toBe('12 guardados');
  });
});
