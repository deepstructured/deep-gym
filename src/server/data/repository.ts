import type { DatabaseClient } from "../db";
import type { DataOperation, DataResult } from "./contracts";
import * as v from "./validation";

type Input = Record<string, unknown>;
const PAGE = ["offset", "limit", "count"];
const WORKOUT_FILTER = ["from", "to", "type", "beforeDate", "ids", "exerciseId", ...PAGE];
const WORKOUT_WHERE = `w.user_id=$1::uuid
  and ($2::date is null or w.date >= $2) and ($3::date is null or w.date <= $3)
  and ($4::text is null or w.type=$4) and ($5::date is null or w.date < $5)
  and ($6::uuid[] is null or w.id=any($6))
  and ($7::uuid is null or exists (select 1 from public.workout_exercises we where we.workout_id=w.id and we.exercise_id=$7))`;
const WORKOUT_ORDER = "w.date desc, w.created_at desc, w.id desc";
const FULL_WORKOUT = `to_jsonb(w) || jsonb_build_object('workout_exercises', coalesce((
  select jsonb_agg(to_jsonb(we) || jsonb_build_object(
    'exercise', to_jsonb(e), 'sets', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.position,s.id) from public.sets s where s.workout_exercise_id=we.id
    ), '[]'::jsonb)) order by we.position,we.id)
  from public.workout_exercises we join public.exercises e on e.id=we.exercise_id where we.workout_id=w.id
), '[]'::jsonb))`;
const FULL_TEMPLATE = `to_jsonb(t) || jsonb_build_object('workout_template_exercises', coalesce((
  select jsonb_agg(to_jsonb(te) || jsonb_build_object('exercise',to_jsonb(e)) order by te.position,te.id)
  from public.workout_template_exercises te join public.exercises e on e.id=te.exercise_id where te.template_id=t.id
), '[]'::jsonb))`;
const SET_RECORD = `to_jsonb(s) || jsonb_build_object('workout_exercise', jsonb_build_object(
  'exercise_id', we.exercise_id, 'notes', we.notes, 'workout_id', w.id,
  'workout', jsonb_build_object('id',w.id,'date',w.date,'created_at',w.created_at,'type',w.type,
    'body_weight_kg',w.body_weight_kg,'user_id',w.user_id)))`;

async function rows(db: DatabaseClient, sql: string, values: unknown[] = []): Promise<unknown[]> {
  const result = await db.query<{ data: unknown }>(sql, values);
  return result.rows.map((row) => row.data);
}
async function one(db: DatabaseClient, sql: string, values: unknown[] = [], optional = false): Promise<unknown> {
  const result = await rows(db, sql, values);
  if (!result.length && !optional) throw new v.DataRequestError("Record not found", "NOT_FOUND", 404);
  return result[0] ?? null;
}
async function count(db: DatabaseClient, sql: string, values: unknown[]): Promise<number> {
  const result = await db.query<{ count: string }>(sql, values);
  return Number(result.rows[0]?.count ?? 0);
}
function workoutFilters(userId: string, input: Input) {
  return [userId, input.from == null ? null : v.date(input.from), input.to == null ? null : v.date(input.to),
    input.type == null ? null : v.text(input.type, "type"), input.beforeDate == null ? null : v.date(input.beforeDate),
    input.ids == null ? null : v.uuids(input.ids), input.exerciseId == null ? null : v.uuid(input.exerciseId)];
}
async function paged(
  db: DatabaseClient, input: Input, select: string, from: string, where: string, order: string, values: unknown[],
): Promise<DataResult> {
  const page = v.page(input);
  const offsetIndex = values.length + 1;
  const data = await rows(db, `select ${select} as data ${from} where ${where} order by ${order} offset $${offsetIndex} limit $${offsetIndex + 1}`, [...values, page.offset, page.limit]);
  return { data, ...(page.count ? { count: await count(db, `select count(*) as count ${from} where ${where}`, values) } : {}) };
}

const PROFILE_COLUMNS = ["display_name", "unit", "bar_weight_kg", "plates_kg", "plates_lb", "language", "avatar_url", "training_schedule", "home_widgets", "onboarding_version", "onboarding_completed_at", "last_seen_release_version"] as const;
function profilePatch(value: unknown): Input {
  const patch = v.object(value, "profile patch");
  v.fields(patch, PROFILE_COLUMNS);
  const result: Input = {};
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case "display_name": result[key] = v.nullableText(value, key, 100); break;
      case "unit": result[key] = v.choice(value, ["kg", "lb"], key); break;
      case "language": result[key] = value == null ? null : v.choice(value, ["en", "ru", "uk"], key); break;
      case "bar_weight_kg": result[key] = v.number(value, key, 0, 1000); break;
      case "plates_kg": case "plates_lb":
        if (!Array.isArray(value) || value.length > 50) throw new v.DataRequestError("Invalid plates");
        result[key] = value.map((plate) => v.number(plate, key, 0.01, 1000)); break;
      case "avatar_url": {
        const url = v.nullableText(value, key, 2048);
        if (url && !(url.startsWith("/") && !url.startsWith("//")) && !/^https?:\/\//i.test(url)) throw new v.DataRequestError("Invalid avatar URL");
        result[key] = url; break;
      }
      case "training_schedule":
        if (value === null) { result[key] = null; break; }
        if (!Array.isArray(value) || value.length !== 7) throw new v.DataRequestError("Invalid training schedule");
        result[key] = value.map((item) => v.nullableText(item, "training type", 200)); break;
      case "home_widgets":
        if (value != null) v.object(value, "home widgets");
        if (JSON.stringify(value ?? null).length > 32000) throw new v.DataRequestError("Home layout is too large");
        result[key] = value ?? null; break;
      case "onboarding_completed_at": result[key] = value == null ? null : v.timestamp(value); break;
      default: result[key] = v.integer(value, key);
    }
  }
  return result;
}
const EXERCISE_COLUMNS = ["name", "muscle_group_id", "equipment", "machine_settings", "working_weight_kg", "unit"] as const;
function exercisePatch(value: unknown, creating = false): Input {
  const patch = v.object(value, "exercise input");
  v.fields(patch, EXERCISE_COLUMNS);
  const result: Input = {};
  for (const [key, value] of Object.entries(patch)) {
    switch (key) {
      case "name": result[key] = v.text(value, key); break;
      case "muscle_group_id": result[key] = v.uuid(value); break;
      case "equipment": result[key] = v.choice(value, ["free_weight", "dumbbell", "machine", "crossover", "bodyweight"], key); break;
      case "machine_settings": result[key] = v.nullableText(value, key); break;
      case "working_weight_kg": result[key] = value == null ? null : v.number(value, key); break;
      case "unit": result[key] = value == null ? null : v.choice(value, ["kg", "lb"], key); break;
    }
  }
  if (creating && (!result.name || !result.muscle_group_id)) throw new v.DataRequestError("Name and muscle group are required");
  if (result.equipment === "bodyweight") result.working_weight_kg = null;
  return result;
}

/** Identifiers are chosen from the two constant allowlists above, never from
 * unchecked request text. Values always remain bound parameters. */
async function update(db: DatabaseClient, table: "profiles" | "exercises", id: string, userId: string, patch: Input) {
  const keys = Object.keys(patch);
  const owner = table === "profiles" ? "id" : "user_id";
  if (!keys.length) return one(db, `select to_jsonb(t) as data from public.${table} t where id=$1::uuid and ${owner}=$2::uuid`, [id, userId]);
  const allowed: readonly string[] = table === "profiles" ? PROFILE_COLUMNS : EXERCISE_COLUMNS;
  if (keys.some((key) => !allowed.includes(key))) throw new v.DataRequestError("Unsupported field");
  return one(db, `update public.${table} as t set ${keys.map((key, index) => `"${key}"=$${index + 3}`).join(",")}
    where id=$1::uuid and ${owner}=$2::uuid returning to_jsonb(t) as data`, [id, userId, ...keys.map((key) => patch[key])]);
}
function workoutInput(value: unknown): Input {
  const input = v.object(value, "workout input");
  v.fields(input, ["type", "date", "notes", "body_weight_kg", "exercises"]);
  if (!Array.isArray(input.exercises) || !input.exercises.length || input.exercises.length > 100) throw new v.DataRequestError("Invalid workout exercises");
  const exercises = input.exercises.map((value) => {
    const exercise = v.object(value, "workout exercise");
    v.fields(exercise, ["exercise_id", "load_mode", "notes", "sets"]);
    if (!Array.isArray(exercise.sets) || exercise.sets.length > 200) throw new v.DataRequestError("Invalid workout sets");
    return {
      exercise_id: v.uuid(exercise.exercise_id), load_mode: v.choice(exercise.load_mode, ["external", "bodyweight"], "load mode"),
      notes: v.nullableText(exercise.notes, "notes"),
      sets: exercise.sets.map((value) => {
        const set = v.object(value, "set");
        v.fields(set, ["weight_kg", "reps", "to_failure", "set_type"]);
        const setType = v.choice(set.set_type ?? "working", ["working", "warmup"], "set type");
        if (set.to_failure != null && typeof set.to_failure !== "boolean") throw new v.DataRequestError("Invalid failure flag");
        return { weight_kg: set.weight_kg == null ? null : v.number(set.weight_kg, "weight"),
          reps: set.reps == null ? null : v.integer(set.reps, "reps", 0, 100000),
          to_failure: setType === "warmup" ? false : (set.to_failure ?? false), set_type: setType };
      }),
    };
  });
  return { type: v.text(input.type, "workout type"), date: v.date(input.date), notes: v.nullableText(input.notes, "notes"),
    ...("body_weight_kg" in input ? { body_weight_kg: input.body_weight_kg == null ? null : v.number(input.body_weight_kg, "body weight", 0.01, 1000) } : {}), exercises };
}
function templateInput(value: unknown) {
  const input = v.object(value, "template input");
  v.fields(input, ["name", "type", "exerciseIds"]);
  const ids = v.uuids(input.exerciseIds, "exercise IDs", 100);
  if (!ids.length) throw new v.DataRequestError("At least one exercise is required");
  return [v.text(input.name, "template name"), v.text(input.type, "template type"), ids];
}

/** Every operation has fixed SQL, explicit owner filtering, and the database's
 * independent RLS check. The caller supplies only a verified session identity. */
export async function executeDataOperation(db: DatabaseClient, userId: string, operation: DataOperation, input: Input = {}): Promise<DataResult> {
  switch (operation) {
    case "profile.get":
      v.fields(input, []);
      return { data: await one(db, "select to_jsonb(p) as data from public.profiles p where id=$1::uuid", [userId], true) };
    case "profile.update":
      v.fields(input, ["patch"]);
      return { data: await update(db, "profiles", userId, userId, profilePatch(input.patch)) };
    case "workouts.list": case "workouts.headers": case "workouts.summaries": {
      v.fields(input, WORKOUT_FILTER);
      const select = operation === "workouts.list" ? FULL_WORKOUT : operation === "workouts.headers" ? "to_jsonb(w)" :
        `jsonb_build_object('id',w.id,'date',w.date,'type',w.type,'exerciseCount',(select count(*) from public.workout_exercises where workout_id=w.id),
          'workout_exercises',jsonb_build_array(jsonb_build_object('count',(select count(*) from public.workout_exercises where workout_id=w.id))))`;
      return paged(db, input, select, "from public.workouts w", WORKOUT_WHERE, WORKOUT_ORDER, workoutFilters(userId, input));
    }
    case "workouts.count": {
      v.fields(input, WORKOUT_FILTER);
      const total = await count(db, `select count(*) as count from public.workouts w where ${WORKOUT_WHERE}`, workoutFilters(userId, input));
      return { data: total, count: total };
    }
    case "workouts.detail":
      v.fields(input, ["id"]);
      return { data: await one(db, `select ${FULL_WORKOUT} as data from public.workouts w where w.id=$1::uuid and w.user_id=$2::uuid`, [v.uuid(input.id), userId]) };
    case "workouts.exercises": {
      v.fields(input, ["workoutIds", "exerciseId", ...PAGE]);
      return paged(db, input, "to_jsonb(we) || jsonb_build_object('exercise',to_jsonb(e))",
        "from public.workout_exercises we join public.workouts w on w.id=we.workout_id join public.exercises e on e.id=we.exercise_id",
        "w.user_id=$1::uuid and ($2::uuid[] is null or we.workout_id=any($2)) and ($3::uuid is null or we.exercise_id=$3)", "we.id",
        [userId, input.workoutIds == null ? null : v.uuids(input.workoutIds), input.exerciseId == null ? null : v.uuid(input.exerciseId)]);
    }
    case "workouts.sets": {
      v.fields(input, ["occurrenceIds", "exerciseId", "workoutId", ...PAGE]);
      return paged(db, input, SET_RECORD,
        "from public.sets s join public.workout_exercises we on we.id=s.workout_exercise_id join public.workouts w on w.id=we.workout_id",
        "w.user_id=$1::uuid and ($2::uuid[] is null or we.id=any($2)) and ($3::uuid is null or we.exercise_id=$3) and ($4::uuid is null or w.id=$4)", "s.id",
        [userId, input.occurrenceIds == null ? null : v.uuids(input.occurrenceIds), input.exerciseId == null ? null : v.uuid(input.exerciseId), input.workoutId == null ? null : v.uuid(input.workoutId)]);
    }
    case "workouts.homeSummary":
      v.fields(input, ["today", "recordsSince", "muscleSince"]);
      return { data: await one(db, "select public.home_dashboard_summary($1::date,$2::date,$3::date) as data",
        [v.date(input.today), v.date(input.recordsSince), v.date(input.muscleSince)]) };
    case "workouts.save": {
      v.fields(input, ["input", "id", "createKey"]);
      const id = input.id == null ? null : v.uuid(input.id);
      const createKey = input.createKey == null ? null : v.uuid(input.createKey, "create key");
      if ((!id && !createKey) || (id && createKey)) throw new v.DataRequestError("Invalid create key");
      return { data: await one(db, "select public.save_workout_atomic($1::jsonb,$2::uuid,$3::uuid) as data", [JSON.stringify(workoutInput(input.input)), id, createKey]) };
    }
    case "workouts.delete":
      v.fields(input, ["id"]);
      await db.query("delete from public.workouts where id=$1::uuid and user_id=$2::uuid", [v.uuid(input.id), userId]);
      return { data: null };
    case "workouts.lastOfType": {
      v.fields(input, ["type", "beforeDate", "preferWeekdayOf"]);
      return { data: await one(db, `select ${FULL_WORKOUT} as data from public.workouts w where w.user_id=$1::uuid and w.type=$2 and w.date<$3::date
        order by case when $4::date is not null and extract(dow from w.date)=extract(dow from $4::date) then 0 else 1 end, ${WORKOUT_ORDER} limit 1`,
        [userId, v.text(input.type, "type"), v.date(input.beforeDate), input.preferWeekdayOf == null ? null : v.date(input.preferWeekdayOf)], true) };
    }
    case "workouts.exerciseHistory": {
      v.fields(input, ["exerciseId", "from", "to"]);
      return { data: await rows(db, `select jsonb_build_object('weight_kg',s.weight_kg,'body_weight_kg',w.body_weight_kg,'reps',s.reps,
        'to_failure',s.to_failure,'set_type',s.set_type,'position',s.position,'workoutId',w.id,'workoutDate',w.date,'workoutType',w.type,'exerciseNotes',we.notes) as data
        from public.sets s join public.workout_exercises we on we.id=s.workout_exercise_id join public.workouts w on w.id=we.workout_id
        where w.user_id=$1::uuid and we.exercise_id=$2::uuid and ($3::date is null or w.date>=$3) and ($4::date is null or w.date<=$4)
        order by w.date,w.created_at,w.id,we.position,s.position,s.id`,
        [userId, v.uuid(input.exerciseId), input.from == null ? null : v.date(input.from), input.to == null ? null : v.date(input.to)]) };
    }
    case "workouts.previousSets": {
      v.fields(input, ["exerciseIds", "beforeDate"]);
      return { data: await rows(db, `with chosen as (
        select distinct on (we.exercise_id) we.exercise_id,w.id from public.workouts w join public.workout_exercises we on we.workout_id=w.id
        where w.user_id=$1::uuid and we.exercise_id=any($2::uuid[]) and w.date<$3::date
        order by we.exercise_id,w.date desc,w.created_at desc,w.id desc)
        select ${SET_RECORD} || jsonb_build_object('exercise_id',we.exercise_id) as data from chosen c
        join public.workouts w on w.id=c.id join public.workout_exercises we on we.workout_id=w.id and we.exercise_id=c.exercise_id
        join public.sets s on s.workout_exercise_id=we.id order by we.exercise_id,we.position,s.position,s.id`,
        [userId, v.uuids(input.exerciseIds, "exercise IDs", 100), v.date(input.beforeDate)]) };
    }
    case "exercises.list":
      v.fields(input, ["ids", ...PAGE]);
      return paged(db, input, "to_jsonb(e)", "from public.exercises e", "e.user_id=$1::uuid and ($2::uuid[] is null or e.id=any($2))", "e.name,e.id", [userId, input.ids == null ? null : v.uuids(input.ids)]);
    case "exercises.detail":
      v.fields(input, ["id"]);
      return { data: await one(db, "select to_jsonb(e) as data from public.exercises e where e.id=$1::uuid and e.user_id=$2::uuid", [v.uuid(input.id), userId]) };
    case "exercises.create": {
      v.fields(input, ["input"]);
      const value = exercisePatch(input.input, true);
      // RLS for shared muscle groups allows defaults; reject an invisible FK.
      await one(db, "select to_jsonb(g) as data from public.muscle_groups g where id=$1::uuid and (user_id is null or user_id=$2::uuid)", [value.muscle_group_id, userId]);
      return { data: await one(db, `insert into public.exercises as e(user_id,name,muscle_group_id,equipment,machine_settings,working_weight_kg,unit)
        values($1::uuid,$2,$3::uuid,$4,$5,$6,$7) returning to_jsonb(e) as data`,
        [userId,value.name,value.muscle_group_id,value.equipment ?? "free_weight",value.machine_settings ?? null,value.working_weight_kg ?? null,value.unit ?? null]) };
    }
    case "exercises.update": {
      v.fields(input, ["id", "patch"]);
      const patch = exercisePatch(input.patch);
      if (patch.muscle_group_id) await one(db, "select to_jsonb(g) as data from public.muscle_groups g where id=$1::uuid and (user_id is null or user_id=$2::uuid)", [patch.muscle_group_id, userId]);
      return { data: await update(db, "exercises", v.uuid(input.id), userId, patch) };
    }
    case "exercises.delete":
      v.fields(input, ["id"]);
      await db.query("delete from public.exercises where id=$1::uuid and user_id=$2::uuid", [v.uuid(input.id), userId]);
      return { data: null };
    case "exercises.usageCount": {
      v.fields(input, ["id"]);
      const total = await count(db, "select count(*) as count from public.workout_exercises we join public.workouts w on w.id=we.workout_id where we.exercise_id=$1::uuid and w.user_id=$2::uuid", [v.uuid(input.id), userId]);
      return { data: total, count: total };
    }
    case "groups.list":
      v.fields(input, PAGE);
      return paged(db, input, "to_jsonb(g)", "from public.muscle_groups g", "g.user_id is null or g.user_id=$1::uuid", "g.sort_order,g.name,g.id", [userId]);
    case "groups.create":
      v.fields(input, ["name"]);
      return { data: await one(db, "insert into public.muscle_groups as g(user_id,name) values($1::uuid,$2) returning to_jsonb(g) as data", [userId,v.text(input.name, "muscle group")]) };
    case "groups.delete":
      v.fields(input, ["id"]);
      await db.query("delete from public.muscle_groups where id=$1::uuid and user_id=$2::uuid", [v.uuid(input.id),userId]);
      return { data: null };
    case "templates.list":
      v.fields(input, PAGE);
      return paged(db, input, `to_jsonb(t) || jsonb_build_object('exerciseCount',(select count(*) from public.workout_template_exercises where template_id=t.id),
        'workout_template_exercises',jsonb_build_array(jsonb_build_object('count',(select count(*) from public.workout_template_exercises where template_id=t.id))))`,
        "from public.workout_templates t", "t.user_id=$1::uuid", "t.updated_at desc,t.name,t.id", [userId]);
    case "templates.detail":
      v.fields(input, ["id"]);
      return { data: await one(db, `select ${FULL_TEMPLATE} as data from public.workout_templates t where t.id=$1::uuid and t.user_id=$2::uuid`, [v.uuid(input.id),userId]) };
    case "templates.exercises":
      v.fields(input, ["id", ...PAGE]);
      return paged(db, input, "to_jsonb(te) || jsonb_build_object('exercise',to_jsonb(e))",
        "from public.workout_template_exercises te join public.workout_templates t on t.id=te.template_id join public.exercises e on e.id=te.exercise_id",
        "t.id=$1::uuid and t.user_id=$2::uuid", "te.position,te.id", [v.uuid(input.id),userId]);
    case "templates.create":
      v.fields(input, ["input"]);
      return { data: await one(db, "select public.create_workout_template($1::text,$2::text,$3::uuid[]) as data", templateInput(input.input)) };
    case "templates.update":
      v.fields(input, ["id", "input"]);
      return { data: await one(db, "select public.update_workout_template($1::uuid,$2::text,$3::text,$4::uuid[]) as data", [v.uuid(input.id), ...templateInput(input.input)]) };
    case "templates.delete":
      v.fields(input, ["id"]);
      await db.query("delete from public.workout_templates where id=$1::uuid and user_id=$2::uuid", [v.uuid(input.id),userId]);
      return { data: null };
    case "bodyWeight.list":
      v.fields(input, ["from", "to", ...PAGE]);
      return paged(db, input, "to_jsonb(b)", "from public.body_weight_measurements b",
        "b.user_id=$1::uuid and ($2::timestamptz is null or b.measured_at>=$2) and ($3::timestamptz is null or b.measured_at<=$3)",
        "b.measured_at desc,b.created_at desc,b.id desc", [userId,input.from == null ? null : v.timestamp(input.from),input.to == null ? null : v.timestamp(input.to)]);
    case "bodyWeight.log":
      v.fields(input, ["weightKg", "measuredAt", "source"]);
      return { data: await one(db, "select to_jsonb(public.log_body_weight($1::numeric,coalesce($2::timestamptz,now()),$3::text)) as data",
        [v.number(input.weightKg, "body weight", 0.01, 1000),input.measuredAt == null ? null : v.timestamp(input.measuredAt),v.choice(input.source ?? "settings",["settings","workout"],"source")]) };
    case "drafts.get":
      v.fields(input, []);
      return { data: await one(db, "select to_jsonb(d) as data from public.workout_drafts d where user_id=$1::uuid", [userId], true) };
    case "drafts.save": {
      v.fields(input, ["draft", "updatedAt", "ownerId"]);
      if (input.ownerId != null && v.uuid(input.ownerId) !== userId) throw new v.DataRequestError("Draft owner does not match session", "FORBIDDEN", 403);
      const draft = v.object(input.draft, "draft");
      return { data: await rows(db, "select to_jsonb(d) as data from public.save_workout_draft($1::uuid,$2::jsonb,$3::timestamptz) d", [userId,JSON.stringify(draft),v.timestamp(input.updatedAt)]) };
    }
  }
}
