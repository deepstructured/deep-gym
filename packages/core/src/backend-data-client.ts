/** Transitional client façade. Only fixed domain operations cross the network;
 * no SQL, table names, or PostgREST expressions are accepted by the API. */
export interface BackendReply {
  data: unknown;
  error: { code: string; message: string } | null;
  count?: number | null;
}
export type BackendRequest = (operation: string, input: Record<string, unknown>, signal?: AbortSignal) => Promise<BackendReply>;
type Filter = { method: string; column: string; value: unknown };
type RecordValue = Record<string, unknown>;
const unsupported = () => { throw new Error("This query is not supported by the PostgreSQL API"); };

class DataQuery implements PromiseLike<BackendReply> {
  private selection = "*";
  private mode = "select";
  private value: RecordValue = {};
  private filters: Filter[] = [];
  private page: RecordValue = {};
  private signal?: AbortSignal;
  private singleton: "single" | "maybeSingle" | undefined;
  private head = false;
  private result?: Promise<BackendReply>;
  constructor(private request: BackendRequest, private table: string, private getUserId?: () => string | null,
    private rpcCall?: { name: string; args: RecordValue }) {}
  select(selection = "*", options?: { count?: string; head?: boolean }) {
    this.selection = selection; this.page.count = options?.count === "exact"; this.head = options?.head ?? false; return this;
  }
  insert(value: RecordValue) { this.mode = "insert"; this.value = value; return this; }
  update(value: RecordValue) { this.mode = "update"; this.value = value; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(column: string, value: unknown) { this.filters.push({ method: "eq", column, value }); return this; }
  in(column: string, value: unknown[]) { this.filters.push({ method: "in", column, value }); return this; }
  gte(column: string, value: unknown) { this.filters.push({ method: "gte", column, value }); return this; }
  lte(column: string, value: unknown) { this.filters.push({ method: "lte", column, value }); return this; }
  lt(column: string, value: unknown) { this.filters.push({ method: "lt", column, value }); return this; }
  or(value: string) { this.filters.push({ method: "or", column: "", value }); return this; }
  order(column: string, options?: { ascending?: boolean }) {
    // Each endpoint defines a stable order before applying pagination. Reject a
    // new ordering requirement until implemented at both ends.
    const allowed: Record<string, string[]> = {
      workouts: ["date", "created_at", "id"], exercises: ["name", "id"], muscle_groups: ["sort_order", "name", "id"],
      workout_exercises: ["id"], sets: ["id"], workout_templates: ["updated_at", "name", "id"],
      workout_template_exercises: ["position", "id"], body_weight_measurements: ["measured_at", "created_at", "id"],
    };
    if (!allowed[this.table]?.includes(column)) unsupported();
    const descending = this.table === "workouts" || this.table === "body_weight_measurements" || (this.table === "workout_templates" && column === "updated_at");
    if ((options?.ascending ?? true) === descending) unsupported();
    return this;
  }
  range(from: number, to: number) { this.page.offset = from; this.page.limit = to - from + 1; return this; }
  limit(limit: number) { this.page.limit = limit; return this; }
  single() { this.singleton = "single"; return this; }
  maybeSingle() { this.singleton = "maybeSingle"; return this; }
  abortSignal(signal: AbortSignal) { this.signal = signal; return this; }
  then<TResult1 = BackendReply, TResult2 = never>(
    onfulfilled?: ((value: BackendReply) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    this.result ??= this.execute();
    return this.result.then(onfulfilled, onrejected);
  }
  private async execute(): Promise<BackendReply> {
    try {
      this.signal?.throwIfAborted();
      const { operation, input } = this.plan();
      const reply = await this.request(operation, input, this.signal);
      if (reply.error) return reply;
      let data = reply.data;
      if (this.head) data = null;
      else if (this.singleton) {
        const values = Array.isArray(data) ? data : data == null ? [] : [data];
        if (values.length > 1 || (!values.length && this.singleton === "single")) {
          return { data: null, error: { code: "PGRST116", message: "Expected one record" }, count: reply.count };
        }
        data = values[0] ?? null;
      }
      return { ...reply, data };
    } catch (error) {
      if (this.signal?.aborted) throw error;
      return { data: null, error: { code: "CLIENT_REQUEST_FAILED", message: error instanceof Error ? error.message : "Request failed" } };
    }
  }
  private plan(): { operation: string; input: RecordValue } {
    if (this.rpcCall) return this.rpcPlan(this.rpcCall.name, this.rpcCall.args);
    const remaining = [...this.filters];
    const take = (column: string, method = "eq") => {
      const index = remaining.findIndex(f => f.column === column && f.method === method);
      return index === -1 ? undefined : remaining.splice(index, 1)[0].value;
    };
    // Owners never become authority on the server. Detect stale client identity
    // early when available; RLS always uses the server-verified session UUID.
    const owner = take("user_id") ?? take("workout_exercise.workout.user_id");
    if (owner != null && this.getUserId && owner !== this.getUserId()) throw new Error("Session identity changed; retry after signing in");
    const value = { ...this.value };
    if ("user_id" in value) {
      if (this.getUserId && value.user_id !== this.getUserId()) throw new Error("Session identity changed; retry after signing in");
      delete value.user_id;
    }
    const id = take("id");
    if (id !== undefined && !["profiles", "workouts", "exercises", "muscle_groups", "workout_templates"].includes(this.table)) unsupported();
    let operation = "";
    let input: RecordValue = {};
    const assign = (key: string, value: unknown) => { if (value !== undefined) input[key] = value; };
    switch (this.table) {
      case "profiles":
        if (id != null && this.getUserId && id !== this.getUserId()) throw new Error("Session identity changed; retry after signing in");
        operation = this.mode === "select" ? "profile.get" : this.mode === "update" ? "profile.update" : unsupported();
        if (this.mode === "update") input.patch = value;
        break;
      case "workouts":
        if (this.mode === "delete") { operation = "workouts.delete"; input.id = id; break; }
        if (this.mode !== "select") unsupported();
        if (id != null) { operation = "workouts.detail"; input.id = id; break; }
        operation = this.head ? "workouts.count" : this.selection.includes("workout_exercises(count)") ? "workouts.summaries" :
          this.selection.includes("sets") ? "workouts.list" : "workouts.headers";
        input = { ...this.page };
        assign("from", take("date", "gte")); assign("to", take("date", "lte")); assign("beforeDate", take("date", "lt"));
        assign("type", take("type")); assign("ids", take("id", "in")); assign("exerciseId", take("workout_exercises.exercise_id"));
        break;
      case "workout_exercises":
        if (this.mode !== "select") unsupported();
        operation = this.head ? "exercises.usageCount" : "workouts.exercises";
        input = this.head ? { id: take("exercise_id") } : { ...this.page };
        if (!this.head) { assign("workoutIds", take("workout_id", "in")); assign("exerciseId", take("exercise_id")); }
        break;
      case "sets":
        if (this.mode !== "select") unsupported();
        operation = "workouts.sets"; input = { ...this.page };
        assign("occurrenceIds", take("workout_exercise_id", "in")); assign("exerciseId", take("workout_exercise.exercise_id"));
        assign("workoutId", take("workout_exercise.workout_id")); break;
      case "exercises":
        if (this.mode === "select") {
          operation = id == null ? "exercises.list" : "exercises.detail";
          input = id == null ? { ...this.page } : { id }; assign("ids", take("id", "in"));
        } else if (this.mode === "insert") { operation = "exercises.create"; input = { input: value }; }
        else if (this.mode === "update") { operation = "exercises.update"; input = { id, patch: value }; }
        else if (this.mode === "delete") { operation = "exercises.delete"; input = { id }; }
        break;
      case "muscle_groups": {
        const or = take("", "or");
        if (or != null && (!this.getUserId || or !== `user_id.is.null,user_id.eq.${this.getUserId()}`)) unsupported();
        if (this.mode === "select") { operation = "groups.list"; input = { ...this.page }; }
        else if (this.mode === "insert") { operation = "groups.create"; input = { name: value.name }; }
        else if (this.mode === "delete") { operation = "groups.delete"; input = { id }; }
        break;
      }
      case "workout_templates":
        if (this.mode === "select") {
          operation = id == null ? "templates.list" : "templates.detail";
          input = id == null ? { ...this.page } : { id };
        } else if (this.mode === "delete") { operation = "templates.delete"; input = { id }; }
        break;
      case "workout_template_exercises":
        if (this.mode !== "select") unsupported();
        operation = "templates.exercises"; input = { ...this.page, id: take("template_id") }; break;
      case "body_weight_measurements":
        if (this.mode !== "select") unsupported();
        operation = "bodyWeight.list"; input = { ...this.page };
        assign("from", take("measured_at", "gte")); assign("to", take("measured_at", "lte")); break;
      case "workout_drafts":
        if (this.mode !== "select") unsupported();
        operation = "drafts.get"; break;
      default: unsupported();
    }
    if (!operation || remaining.length) unsupported();
    return { operation, input };
  }
  private rpcPlan(name: string, args: RecordValue) {
    switch (name) {
      case "save_workout_atomic": return { operation: "workouts.save", input: { input: args.p_input, id: args.p_workout_id, createKey: args.p_create_key } };
      case "home_dashboard_summary": return { operation: "workouts.homeSummary", input: { today: args.p_today, recordsSince: args.p_records_since, muscleSince: args.p_muscle_since } };
      case "save_workout_draft": return { operation: "drafts.save", input: { draft: args.p_draft, updatedAt: args.p_updated_at, ownerId: args.p_owner_id } };
      case "log_body_weight": return { operation: "bodyWeight.log", input: { weightKg: args.p_weight_kg, measuredAt: args.p_measured_at, source: args.p_source } };
      case "create_workout_template": return { operation: "templates.create", input: { input: { name: args.p_name, type: args.p_type, exerciseIds: args.p_exercise_ids } } };
      case "update_workout_template": return { operation: "templates.update", input: { id: args.p_template_id, input: { name: args.p_name, type: args.p_type, exerciseIds: args.p_exercise_ids } } };
      default: return unsupported();
    }
  }
}

export function createBackendDataClient(request: BackendRequest, getUserId?: () => string | null) {
  return {
    from: (table: string) => new DataQuery(request, table, getUserId),
    rpc: (name: string, args: RecordValue = {}) => new DataQuery(request, "", getUserId, { name, args }),
  };
}
