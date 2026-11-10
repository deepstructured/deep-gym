"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/shared/lib/supabase/client";
import { requireAuthUserId, useAuthSession } from "@/shared/lib/auth-session";
import { readAllPages } from "@/shared/lib/supabase/pagination";
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
  /** null loads the complete selected period (charts), otherwise newest N. */
  limit?: number | null;
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
  const { userId } = useAuthSession();
  return useQuery({
    queryKey: [...BODY_WEIGHT_MEASUREMENTS_QUERY_KEY, userId, { from, to, limit }],
    queryFn: async ({ signal }): Promise<BodyWeightMeasurement[]> => {
      const supabase = getSupabaseBrowser();
      const maximum = limit == null ? Infinity : Math.max(1, Math.trunc(limit));
      return readAllPages<BodyWeightMeasurement>(async ({ from: offset, to: end, count }) => {
        let query = supabase
        .from("body_weight_measurements")
        .select("*", { count }).eq("user_id", userId!)
        .order("measured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
        if (from) query = query.gte("measured_at", from);
        if (to) query = query.lte("measured_at", to);
        const result = await query.range(offset, Math.min(end, maximum - 1)).abortSignal(signal);
        return { ...result, count: result.count == null ? null : Math.min(result.count, maximum) };
      }, signal);
    },
    enabled: enabled && Boolean(userId),
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
      requireAuthUserId();
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
