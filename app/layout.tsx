import type { Metadata, Viewport } from "next";
import { matricha, urbanist } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { UI_MODE_SCRIPT } from "@/shared/lib/ui-mode";
import "@/app/globals.css";
import { Analytics } from "@vercel/analytics/next"

export const metadata: Metadata = {
  title: {
    default: "DeepGym",
    template: "%s · DeepGym",
  },
  description: "Personal strength training tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // The inline script below writes data-ui/data-ui-mode before hydration,
    // so those attributes legitimately differ from the server render.
    <html
      lang="en"
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
