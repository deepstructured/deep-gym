/** Built-in DeepGym pixel-art avatars.
 *
 * `null` remains the canonical default in profiles and renders the first
 * generated preset. Legacy SVG assets stay in public/avatars because existing
 * users may still have those URLs stored in `avatar_url`.
 */
export const PRESET_AVATARS = [
  { id: "portal", labelKey: "avatarPreset.portal", url: null },
  {
    id: "shark",
    labelKey: "avatarPreset.shark",
    url: "/avatars/deepgym-pixel-shark.webp",
  },
  {
    id: "mountain",
    labelKey: "avatarPreset.mountain",
    url: "/avatars/deepgym-pixel-mountain.webp",
  },
  {
    id: "lifter",
    labelKey: "avatarPreset.lifter",
    url: "/avatars/deepgym-pixel-lifter.webp",
  },
  {
    id: "gorilla",
    labelKey: "avatarPreset.gorilla",
    url: "/avatars/deepgym-pixel-gorilla.webp",
  },
  {
    id: "raven",
    labelKey: "avatarPreset.raven",
    url: "/avatars/deepgym-pixel-raven.webp",
  },
  {
    id: "eclipse",
    labelKey: "avatarPreset.eclipse",
    url: "/avatars/deepgym-pixel-eclipse.webp",
  },
  {
    id: "barbell",
    labelKey: "avatarPreset.barbell",
    url: "/avatars/deepgym-pixel-barbell.webp",
  },
  {
    id: "grip",
    labelKey: "avatarPreset.grip",
    url: "/avatars/deepgym-pixel-grip.webp",
  },
  {
    id: "pulse",
    labelKey: "avatarPreset.pulse",
    url: "/avatars/deepgym-pixel-pulse.webp",
  },
] as const;
