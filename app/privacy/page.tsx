import type { Metadata } from "next";
import { PrivacyView } from "@/views/privacy";
import { absoluteUrl, marketingMetadata, PUBLIC_ROBOTS } from "@/shared/config/seo";

const title = "Privacy policy · DeepGym";
const description = "How DeepGym handles account, training, and app usage data.";

export const metadata: Metadata = {
  title: "Privacy policy",
  description,
  robots: PUBLIC_ROBOTS,
  alternates: { canonical: absoluteUrl("/privacy") },
  openGraph: {
    ...marketingMetadata("en").openGraph,
    title,
    description,
    url: absoluteUrl("/privacy"),
    alternateLocale: [],
  },
  twitter: {
    ...marketingMetadata("en").twitter,
    title,
    description,
  },
};

export default PrivacyView;
