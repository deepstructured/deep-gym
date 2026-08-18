import type { Metadata } from "next";
import { TemplateEditorView } from "@/views/template-editor";

export const metadata: Metadata = { title: "New template" };

export default function NewTemplatePage() {
  return <TemplateEditorView />;
}
