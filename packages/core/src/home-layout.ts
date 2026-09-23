/** Tile sizes of the 2-column home grid (iOS-style):
 *  s — half width, one row; m — full width, one row; l — full width, two
 *  rows (content may grow it further). */
export type WidgetSize = "s" | "m" | "l";

export const WIDGET_TYPES = [
  "startWorkout",
  "weekActivity",
  "streak",
  "totalWorkouts",
  "weeklyGoal",
  "nextWorkout",
  "recentWorkouts",
  "exerciseProgress",
  "templates",
  "bodyWeight",
  "consistency",
  "weeklyVolume",
  "personalRecords",
  "muscleBalance",
  "monthSummary",
  "quickActions",
  "repeatLast",
  "strongestLifts",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

export type WidgetCategory = "actions" | "activity" | "progress" | "plan" | "body";

export interface WidgetDefinition {
  type: WidgetType;
  category: WidgetCategory;
  /** Allowed sizes; the first one is the default. */
  sizes: WidgetSize[];
  /** Several instances allowed (e.g. one chart per exercise). */
  multiple?: boolean;
}

export const WIDGETS: Record<WidgetType, WidgetDefinition> = {
  startWorkout: { type: "startWorkout", category: "actions", sizes: ["m", "s"] },
  quickActions: { type: "quickActions", category: "actions", sizes: ["m"] },
  repeatLast: { type: "repeatLast", category: "actions", sizes: ["s"] },
  weekActivity: { type: "weekActivity", category: "activity", sizes: ["s", "m"] },
  streak: { type: "streak", category: "activity", sizes: ["s"] },
  totalWorkouts: { type: "totalWorkouts", category: "activity", sizes: ["s"] },
  weeklyGoal: { type: "weeklyGoal", category: "activity", sizes: ["s", "m"] },
  consistency: { type: "consistency", category: "activity", sizes: ["m", "l"] },
  weeklyVolume: { type: "weeklyVolume", category: "activity", sizes: ["s", "m"] },
  monthSummary: { type: "monthSummary", category: "activity", sizes: ["m"] },
  exerciseProgress: {
    type: "exerciseProgress",
    category: "progress",
    sizes: ["l", "m"],
  },
  personalRecords: {
    type: "personalRecords",
    category: "progress",
    sizes: ["m", "l"],
  },
  strongestLifts: {
    type: "strongestLifts",
    category: "progress",
    sizes: ["m", "l"],
  },
  muscleBalance: { type: "muscleBalance", category: "progress", sizes: ["m", "l"] },
  nextWorkout: { type: "nextWorkout", category: "plan", sizes: ["m"] },
  templates: { type: "templates", category: "plan", sizes: ["m", "l"] },
  recentWorkouts: { type: "recentWorkouts", category: "plan", sizes: ["l", "m"] },
  bodyWeight: { type: "bodyWeight", category: "body", sizes: ["s", "m"] },
};

export const WIDGET_CATEGORIES: WidgetCategory[] = [
  "actions",
  "activity",
  "progress",
  "plan",
  "body",
];

/** Per-instance options (only the exercise chart has any today). */
export interface WidgetConfig {
  exerciseId?: string;
  metric?: string;
}

export interface HomeWidget {
  /** Stable instance id (unique even if a type ever allows several). */
  id: string;
  type: WidgetType;
  size: WidgetSize;
  config?: WidgetConfig;
}

export interface HomeLayout {
  version: 1;
  widgets: HomeWidget[];
}

/** Every user starts here until they customize. */
export const DEFAULT_LAYOUT: HomeLayout = {
  version: 1,
  widgets: [
    { id: "start", type: "startWorkout", size: "m" },
    { id: "week", type: "weekActivity", size: "s" },
    { id: "streak", type: "streak", size: "s" },
    { id: "next", type: "nextWorkout", size: "m" },
    { id: "recent", type: "recentWorkouts", size: "l" },
    { id: "progress", type: "exerciseProgress", size: "l" },
    { id: "weight", type: "bodyWeight", size: "s" },
    { id: "total", type: "totalWorkouts", size: "s" },
    { id: "consistency", type: "consistency", size: "m" },
  ],
};

function isWidgetType(value: unknown): value is WidgetType {
  return (
    typeof value === "string" &&
    (WIDGET_TYPES as readonly string[]).includes(value)
  );
}

/** Validate a stored layout. Unknown widgets are dropped and unsupported
 *  sizes fall back to the default, so old or foreign data never breaks the
 *  home screen. Null means "use the default". */
export function normalizeLayout(value: unknown): HomeLayout | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as { widgets?: unknown }).widgets;
  if (!Array.isArray(raw)) return null;

  const seenIds = new Set<string>();
  const seenTypes = new Set<WidgetType>();
  const widgets: HomeWidget[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { id, type, size, config } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id || seenIds.has(id)) continue;
    if (!isWidgetType(type)) continue;
    const definition = WIDGETS[type];
    if (!definition.multiple && seenTypes.has(type)) continue;
    seenIds.add(id);
    seenTypes.add(type);
    widgets.push({
      id,
      type,
      size: definition.sizes.includes(size as WidgetSize)
        ? (size as WidgetSize)
        : definition.sizes[0],
      ...(config && typeof config === "object"
        ? { config: config as WidgetConfig }
        : {}),
    });
  }
  return { version: 1, widgets };
}

export function newWidgetId(type: WidgetType): string {
  return `${type}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** How many grid columns each layout mode offers. A widget keeps the same
 *  proportions in both: "s" is a quarter of the row on desktop instead of a
 *  half, so two phone rows sit side by side. */
export const GRID_COLUMNS = { mobile: 2, desktop: 4 } as const;
export type GridColumns = (typeof GRID_COLUMNS)[keyof typeof GRID_COLUMNS];

export interface PlacedWidget {
  widget: HomeWidget;
  /** Grid columns occupied (>= the size's natural width when stretched). */
  columns: number;
  rows: 1 | 2;
  /** Widened beyond its natural width to close a gap at the end of a row. */
  stretched: boolean;
}

/** Natural width of a size, in grid columns. */
function naturalColumns(size: WidgetSize): number {
  return size === "s" ? 1 : 2;
}

/**
 * Give every widget its natural span for a `columns`-wide grid, in the
 * author's order.
 *
 * Gaps are closed by CSS (`grid-auto-flow: row dense`), which pulls a later
 * tile up into a hole it fits — the same dense packing the phone grid always
 * did when a small tile paired with a later small one. Doing it in CSS rather
 * than here is what lets one DOM order drive both the two- and the
 * four-column grid: a JavaScript packer would have to reorder the tiles
 * differently for each, and there is only one DOM.
 *
 * Widening a tile to fill a leftover gap was dropped with it: on the phone it
 * was a subtle half-to-full nudge, but on four columns it ballooned a
 * two-column widget to the whole row and left it looking empty.
 */
export function packLayout(
  widgets: HomeWidget[],
  columns: number = GRID_COLUMNS.mobile,
): PlacedWidget[] {
  return widgets.map((widget) => ({
    widget,
    columns: Math.min(naturalColumns(widget.size), columns),
    rows: widget.size === "l" ? 2 : 1,
    stretched: false,
  }));
}
