import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { matricha, urbanist } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { UI_MODE_SCRIPT } from "@/shared/lib/ui-mode";
import { marketingMetadata, PRIVATE_ROBOTS, SEO_ORIGIN } from "@/shared/config/seo";
import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next";

const publicMetadata = marketingMetadata("en");

export const metadata: Metadata = {
  metadataBase: new URL(SEO_ORIGIN),
  title: {
    default: "DeepGym · Strength training tracker",
    template: "%s · DeepGym",
  },
  description: publicMetadata.description,
  applicationName: "DeepGym",
  category: "health and fitness",
  robots: PRIVATE_ROBOTS,
  openGraph: publicMetadata.openGraph,
  twitter: publicMetadata.twitter,
  formatDetection: { telephone: false },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    "msapplication-config": "/browserconfig.xml",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DeepGym",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Middleware derives this from the URL, never from a visitor preference:
  // each localized public page has one stable server-rendered language.
  const language = (await headers()).get("x-deepgym-language");
  const lang = language === "uk" || language === "ru" ? language : "en";
  return (
    // The inline script below writes data-ui/data-ui-mode before hydration,
    // so those attributes legitimately differ from the server render.
    <html
      lang={lang}
      className={`${urbanist.variable} ${matricha.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link
          rel="mask-icon"
          href="/safari-pinned-tab.svg"
          color="#D7F651"
        />
        {/* Resolves the mobile/desktop shell onto <html data-ui> before the
            first paint, so the layout never flashes the wrong mode. */}
        <script
          dangerouslySetInnerHTML={{ __html: UI_MODE_SCRIPT }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
