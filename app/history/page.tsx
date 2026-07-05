import type { Metadata } from "next";
import { HistoryView } from "@/views/history";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <HistoryView />;
}
