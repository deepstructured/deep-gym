import type { Metadata } from "next";
import { TemplateDetailView } from "@/views/template-detail";

export const metadata: Metadata = { title: "Workout template" };

export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateDetailView templateId={id} />;
}
