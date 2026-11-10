"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useProfile } from "@/entities/user";
import { I18nProvider, isLang, useI18n } from "@/shared/i18n";
import { ProductExperience } from "@/widgets/product-experience";
import { syncDraftOwner } from "@/features/workout-form";
import { subscribeAuthIdentityChange } from "@/shared/lib/auth-session";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  // SSR must never share one athlete's cache with another request.
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) {
    const client = makeQueryClient();
    browserQueryClient = client;
    subscribeAuthIdentityChange((userId) => {
      void client.cancelQueries();
      client.clear();
      syncDraftOwner(userId);
    });
  }
  return browserQueryClient;
}

/** Applies the language stored in the user's profile once it loads
 *  (and whenever it changes, e.g. edited from another device). */
function ProfileLanguageSync() {
  const { data: profile } = useProfile();
  const { lang, setLang } = useI18n();

  // ref, not dep: reacting to `lang` here would revert an in-flight
  // local switch before the profile refetches.
  const langRef = useRef(lang);
  langRef.current = lang;

  const profileLang = profile?.language;
  useEffect(() => {
    if (isLang(profileLang) && profileLang !== langRef.current) {
      setLang(profileLang);
    }
  }, [profileLang, setLang]);

  return null;
}

export function ApplicationProviders({ children }: { children: React.ReactNode }) {
  // The root page owns a provider while other routes use the layout provider.
  // Keep the browser cache stable across that boundary and reset on identity.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ProfileLanguageSync />
        <ProductExperience>{children}</ProductExperience>
      </I18nProvider>
    </QueryClientProvider>
  );
}
