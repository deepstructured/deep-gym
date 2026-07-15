import type { Metadata, Viewport } from "next";
import { matricha, urbanist } from "@/app/fonts";
import { Providers } from "@/app/providers";
import "@/app/globals.css";

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
    <html lang="en" className={`${urbanist.variable} ${matricha.variable}`}>
      <head>
        <link
          rel="mask-icon"
          href="/safari-pinned-tab.svg"
          color="#D7F651"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
