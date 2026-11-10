import type { MetadataRoute } from "next";
import { absoluteUrl, IS_INDEXABLE_SITE } from "@/shared/config/seo";

export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE_SITE) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    // App/login pages remain crawlable so crawlers can observe their noindex
    // directives. Authentication, not robots.txt, protects personal data.
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
