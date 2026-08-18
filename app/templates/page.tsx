import type { Metadata } from "next";
import { TemplatesView } from "@/views/templates";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return <TemplatesView />;
}
