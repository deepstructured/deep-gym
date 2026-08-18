-- DeepGym — body-weight tracking and bodyweight exercise foundation.
-- Run this in the Supabase SQL Editor after 0005_workout_drafts.sql.

-- The profile fields are a denormalized cache of the newest immutable
-- measurement. The history table below remains the source of truth.
alter table public.profiles
  add column if not exists body_weight_kg numeric,
  add column if not exists body_weight_measured_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_body_weight_positive'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_body_weight_positive
      check (body_weight_kg is null or body_weight_kg > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_body_weight_cache_complete'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_body_weight_cache_complete
      check (
        (body_weight_kg is null and body_weight_measured_at is null)
        or (body_weight_kg is not null and body_weight_measured_at is not null)
      );
  end if;
end
$$;

comment on column public.profiles.body_weight_kg is
  'Cached newest body-weight measurement, always stored in kilograms.';
comment on column public.profiles.body_weight_measured_at is
  'Measurement timestamp corresponding to cached body_weight_kg.';

create table public.body_weight_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0),
  measured_at timestamptz not null default now(),
  source text not null default 'settings'
    check (source in ('settings', 'workout')),
  created_at timestamptz not null default now()
);

create index body_weight_measurements_user_measured_idx
  on public.body_weight_measurements (user_id, measured_at desc, created_at desc);

alter table public.body_weight_measurements enable row level security;

-- Measurements are append-only through the client API. This keeps the
-- profile cache coherent without a privileged trigger on update/delete.
create policy "body_weight_measurements: read own"
  on public.body_weight_measurements
  for select using (user_id = auth.uid());

comment on table public.body_weight_measurements is
  'Append-only body-weight history; profile fields cache the newest row.';
comment on column public.body_weight_measurements.weight_kg is
  'Measured body weight in kilograms regardless of display unit.';
comment on column public.body_weight_measurements.source is
  'Entry point that recorded the measurement: settings or workout.';

-- Snapshot used by bodyweight exercises in this specific workout. Per-set
-- sets.weight_kg remains the total effective load; added load (including a
-- negative assisted load) is derived as total minus this snapshot.
alter table public.workouts
  add column if not exists body_weight_kg numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_body_weight_positive'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
      add constraint workouts_body_weight_positive
      check (body_weight_kg is null or body_weight_kg > 0);
  end if;
end
$$;

comment on column public.workouts.body_weight_kg is
  'Body-weight snapshot for this session in kg; set weight stays total load.';

-- Snapshot how set weight is interpreted for each exercise occurrence. All
-- rows predating bodyweight support are external by construction.
alter table public.workout_exercises
  add column if not exists load_mode text not null default 'external';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workout_exercises_load_mode_check'
      and conrelid = 'public.workout_exercises'::regclass
  ) then
    alter table public.workout_exercises
      add constraint workout_exercises_load_mode_check
      check (load_mode in ('external', 'bodyweight'));
  end if;
end
$$;

comment on column public.workout_exercises.load_mode is
  'Immutable expected load semantics when this exercise occurrence is logged.';

-- `bodyweight` is deliberately added at the database boundary first. The
-- existing equipment column remains non-null and backward compatible.
alter table public.exercises
  drop constraint if exists exercises_equipment_check;

alter table public.exercises
  add constraint exercises_equipment_check
  check (
    equipment in (
      'free_weight',
      'dumbbell',
      'machine',
      'crossover',
      'bodyweight'
    )
  );

-- A persisted draft carries the mode it was edited under. Serialize inserts
-- against equipment changes and reject stale drafts before they can reinterpret
-- set weight. SECURITY DEFINER lets this boundary inspect both owners without
-- weakening the caller-facing RLS policies.
create or replace function public.validate_workout_exercise_load_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_request_role text := auth.role();
  v_workout_owner uuid;
  v_exercise_owner uuid;
  v_expected_load_mode text;
begin
  select w.user_id
  into v_workout_owner
  from public.workouts w
  where w.id = new.workout_id;

  if not found then
    raise exception 'Workout not found' using errcode = '23503';
  end if;

  -- SHARE conflicts with an exercise equipment update and is held through the
  -- insert transaction. Whichever operation wins forces the other to recheck.
  select
    e.user_id,
    case when e.equipment = 'bodyweight' then 'bodyweight' else 'external' end
  into v_exercise_owner, v_expected_load_mode
  from public.exercises e
  where e.id = new.exercise_id
  for share;

  if not found then
    raise exception 'Exercise not found' using errcode = '23503';
  end if;

  if v_workout_owner <> v_exercise_owner then
    raise exception 'Workout and exercise owners do not match'
      using errcode = '42501';
  end if;

  -- Service-role demo tooling and direct administrative sessions have no user
  -- JWT. Normal authenticated writes must own both referenced rows.
  if v_caller_id is null then
    if coalesce(v_request_role, '') <> 'service_role'
      and session_user not in ('postgres', 'supabase_admin')
    then
      raise exception 'Authentication required' using errcode = '42501';
    end if;
  elsif v_workout_owner <> v_caller_id or v_exercise_owner <> v_caller_id then
    raise exception 'Workout exercise is not owned by the caller'
      using errcode = '42501';
  end if;

  if new.load_mode is distinct from v_expected_load_mode then
    raise exception 'WORKOUT_LOAD_MODE_MISMATCH'
      using
        errcode = '23514',
        detail = 'The exercise load mode changed after this workout draft was prepared.';
  end if;

  return new;
end;
$$;

create trigger workout_exercises_validate_load_mode
  before insert or update on public.workout_exercises
  for each row execute function public.validate_workout_exercise_load_mode();

revoke all on function public.validate_workout_exercise_load_mode()
  from public;

-- Changing an exercise between external-load and bodyweight semantics would
-- reinterpret every historical set because workout_exercises references the
-- live exercise row. Allow changes among external equipment types, but lock
-- the bodyweight boundary once the exercise occurs in any saved workout.
create or replace function public.protect_bodyweight_exercise_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (old.equipment = 'bodyweight') <> (new.equipment = 'bodyweight')
    and exists (
      select 1
      from public.workout_exercises we
      where we.exercise_id = old.id
    )
  then
    raise exception 'Bodyweight mode cannot change after use in a saved workout'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger exercises_protect_bodyweight_history
  before update of equipment on public.exercises
  for each row execute function public.protect_bodyweight_exercise_history();

revoke all on function public.protect_bodyweight_exercise_history()
  from public;

-- One transaction records history and advances the profile cache only when
-- the new entry is at least as recent as the cached entry. Direct inserts have
-- no RLS policy, so every history write goes through this SECURITY DEFINER
-- boundary and cannot bypass the cache update. auth.uid(), an empty search_path
-- and schema-qualified names keep that privileged boundary caller-scoped.
create or replace function public.log_body_weight(
  p_weight_kg numeric,
  p_measured_at timestamptz default now(),
  p_source text default 'settings'
)
returns public.body_weight_measurements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_measurement public.body_weight_measurements;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if p_weight_kg is null or p_weight_kg <= 0 then
    raise exception 'Body weight must be greater than zero'
      using errcode = '22023';
  end if;

  if p_measured_at is null then
    raise exception 'Measurement timestamp is required'
      using errcode = '22023';
  end if;

  if p_measured_at > now() + interval '5 minutes' then
    raise exception 'Measurement timestamp cannot be in the future'
      using errcode = '22023';
  end if;

  if p_source is null or p_source not in ('settings', 'workout') then
    raise exception 'Invalid body-weight source' using errcode = '22023';
  end if;

  insert into public.body_weight_measurements (
    user_id,
    weight_kg,
    measured_at,
    source
  )
  values (
    v_user_id,
    p_weight_kg,
    p_measured_at,
    p_source
  )
  returning * into v_measurement;

  update public.profiles
  set
    body_weight_kg = p_weight_kg,
    body_weight_measured_at = p_measured_at
  where id = v_user_id
    and (
      body_weight_measured_at is null
      or p_measured_at >= body_weight_measured_at
    );

  if not found and not exists (
    select 1
    from public.profiles
    where id = v_user_id
  ) then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  return v_measurement;
end;
$$;

revoke all on function public.log_body_weight(numeric, timestamptz, text)
  from public;
grant execute on function public.log_body_weight(numeric, timestamptz, text)
  to authenticated;

comment on function public.log_body_weight(numeric, timestamptz, text) is
  'Atomically append a body-weight measurement and refresh the latest cache.';
