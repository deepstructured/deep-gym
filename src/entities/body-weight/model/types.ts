export type BodyWeightSource = "settings" | "workout";

export interface BodyWeightMeasurement {
  id: string;
  user_id: string;
  /** Canonical database value; display conversion happens at the UI edge. */
  weight_kg: number;
  measured_at: string;
  source: BodyWeightSource;
  created_at: string;
}

export interface LogBodyWeightInput {
  weightKg: number;
  measuredAt?: string;
  source?: BodyWeightSource;
}

export interface BodyweightLoad {
  /** The athlete's actual body-weight snapshot for the workout. */
  bodyWeightKg: number;
  /** Total effective load persisted in sets.weight_kg. */
  totalWeightKg: number;
  /** Signed difference; negative values represent assisted load. */
  addedLoadKg: number;
}

/** Resolve the signed added/assisted load without changing the persisted
 * sets.weight_kg contract: that column remains the total effective load. */
export function bodyweightLoadFromTotal(
  totalWeightKg: number,
  bodyWeightKg: number,
): BodyweightLoad {
  return {
    bodyWeightKg,
    totalWeightKg,
    addedLoadKg: totalWeightKg - bodyWeightKg,
  };
}

/** Build a total effective load. `addedLoadKg` intentionally accepts negative
 * values so assisted pull-ups/dips can be represented by the domain model. */
export function bodyweightLoadFromAdded(
  bodyWeightKg: number,
  addedLoadKg: number,
): BodyweightLoad {
  return {
    bodyWeightKg,
    addedLoadKg,
    totalWeightKg: bodyWeightKg + addedLoadKg,
  };
}
