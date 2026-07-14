/** Built-in pixel-art avatars (see scripts/generate-avatars.mjs).
 *  avatar_url stores the public path, so they need no storage bucket. */
export const PRESET_AVATAR_IDS = [
  "lifter",
  "biceps",
  "kettlebell",
  "barbell",
  "plate",
  "shaker",
  "gorilla",
  "bull",
  "pulse",
  "flame",
] as const;

export const PRESET_AVATARS = PRESET_AVATAR_IDS.map((id) => ({
  id,
  url: `/avatars/${id}.svg`,
}));
