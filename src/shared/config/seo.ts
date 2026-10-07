import type { Metadata } from "next";
import { SCREENSHOT_REVISION } from "./screenshots";

/** Public marketing origin. Keep it separate from local/OAuth redirect URLs. */
function resolveSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SEO_URL || "https://www.deepgym.fit";
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("NEXT_PUBLIC_SEO_URL must be an HTTP(S) origin without credentials");
  }
  return url.origin;
}

export const SEO_ORIGIN = resolveSiteOrigin();
export const SITE_ORIGIN = SEO_ORIGIN;
export const SEO_LOCALES = ["en", "uk", "ru"] as const;
export type MarketingLocale = (typeof SEO_LOCALES)[number];

const hostname = new URL(SEO_ORIGIN).hostname;
const isLocalOrigin =
  /^(localhost|127\..*|0\.0\.0\.0|\[::1\])$/.test(hostname) ||
  /\.(localhost|local|internal|test|invalid)$/.test(hostname);

/** Preview deployments must not compete with the canonical production site. */
export const IS_INDEXABLE_SITE =
  process.env.NODE_ENV === "production" &&
  (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production") &&
  SEO_ORIGIN.startsWith("https://") &&
  !isLocalOrigin;

export function absoluteUrl(path: string): string {
  return new URL(path, `${SEO_ORIGIN}/`).toString();
}

export function marketingPath(locale: MarketingLocale): string {
  return locale === "en" ? "/" : `/${locale}`;
}

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: true,
};

export const PUBLIC_ROBOTS: Metadata["robots"] = IS_INDEXABLE_SITE
  ? {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    }
  : PRIVATE_ROBOTS;

const MARKETING_META = {
  en: {
    title: "Strength training tracker & workout log",
    description:
      "Log sets, reps and weights with DeepGym. Plan gym workouts, reuse templates and track your strength progress in a mobile-friendly workout tracker.",
    imageAlt: "DeepGym strength training tracker and workout log",
    locale: "en_US",
  },
  uk: {
    title: "Щоденник тренувань і трекер прогресу",
    description:
      "Записуйте підходи, повторення та вагу в DeepGym. Плануйте тренування, зберігайте шаблони й відстежуйте прогрес у зручному щоденнику для залу.",
    imageAlt: "DeepGym — щоденник силових тренувань і трекер прогресу",
    locale: "uk_UA",
  },
  ru: {
    title: "Дневник тренировок и трекер прогресса",
    description:
      "Записывайте подходы, повторения и вес в DeepGym. Планируйте тренировки, сохраняйте шаблоны и следите за прогрессом в удобном дневнике для зала.",
    imageAlt: "DeepGym — дневник силовых тренировок и трекер прогресса",
    locale: "ru_RU",
  },
} satisfies Record<MarketingLocale, {
  title: string;
  description: string;
  imageAlt: string;
  locale: string;
}>;

export const MARKETING_ALTERNATES = {
  en: absoluteUrl(marketingPath("en")),
  uk: absoluteUrl(marketingPath("uk")),
  ru: absoluteUrl(marketingPath("ru")),
  "x-default": absoluteUrl(marketingPath("en")),
};

export function marketingMetadata(locale: MarketingLocale): Metadata {
  const copy = MARKETING_META[locale];
  const title = `${copy.title} · DeepGym`;
  const image = {
    url: absoluteUrl(`/social/deepgym-${locale}.png?v=${SCREENSHOT_REVISION}`),
    width: 1200,
    height: 630,
    alt: copy.imageAlt,
    type: "image/png",
  };

  return {
    title: { absolute: title },
    description: copy.description,
    robots: PUBLIC_ROBOTS,
    alternates: {
      canonical: absoluteUrl(marketingPath(locale)),
      languages: MARKETING_ALTERNATES,
    },
    openGraph: {
      type: "website",
      siteName: "DeepGym",
      url: absoluteUrl(marketingPath(locale)),
      title,
      description: copy.description,
      locale: copy.locale,
      alternateLocale: SEO_LOCALES.filter((item) => item !== locale).map(
        (item) => MARKETING_META[item].locale,
      ),
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: copy.description,
      images: [image],
    },
  };
}
