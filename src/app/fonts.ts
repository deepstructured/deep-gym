import { Urbanist } from "next/font/google";
import localFont from "next/font/local";

export const urbanist = Urbanist({
  subsets: ["latin"],
  variable: "--font-urbanist",
  display: "swap",
});

export const matricha = localFont({
  src: "../shared/fonts/matricha.ttf",
  variable: "--font-matricha",
  display: "swap",
});
