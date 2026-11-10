import type { MetadataRoute } from "next";
import {
  absoluteUrl,
  IS_INDEXABLE_SITE,
  MARKETING_ALTERNATES,
  marketingPath,
  SEO_LOCALES,
} from "@/shared/config/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!IS_INDEXABLE_SITE) return [];

  return [
    ...SEO_LOCALES.map((locale) => ({
      url: absoluteUrl(marketingPath(locale)),
      alternates: { languages: MARKETING_ALTERNATES },
    })),
    { url: absoluteUrl("/privacy") },
  ];
}
