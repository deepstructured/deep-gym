import { headers } from "next/headers";
import { AuthenticatedRoot, PublicPageLanguage } from "@/app/providers";
import { AboutView } from "@/views/about";
import { HomeView } from "@/views/home";
import { marketingMetadata, PRIVATE_ROBOTS } from "@/shared/config/seo";

// The same URL serves public marketing or a personal dashboard. Never cache
// HTML/RSC output across sessions, including when the request is anonymous.
export const dynamic = "force-dynamic";

async function isAuthenticated() {
  // Middleware overwrites this header after auth.getUser() verifies the session.
  return (await headers()).get("x-deepgym-authenticated") === "1";
}

export async function generateMetadata() {
  return (await isAuthenticated())
    ? { title: { absolute: "Home · DeepGym" }, robots: PRIVATE_ROBOTS }
    : marketingMetadata("en");
}

export default async function HomePage() {
  if (await isAuthenticated()) {
    return <AuthenticatedRoot><HomeView /></AuthenticatedRoot>;
  }
  return <PublicPageLanguage locale="en"><AboutView /></PublicPageLanguage>;
}
