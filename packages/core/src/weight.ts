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

/** Parse an optional signed load ("+10", "-15", "0"). */
export function parseSignedWeight(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (!normalized || normalized === "+" || normalized === "-") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
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

export interface PlateStep {
  /** Plates to add on each side (loaded in pairs). */
  add: PlateCount[];
  /** Resulting total weight, kg. */
  targetKg: number;
  /** Jump over the current weight, kg. */
  deltaKg: number;
}

/**
 * The smallest jumps reachable by adding plates symmetrically on top of the
 * current load — one or two plates per side — smallest jump first. Each jump
 * uses the fewest plates that make it. Works for barbells and plate-loaded
 * machines alike: the bar never changes, so only the additions matter.
 */
export function nextPlateSteps(
  currentKg: number,
  specs: PlateSpec[],
  limit = 3,
): PlateStep[] {
  const byDelta = new Map<string, PlateStep & { plates: number }>();

  function consider(add: PlateCount[]) {
    const perSide = add.reduce((sum, c) => sum + c.plate.kg * c.count, 0);
    const deltaKg = perSide * 2;
    if (deltaKg <= 0) return;
    const plates = add.reduce((sum, c) => sum + c.count, 0);
    const key = deltaKg.toFixed(2);
    const existing = byDelta.get(key);
    if (existing && existing.plates <= plates) return;
    byDelta.set(key, {
      add,
      targetKg: currentKg + deltaKg,
      deltaKg,
      plates,
    });
  }

  specs.forEach((a, i) => {
    consider([{ plate: a, count: 1 }]);
    consider([{ plate: a, count: 2 }]);
    specs.slice(i + 1).forEach((b) =>
      consider([
        { plate: a, count: 1 },
        { plate: b, count: 1 },
      ]),
    );
  });

  return [...byDelta.values()]
    .sort((a, b) => a.deltaKg - b.deltaKg)
    .slice(0, limit)
    .map(({ add, targetKg, deltaKg }) => ({ add, targetKg, deltaKg }));
}

/** Typical fixed-dumbbell rack steps above the current dumbbell, in the
 *  display unit: 1 kg steps below 10 kg, then 2 / 2.5 kg; 5 lb steps. */
export function nextDumbbellSteps(currentKg: number, unit: Unit): number[] {
  const current = kgToUnit(currentKg, unit);
  const steps =
    unit === "lb" ? [5, 10] : current < 10 ? [1, 2] : [2, 2.5, 5];
  return steps.map((step) => unitToKg(roundWeight(current + step), unit));
}
