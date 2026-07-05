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
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${urbanist.variable} ${matricha.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
