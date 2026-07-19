/**
 * Seeds a demo account (demo@deepgym.app) with ~8 weeks of realistic
 * training data. Used for screenshots and local testing — safe to re-run,
 * it wipes and re-creates the demo user's data every time.
 *
 * Usage: node scripts/seed-demo.mjs
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z_]+)=(.*)$/);
  if (match && !process.env[match[1]]) {
    process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const EMAIL = "demo@deepgym.app";
const CURRENT_ONBOARDING_VERSION = 1;
const CURRENT_RELEASE_SEQUENCE = 2;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ── demo user ────────────────────────────────────────────────────────────
async function getOrCreateUser() {
  const { data: created, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    email_confirm: true,
    user_metadata: { full_name: "Alex Demo" },
  });
  if (!error) return created.user.id;

  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = data?.users.find((u) => u.email === EMAIL);
  if (!existing) throw new Error(`createUser failed: ${error.message}`);
  return existing.id;
}

const userId = await getOrCreateUser();
console.log(`demo user: ${EMAIL} (${userId})`);

// The demo account opts into the same Mon / Wed / Fri plan generated below.
// Real profiles keep training_schedule = NULL until the user configures it.
const { error: scheduleError } = await admin
  .from("profiles")
  .update({
    training_schedule: [
      "Upper",
      null,
      "Lower",
      null,
      "Split Chest",
      null,
      null,
    ],
    onboarding_version: CURRENT_ONBOARDING_VERSION,
    onboarding_completed_at: new Date().toISOString(),
    last_seen_release_version: CURRENT_RELEASE_SEQUENCE,
  })
  .eq("id", userId);
if (scheduleError) throw scheduleError;

// ── wipe previous demo data ──────────────────────────────────────────────
await admin.from("workouts").delete().eq("user_id", userId);
await admin.from("exercises").delete().eq("user_id", userId);

// ── muscle groups ────────────────────────────────────────────────────────
const { data: groups, error: groupsError } = await admin
  .from("muscle_groups")
  .select("id, name")
  .is("user_id", null);
if (groupsError) throw groupsError;
const groupId = (name) => {
  const group = groups.find((g) => g.name === name);
  if (!group) throw new Error(`Missing default muscle group: ${name}`);
  return group.id;
};

// ── exercise catalog ─────────────────────────────────────────────────────
// base = working weight (kg) 8 weeks ago, step = progression per 2 weeks
const catalog = [
  { name: "Chest Press",           group: "Chest",     equipment: "machine",     base: 45,   step: 2.5, reps: 10, settings: "Seat height 4 · handles at mid-chest · back pad 2" },
  { name: "Incline Dumbbell Press", group: "Chest",    equipment: "dumbbell",    base: 20,   step: 1.25, reps: 10 },
  { name: "Lat Pulldown",          group: "Back",      equipment: "crossover",   base: 50,   step: 2.5, reps: 10 },
  { name: "Seated Row",            group: "Back",      equipment: "machine",     base: 55,   step: 2.5, reps: 10, settings: "Chest pad 3 · narrow grip handle" },
  { name: "Dumbbell Curl",         group: "Biceps",    equipment: "dumbbell",    base: 12,   step: 1,   reps: 12 },
  { name: "Rope Pushdown",         group: "Triceps",   equipment: "crossover",   base: 22.5, step: 2.5, reps: 12 },
  { name: "Overhead Press",        group: "Shoulders", equipment: "free_weight", base: 35,   step: 2.5, reps: 8 },
  { name: "Lateral Raises",        group: "Shoulders", equipment: "dumbbell",    base: 10,   step: 1.25, reps: 14 },
  { name: "Squat",                 group: "Legs",      equipment: "free_weight", base: 70,   step: 5,   reps: 8 },
  { name: "Leg Press",             group: "Legs",      equipment: "machine",     base: 110,  step: 5,   reps: 10, settings: "Back pad 2 · feet mid-platform, shoulder width" },
];

const WEEKS = 8;
const weightAt = (item, week) => item.base + Math.floor(week / 2) * item.step;

const { data: exercises, error: exError } = await admin
  .from("exercises")
  .insert(
    catalog.map((item) => ({
      user_id: userId,
      muscle_group_id: groupId(item.group),
      name: item.name,
      equipment: item.equipment,
      machine_settings: item.settings ?? null,
      working_weight_kg: weightAt(item, WEEKS - 1),
    })),
  )
  .select("id, name");
if (exError) throw exError;
const exerciseId = (name) => exercises.find((e) => e.name === name).id;
console.log(`created ${exercises.length} exercises`);

// ── workouts: Mon / Wed / Fri over 8 weeks ───────────────────────────────
const plan = [
  { type: "Upper",       names: ["Chest Press", "Lat Pulldown", "Overhead Press", "Dumbbell Curl"] },
  { type: "Lower",       names: ["Squat", "Leg Press"] },
  { type: "Split Chest", names: ["Chest Press", "Incline Dumbbell Press", "Rope Pushdown", "Lateral Raises"] },
];

const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const monday = new Date(now);
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // this week's Monday

let workoutCount = 0;
for (let week = 0; week < WEEKS; week++) {
  for (const [dayIndex, offset] of [0, 2, 4].entries()) {
    const date = new Date(monday);
    date.setDate(monday.getDate() - (WEEKS - 1 - week) * 7 + offset);
    if (date > now) continue;
    // an occasional missed session, keeps history human
    if (week === 2 && dayIndex === 1) continue;

    const day = plan[dayIndex];
    const { data: workout, error: wError } = await admin
      .from("workouts")
      .insert({
        user_id: userId,
        type: day.type,
        date: iso(date),
        notes:
          week === 3 && dayIndex === 0
            ? "Slept badly, kept the weights conservative today."
            : null,
      })
      .select("id")
      .single();
    if (wError) throw wError;

    for (const [position, name] of day.names.entries()) {
      const item = catalog.find((c) => c.name === name);
      const { data: we, error: weError } = await admin
        .from("workout_exercises")
        .insert({
          workout_id: workout.id,
          exercise_id: exerciseId(name),
          position,
          notes:
            week === 5 && name === "Squat"
              ? "New PR — depth felt solid."
              : null,
        })
        .select("id")
        .single();
      if (weError) throw weError;

      const weight = weightAt(item, week);
      const setCount = 3 + ((week + position) % 2);
      const sets = Array.from({ length: setCount }, (_, i) => ({
        workout_exercise_id: we.id,
        position: i,
        weight_kg: weight,
        reps: Math.max(5, item.reps - i),
        to_failure: i === setCount - 1 && (week + position) % 2 === 0,
      }));
      const { error: setsError } = await admin.from("sets").insert(sets);
      if (setsError) throw setsError;
    }
    workoutCount++;
  }
}

console.log(`created ${workoutCount} workouts across ${WEEKS} weeks`);
console.log("done ✓");
