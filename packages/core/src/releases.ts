/** Increment when a materially changed onboarding flow must run again. */
export const CURRENT_ONBOARDING_VERSION = 1;

/** Monotonic database acknowledgement plus the human-facing release label. */
export const CURRENT_RELEASE = {
  sequence: 4,
  label: "1.6.0",
} as const;
