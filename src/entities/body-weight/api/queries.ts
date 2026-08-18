"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import type {
  BodyWeightMeasurement,
  LogBodyWeightInput,
} from "../model/types";

export const BODY_WEIGHT_MEASUREMENTS_QUERY_KEY = [
  "body-weight-measurements",
] as const;

export interface BodyWeightMeasurementsQuery {
  from?: string;
  to?: string;
  limit?: number;
  enabled?: boolean;
}

/** Body-weight history, newest first. Multiple measurements at the same
 * timestamp are valid and remain ordered by their creation time. */
export function useBodyWeightMeasurements({
  from,
  to,
  limit = 90,
  enabled = true,
}: BodyWeightMeasurementsQuery = {}) {
  return useQuery({
    queryKey: [...BODY_WEIGHT_MEASUREMENTS_QUERY_KEY, { from, to, limit }],
    queryFn: async (): Promise<BodyWeightMeasurement[]> => {
      const supabase = getSupabaseBrowser();
      let query = supabase
        .from("body_weight_measurements")
        .select("*")
        .order("measured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(Math.max(1, limit));

      if (from) query = query.gte("measured_at", from);
      if (to) query = query.lte("measured_at", to);

      const { data, error } = await query;
      if (error) throw error;
      return data as BodyWeightMeasurement[];
    },
    enabled,
  });
}

/** Calls the atomic database RPC: append history and advance the profile's
 * newest-measurement cache in the same transaction. */
export function useLogBodyWeight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      weightKg,
      measuredAt,
      source = "settings",
    }: LogBodyWeightInput): Promise<BodyWeightMeasurement> => {
      if (!Number.isFinite(weightKg) || weightKg <= 0) {
        throw new Error("Body weight must be greater than zero");
      }

      const supabase = getSupabaseBrowser();
      const args: Record<string, string | number> = {
        p_weight_kg: weightKg,
        p_source: source,
      };
      if (measuredAt) args.p_measured_at = measuredAt;

      const { data, error } = await supabase.rpc("log_body_weight", args);
      if (error) throw error;

      const measurement = (
        Array.isArray(data) ? data[0] : data
      ) as BodyWeightMeasurement | null;
      if (!measurement) throw new Error("Body-weight measurement was not returned");
      return measurement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: BODY_WEIGHT_MEASUREMENTS_QUERY_KEY,
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
