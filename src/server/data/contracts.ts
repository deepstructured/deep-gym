/** Fixed application operations; this API never accepts SQL, table names,
 * PostgREST expressions, arbitrary field selections or client auth claims. */
export const DATA_OPERATIONS = [
  "profile.get", "profile.update",
  "workouts.list", "workouts.headers", "workouts.count", "workouts.detail", "workouts.summaries",
  "workouts.exercises", "workouts.sets", "workouts.homeSummary", "workouts.save", "workouts.delete",
  "workouts.exerciseHistory", "workouts.previousSets", "workouts.lastOfType",
  "exercises.list", "exercises.detail", "exercises.create", "exercises.update", "exercises.delete", "exercises.usageCount",
  "groups.list", "groups.create", "groups.delete",
  "templates.list", "templates.detail", "templates.exercises", "templates.create", "templates.update", "templates.delete",
  "bodyWeight.list", "bodyWeight.log", "drafts.get", "drafts.save",
] as const;
export type DataOperation = typeof DATA_OPERATIONS[number];
export interface DataRequest { operation: DataOperation; input?: Record<string, unknown> }
export interface DataResult { data: unknown; count?: number }
export interface DataFailure { error: { code: string; message: string }; data: null }
const WRITES = new Set<DataOperation>([
  "profile.update", "workouts.save", "workouts.delete", "exercises.create", "exercises.update", "exercises.delete",
  "groups.create", "groups.delete", "templates.create", "templates.update", "templates.delete", "bodyWeight.log", "drafts.save",
]);
export const isDataMutation = (operation: DataOperation) => WRITES.has(operation);
