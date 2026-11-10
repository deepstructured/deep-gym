import { PublicPageLanguage } from "@/app/providers";
import { AboutView } from "@/views/about";
import { marketingMetadata } from "@/shared/config/seo";

export const metadata = marketingMetadata("ru");
export default function Page() {
  return <PublicPageLanguage locale="ru"><AboutView locale="ru" /></PublicPageLanguage>;
}
