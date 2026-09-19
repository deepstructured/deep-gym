"use client";

import { createContext, useContext } from "react";
import type { Profile } from "@/entities/user";
import type { Workout } from "@/entities/workout";
import type { Unit } from "@/shared/lib/weight";
import type {
  HomeWidget,
  WidgetConfig,
  WidgetSize,
} from "../model/layout";

/** Data every tile shares — loaded once by the dashboard (React Query also
 *  dedupes, but this keeps tiles free of range bookkeeping). */
export interface HomeData {
  profile: Profile | null | undefined;
  unit: Unit;
  /** Full history, newest first (shared with the Progress page). */
  workouts: Workout[];
  workoutsLoaded: boolean;
  workoutCount: number | undefined;
  openWeightSheet: () => void;
}

const HomeDataContext = createContext<HomeData | null>(null);
export const HomeDataProvider = HomeDataContext.Provider;

export function useHomeData(): HomeData {
  const value = useContext(HomeDataContext);
  if (!value) throw new Error("useHomeData must be used inside the dashboard");
  return value;
}

export interface TileProps {
  widget: HomeWidget;
  /** Effective size to render. */
  size: WidgetSize;
  /** A small tile stretched to full width (no wider variant exists). */
  wide: boolean;
  onConfigChange: (config: WidgetConfig) => void;
}
