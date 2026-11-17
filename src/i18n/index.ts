import { create } from 'zustand';
import { en } from './en';
import { ja } from './ja';

export type Language = 'ja' | 'en';

const LANGUAGE_KEY = 'jomon-pix-ui-language';

function preferredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (stored === 'ja' || stored === 'en') return stored;
  } catch {
    // Private browsing or restricted storage: use the device language.
  }
  const first = typeof navigator === 'undefined'
    ? 'en'
    : (navigator.languages?.[0] || navigator.language || 'en');
  return first.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}

function applyLanguage(language: Language): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const initialLanguage = preferredLanguage();
applyLanguage(initialLanguage);

export const useLanguage = create<LanguageState>((set) => ({
  language: initialLanguage,
  setLanguage: (language) => {
    try {
      localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Language switching still works during this session.
    }
    applyLanguage(language);
    set({ language });
  },
}));

/**
 * UI labels only. Never pass user-entered artwork text, IDs, data keys or
 * serialized objects into this function.
 */
export function t(label: string): string {
  if (useLanguage.getState().language === 'ja') return ja(label);
  const direct = en[label];
  if (direct !== undefined) return direct;

  const trimmed = label.trim();
  const translation = en[trimmed];
  if (translation !== undefined) {
    return label.replace(trimmed, translation);
  }
  return label;
}
