import type { Metadata } from "next";
import { LoginView } from "@/views/login";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to DeepGym to log workouts, manage training templates and track your strength progress.",
};

export default function LoginPage() {
  return <LoginView />;
}
