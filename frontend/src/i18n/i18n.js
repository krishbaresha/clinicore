import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import enTranslations from "./locales/en.json";
import urTranslations from "./locales/ur.json";

const resources = {
  en: {
    translation: enTranslations,
  },
  ur: {
    translation: urTranslations,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs: ["en", "ur"],
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "cf_language",
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false, // React already escapes by default
    },
  });

export default i18n;
