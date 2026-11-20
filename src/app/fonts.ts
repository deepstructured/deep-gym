import { Urbanist } from "next/font/google";
import localFont from "next/font/local";

export const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
  display: "swap",
});

export const metrics = localFont({
  src: "../shared/fonts/IBMPlexMono-Medium.ttf",
  variable: "--font-metrics",
  weight: "500",
  display: "swap",
});
