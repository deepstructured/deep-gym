import { PublicPageLanguage } from "@/app/providers";
import { AboutView } from "@/views/about";
import { marketingMetadata } from "@/shared/config/seo";

export const metadata = marketingMetadata("uk");
export default function Page() {
  return <PublicPageLanguage locale="uk"><AboutView locale="uk" /></PublicPageLanguage>;
}
