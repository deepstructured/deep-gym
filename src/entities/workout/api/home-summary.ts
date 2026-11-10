"use client";

import { useQuery } from "@tanstack/react-query";
import type { BestLift, PersonalRecord } from "@deepgym/core/analytics";
import { useAuthSession } from "@/shared/lib/auth-session";
import { toISODate } from "@/shared/lib/dates";
import { periodStart } from "@/shared/lib/period";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";

export interface WorkoutActivity {
  id: string;
  date: string;
  sets: number;
  reps: number;
  volumeKg: number;
}

export interface HomeWorkoutSummary {
  total: number;
  activity: WorkoutActivity[];
  records: PersonalRecord[];
  lifts: BestLift[];
  recentExerciseIds: string[];
  muscleSets: Record<string, number>;
}

/** One compact row of aggregates avoids transferring every historical set to
 * Home. The RPC preserves all-time PR baselines and excludes warm-up sets. */
export function useHomeWorkoutSummary() {
  const { userId, status } = useAuthSession();
  const today = toISODate(new Date());
  const sinceRecords = periodStart("3m");
  const sinceMuscles = periodStart("1m");
  return useQuery({
    queryKey: ["workouts", "home-summary", userId, today, sinceRecords, sinceMuscles],
    queryFn: async ({ signal }): Promise<HomeWorkoutSummary> => {
      const { data, error } = await getSupabaseBrowser().rpc("home_dashboard_summary", {
        p_today: today, p_records_since: sinceRecords, p_muscle_since: sinceMuscles,
      }).abortSignal(signal);
      if (error) throw error;
      if (!data || !Array.isArray(data.activity) || !Array.isArray(data.records) || !Array.isArray(data.lifts)) {
        throw new Error("Dashboard data was not returned");
      }
      return data as HomeWorkoutSummary;
    },
    enabled: status === "authenticated",
  });
}
