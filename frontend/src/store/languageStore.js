import { create } from 'zustand';

function applyDocumentDirection(lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const initialLang = localStorage.getItem('appLanguage') || 'en';
applyDocumentDirection(initialLang);

export const useLanguageStore = create((set, get) => ({
  lang: initialLang,
  setLang(lang) {
    localStorage.setItem('appLanguage', lang);
    applyDocumentDirection(lang);
    set({ lang });
  },
  toggle() {
    get().setLang(get().lang === 'en' ? 'ar' : 'en');
  }
}));
