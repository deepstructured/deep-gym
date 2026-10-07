import type { MetadataRoute } from "next";
import { screenshotPath } from "@/shared/config/screenshots";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DeepGym — Workout Tracker",
    short_name: "DeepGym",
    description: "Log sets, reps and weights, plan gym workouts and track your strength progress.",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0c",
    theme_color: "#0a0a0c",
    categories: ["health", "fitness", "sports"],
    prefer_related_applications: false,
    screenshots: [
      {
        src: screenshotPath("home"),
        sizes: "780x1688",
        type: "image/webp",
        form_factor: "narrow",
        label: "DeepGym workout dashboard with training history and progress",
      },
      {
        src: screenshotPath("new-workout"),
        sizes: "780x1688",
        type: "image/webp",
        form_factor: "narrow",
        label: "Log exercises, weights, repetitions and sets in DeepGym",
      },
    ],
    shortcuts: [
      {
        name: "New workout",
        short_name: "Log workout",
        description: "Start logging a training session",
        url: "/workouts/new",
      },
      {
        name: "Workout history",
        short_name: "History",
        description: "Review previous training sessions",
        url: "/history",
      },
      {
        name: "Training progress",
        short_name: "Progress",
        description: "Explore your strength training progress",
        url: "/progress",
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
