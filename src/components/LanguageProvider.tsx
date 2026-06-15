'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { mrDictionary } from '@/lib/i18n/mr';

type Language = 'en' | 'mr';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    // Load preference from DB settings on mount
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.app_language === 'mr' || data.app_language === 'en') {
          setLanguageState(data.app_language);
        }
      })
      .catch(console.error);
  }, []);

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    // Persist globally
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_language: lang }),
      });
    } catch (e) {
      console.error('Failed to save language preference', e);
    }
  };

  const t = (key: string): string => {
    if (language === 'mr' && mrDictionary[key]) {
      return mrDictionary[key];
    }
    return key; // Default fallback to English (the key itself)
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
