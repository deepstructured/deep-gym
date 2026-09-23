import {
  LANGS,
  translate,
  type Lang,
  type MessageKey,
} from "@deepgym/core/i18n";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./auth-provider";

function asLang(value: unknown): Lang | null {
  return typeof value === "string" && LANGS.some((lang) => lang === value)
    ? (value as Lang)
    : null;
}

function deviceLanguage(): Lang {
  try {
    return (
      asLang(Intl.DateTimeFormat().resolvedOptions().locale.split(/[-_]/)[0]) ??
      "en"
    );
  } catch {
    return "en";
  }
}

type LocaleContextValue = {
  lang: Lang;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [lang, setLang] = useState<Lang>(deviceLanguage);

  useEffect(() => {
    let active = true;
    setLang(deviceLanguage());
    if (user) {
      void supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          const profileLang = asLang(data?.language);
          if (active && profileLang) setLang(profileLang);
        });
    }
    return () => {
      active = false;
    };
  }, [user?.id]);

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang],
  );
  const value = useMemo(() => ({ lang, t, setLang }), [lang, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useI18n must be used inside LocaleProvider");
  return context;
}
