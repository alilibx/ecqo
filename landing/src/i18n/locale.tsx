import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { translations, type Locale, type TranslationKeys } from "./translations";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TranslationKeys;
  dir: "ltr" | "rtl";
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: translations.en,
  dir: "ltr",
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("ecqqo-locale") as Locale | null;
    if (saved && saved in translations) {
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.title = translations[locale].pageTitle;
  }, [locale]);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem("ecqqo-locale", l);
  }

  const value: LocaleContextValue = {
    locale,
    setLocale,
    t: translations[locale],
    dir: locale === "ar" ? "rtl" : "ltr",
  };

  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
