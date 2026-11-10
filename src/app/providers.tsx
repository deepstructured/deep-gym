"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { MarketingLocale } from "@/shared/config/seo";

// Public pages do not need profile requests or the authenticated app bundle.
const ApplicationProviders = dynamic(() =>
  import("./application-providers").then((module) => module.ApplicationProviders),
);

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Root is session-dependent: its server page owns the provider choice.
  // A persistent layout prop can be stale after client-side sign-in/navigation.
  const ownsProviders = pathname === "/" || pathname === "/uk" || pathname === "/ru" ||
    pathname === "/about" || pathname.startsWith("/about/");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      if ("caches" in window) {
        caches.keys().then((keys) => keys.filter((key) => key.startsWith("deepgym-"))
          .forEach((key) => caches.delete(key))).catch(() => {});
      }
    }
  }, []);

  return ownsProviders ? children : <ApplicationProviders>{children}</ApplicationProviders>;
}

export function AuthenticatedRoot({ children }: { children: React.ReactNode }) {
  return <ApplicationProviders>{children}</ApplicationProviders>;
}

/** Keep <html lang> correct on client navigation where RootLayout is retained. */
export function PublicPageLanguage({ locale, children }: {
  locale: MarketingLocale;
  children: React.ReactNode;
}) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return children;
}
