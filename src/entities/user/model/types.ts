import type { Lang } from "@/shared/i18n";
import type { Unit } from "@/shared/lib/weight";
import type { TrainingSchedule } from "./training-schedule";

export interface Profile {
  id: string;
  display_name: string | null;
  unit: Unit;
  bar_weight_kg: number;
  /** Plate denominations in kg (20, 10, 5…). */
  plates_kg: number[];
  /** Plate denominations in lb (45, 25, 10…). */
  plates_lb: number[];
  /** Interface language; defaults to English. */
  language: Lang | null;
  /** Custom avatar (public storage URL); null = default avatar. */
  avatar_url: string | null;
  /** Monday → Sunday; null until the user configures their training week. */
  training_schedule: TrainingSchedule | null;
  /** Latest onboarding flow version completed by the user; 0 = incomplete. */
  onboarding_version: number;
  /** When the latest onboarding flow was completed. */
  onboarding_completed_at: string | null;
  /** Latest product release announcement acknowledged by the user. */
  last_seen_release_version: number;
  telegram_id: number | null;
  telegram_username: string | null;
  created_at: string;
}
