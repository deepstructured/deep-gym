import type { Metadata } from "next";
import { WorkoutEditView } from "@/views/workout-edit";

export const metadata: Metadata = { title: "Edit workout" };

export default async function WorkoutEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WorkoutEditView workoutId={id} />;
}
