import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "../providers/auth-provider";

export type BodyWeightSource = "settings" | "workout";

export interface BodyWeightMeasurement {
  id: string;
  user_id: string;
  weight_kg: number;
  measured_at: string;
  source: BodyWeightSource;
  created_at: string;
}

export function useBodyWeightMeasurements({
  limit = 365,
  enabled = true,
}: { limit?: number; enabled?: boolean } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["body-weight-measurements", user?.id, limit],
    enabled: enabled && Boolean(user),
    queryFn: async (): Promise<BodyWeightMeasurement[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("body_weight_measurements")
        .select("*")
        .eq("user_id", user.id)
        .order("measured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(Math.max(1, limit));
      if (error) throw error;
      return data as BodyWeightMeasurement[];
    },
  });
}

/** Append a measurement and update the profile cache in one database transaction. */
export function useLogBodyWeight() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      weightKg,
      measuredAt,
      source = "settings",
    }: {
      weightKg: number;
      measuredAt?: string;
      source?: BodyWeightSource;
    }): Promise<BodyWeightMeasurement> => {
      if (!user) throw new Error("Not signed in");
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        throw new Error("Body weight must be greater than zero");
      }
      const args: Record<string, string | number> = {
        p_weight_kg: weightKg,
        p_source: source,
      };
      if (measuredAt) args.p_measured_at = measuredAt;
      const { data, error } = await supabase.rpc("log_body_weight", args);
      if (error) throw error;
      const measurement = (Array.isArray(data) ? data[0] : data) as
        | BodyWeightMeasurement
        | null;
      if (!measurement) throw new Error("Body-weight measurement was not returned");
      return measurement;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["body-weight-measurements", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
      ]);
    },
  });
}
