export type Unit = "kg" | "lb";

export const KG_PER_LB = 0.45359237;

export function kgToUnit(kg: number, unit: Unit): number {
  return unit === "kg" ? kg : kg / KG_PER_LB;
}

export function unitToKg(value: number, unit: Unit): number {
  return unit === "kg" ? value : value * KG_PER_LB;
}

/** Round for display: at most 1 decimal, no trailing zeros. */
export function roundWeight(value: number): number {
  return Math.round(value * 10) / 10;
}

export function formatWeight(kg: number | null | undefined, unit: Unit): string {
  if (kg == null) return "—";
  return `${roundWeight(kgToUnit(kg, unit))} ${unit}`;
}

/** Parse user-entered weight ("62,5" / "62.5") → positive number or null. */
export function parseWeight(raw: string): number | null {
  const value = parseFloat(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** A plate denomination as it exists in the gym: 20 kg plate, 45 lb plate… */
export interface PlateSpec {
  value: number;
  unit: Unit;
  kg: number;
}

export function buildPlateSpecs(
  platesKg: number[],
  platesLb: number[],
): PlateSpec[] {
  const specs: PlateSpec[] = [
    ...platesKg.map((value) => ({ value, unit: "kg" as Unit, kg: value })),
    ...platesLb.map((value) => ({
      value,
      unit: "lb" as Unit,
      kg: value * KG_PER_LB,
    })),
  ];
  return specs.filter((s) => s.kg > 0).sort((a, b) => b.kg - a.kg);
}

export interface PlateCount {
  plate: PlateSpec;
  /** Plates per side (double it for the total count). */
  count: number;
}

export interface PlateVariant {
  counts: PlateCount[];
  perSideKg: number;
  /** Full assembled weight incl. both sides and the bar, in kg. */
  assembledKg: number;
  plateCount: number;
}

// lb plates rarely hit a kg target exactly — allow a small mismatch
const MATCH_EPS_KG = 0.26;
const MAX_PLATES_PER_SIDE = 8;
const MAX_VARIANTS = 5;

/**
 * All reasonable ways to assemble `totalKg` from the available plates,
 * loaded symmetrically (pairs). With `barKg` the bar is subtracted first
 * and the rest is split per side (barbell); without it the total itself
 * is split into pairs (plate-loaded machine): 60 kg → 2×20 + 2×10.
 * Best variants first: exact matches, then fewest plates.
 */
export function calcPlateVariants(
  totalKg: number,
  specs: PlateSpec[],
  barKg?: number,
): PlateVariant[] {
  const load = barKg != null ? totalKg - barKg : totalKg;
  if (load <= 0 || specs.length === 0) return [];
  const perSide = load / 2;

  const found: PlateCount[][] = [];
  const current: PlateCount[] = [];

  function dfs(index: number, remaining: number, plateCount: number) {
    if (found.length >= 60) return;
    if (Math.abs(remaining) <= MATCH_EPS_KG) {
      if (current.length > 0) {
        found.push(current.map((c) => ({ ...c })));
      }
      return;
    }
    if (
      remaining < -MATCH_EPS_KG ||
      index >= specs.length ||
      plateCount >= MAX_PLATES_PER_SIDE
    ) {
      return;
    }
    const spec = specs[index];
    const maxN = Math.min(
      Math.floor((remaining + MATCH_EPS_KG) / spec.kg),
      MAX_PLATES_PER_SIDE - plateCount,
    );
    for (let n = maxN; n >= 0; n--) {
      if (n > 0) current.push({ plate: spec, count: n });
      dfs(index + 1, remaining - n * spec.kg, plateCount + n);
      if (n > 0) current.pop();
    }
  }
  dfs(0, perSide, 0);

  return found
    .map((counts) => {
      const perSideKg = counts.reduce((s, c) => s + c.plate.kg * c.count, 0);
      return {
        counts,
        perSideKg,
        assembledKg: perSideKg * 2 + (barKg ?? 0),
        plateCount: counts.reduce((s, c) => s + c.count, 0),
        diff: Math.abs(perSideKg - perSide),
      };
    })
    .sort((a, b) => a.diff - b.diff || a.plateCount - b.plateCount)
    .slice(0, MAX_VARIANTS)
    .map(({ counts, perSideKg, assembledKg, plateCount }) => ({
      counts,
      perSideKg,
      assembledKg,
      plateCount,
    }));
}

/** Greedy fallback when no exact combination exists. */
export function calcPlatesGreedy(
  totalKg: number,
  specs: PlateSpec[],
  barKg?: number,
): { counts: PlateCount[]; remainderKg: number } {
  const load = barKg != null ? totalKg - barKg : totalKg;
  let rest = load / 2;
  const counts: PlateCount[] = [];
  for (const spec of specs) {
    const n = Math.floor((rest + 1e-9) / spec.kg);
    if (n > 0) {
      counts.push({ plate: spec, count: n });
      rest -= n * spec.kg;
    }
  }
  return { counts, remainderKg: Math.round(rest * 2 * 100) / 100 };
}
