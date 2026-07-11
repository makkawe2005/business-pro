import { useCallback } from 'react';
import { useLanguageStore } from '../store/languageStore';
import { translations, serverErrorTranslations } from './translations';

export function useI18n() {
  const lang = useLanguageStore((s) => s.lang);
  const toggle = useLanguageStore((s) => s.toggle);

  const t = useCallback((key) => {
    const dict = translations[lang] || translations.en;
    return dict[key] !== undefined ? dict[key] : key;
  }, [lang]);

  const translateServerError = useCallback((message) => {
    if (lang === 'ar' && serverErrorTranslations[message]) return serverErrorTranslations[message];
    return message;
  }, [lang]);

  const nextLangLabel = lang === 'en' ? 'العربية' : 'English';

  return { t, lang, toggleLanguage: toggle, translateServerError, nextLangLabel };
}
