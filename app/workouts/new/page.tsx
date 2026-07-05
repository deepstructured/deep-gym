import type { Metadata } from "next";
import { WorkoutNewView } from "@/views/workout-new";

export const metadata: Metadata = { title: "New workout" };

export default function WorkoutNewPage() {
  return <WorkoutNewView />;
}
