import type { Metadata } from "next";
import { TemplateEditorView } from "@/views/template-editor";

export const metadata: Metadata = { title: "Edit template" };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TemplateEditorView templateId={id} />;
}
