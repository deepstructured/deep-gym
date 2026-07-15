/** Increment when a materially changed onboarding flow must run again. */
export const CURRENT_ONBOARDING_VERSION = 1;

/**
 * `sequence` is the monotonic database value used for acknowledgement state.
 * `label` is the human-facing product version displayed in release notes.
 */
export const CURRENT_RELEASE = {
  sequence: 1,
  label: "1.3.0",
} as const;
