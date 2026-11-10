import { headers } from "next/headers";
import { translate } from "@/shared/i18n";
import { BrandMark, Spinner } from "@/shared/ui";

// This boundary is shared with public pages that have no application providers.
export default async function Loading() {
  const language = (await headers()).get("x-deepgym-language");
  const lang = language === "uk" || language === "ru" ? language : "en";
  return (
    <div role="status" aria-busy="true" aria-label={translate(lang, "common.loading")}
      style={{ minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
      <BrandMark width={40} /><Spinner />
    </div>
  );
}
