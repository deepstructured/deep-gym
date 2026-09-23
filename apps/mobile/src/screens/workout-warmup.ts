import { parseSignedWeight, parseWeight, roundWeight } from "@deepgym/core/weight";
import { createDraftSet, type DraftExercise, type DraftSet } from "../data/draft";

const RAMP = [0.5, 0.7, 0.85];

/** Insert the next warm-up after existing warm-ups, matching the PWA ramp. */
export function withWarmupSet(exercise: DraftExercise): DraftSet[] {
  const warmups = exercise.sets.filter((set) => set.warmup);
  const firstWorking = exercise.sets.find((set) => !set.warmup);
  const bodyweight = exercise.equipment === "bodyweight";
  const share = RAMP[Math.min(warmups.length, RAMP.length - 1)];
  let weight = "";

  if (bodyweight) {
    const working = parseWeight(firstWorking?.weight ?? "");
    const added = parseSignedWeight(firstWorking?.addedWeight ?? "");
    const base = working != null && added != null ? working - added : null;
    weight = base != null && base > 0 ? String(roundWeight(base)) : "";
  } else {
    const working = parseWeight(firstWorking?.weight ?? "");
    if (working != null) {
      const step = exercise.unit === "lb" ? 5 : 2.5;
      const ramped = Math.floor((working * share) / step) * step;
      weight = ramped > 0 ? String(roundWeight(ramped)) : "";
    }
  }

  const warmup: DraftSet = {
    ...createDraftSet(),
    weight,
    addedWeight: bodyweight ? "0" : undefined,
    reps: "",
    toFailure: false,
    warmup: true,
  };
  const at = exercise.sets.findLastIndex((set) => set.warmup) + 1;
  const next = [...exercise.sets];
  next.splice(at, 0, warmup);
  return next;
}
