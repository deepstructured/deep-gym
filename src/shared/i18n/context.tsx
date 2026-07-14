"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setDateLocale } from "@/shared/lib/dates";
import {
  LANGS,
  translate,
  translateCount,
  type Lang,
  type MessageKey,
} from "./translations";

const STORAGE_KEY = "deepgym-lang";

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Pluralized count, e.g. tn("count.sets", 3) → "3 sets". */
  tn: (key: MessageKey, count: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function isLang(value: unknown): value is Lang {
  return (
    typeof value === "string" && (LANGS as readonly string[]).includes(value)
  );
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  // SSR always renders English; the stored choice is applied after mount
  // (and the profile's language after sign-in) to avoid hydration mismatch.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) setLangState(stored);
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable (private mode) — language just won't persist
    }
  }, []);

  // date-fns must see the new locale before children re-render with it
  setDateLocale(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      tn: (key, count) => translateCount(lang, key, count),
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
