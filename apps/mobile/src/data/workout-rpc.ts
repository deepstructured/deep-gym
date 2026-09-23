import type { MessageKey } from "@deepgym/core/i18n";

/** Map database errors to copy that both workout screens can localize. */
export function workoutRpcErrorKey(error: unknown): MessageKey | null {
  if (!error || typeof error !== "object") return null;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  if (code === "PGRST202" || code === "42883") {
    return "workout.serverUpdateRequired";
  }
  if (message.includes("WORKOUT_CREATE_KEY_CONFLICT")) {
    return "workout.alreadySavedConflict";
  }
  if (message.includes("WORKOUT_LOAD_MODE_MISMATCH")) {
    return "workout.staleExerciseMode";
  }
  return null;
}
