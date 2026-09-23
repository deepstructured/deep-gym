-- DeepGym — atomic workout creation and editing for the native app.
-- Apply manually in Supabase SQL Editor after 0008_home_widgets_warmup_sets.sql.
-- A function call is one database transaction: any failed nested write rolls
-- back the workout header, occurrences, and sets together.

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.sets'::regclass
      and attname = 'set_type'
      and not attisdropped
  ) then
    raise exception 'Apply migration 0008 before 0009';
  end if;
end;
$$;

-- A stable native draft key makes a create retry safe when the first response
-- is lost after COMMIT. Existing web-created workouts keep both fields NULL.
alter table public.workouts
  add column if not exists client_create_key uuid,
  add column if not exists client_create_hash text;

create unique index if not exists workouts_user_create_key_idx
  on public.workouts (user_id, client_create_key);

create or replace function public.save_workout_atomic(
  p_input jsonb,
  p_workout_id uuid default null,
  p_create_key uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_workout_id uuid;
  v_type text;
  v_date_text text;
  v_date date;
  v_notes text;
  v_body_weight_kg numeric;
  v_create_hash text;
  v_existing_hash text;
  v_exercises jsonb;
  v_exercise jsonb;
  v_sets jsonb;
  v_set jsonb;
  v_exercise_id uuid;
  v_expected_mode text;
  v_actual_mode text;
  v_occurrence_id uuid;
  v_position integer := 0;
  v_set_position integer;
  v_set_type text;
  v_to_failure boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_input is null or pg_catalog.jsonb_typeof(p_input) <> 'object' then
    raise exception 'Workout input must be an object' using errcode = '22023';
  end if;

  v_type := pg_catalog.btrim(p_input->>'type');
  v_date_text := p_input->>'date';
  v_notes := p_input->>'notes';
  v_exercises := p_input->'exercises';
  if v_type is null or v_type = '' then
    raise exception 'Workout type is required' using errcode = '22023';
  end if;
  if v_date_text is null or v_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'Workout date must be YYYY-MM-DD' using errcode = '22023';
  end if;
  v_date := v_date_text::date;
  if pg_catalog.jsonb_typeof(v_exercises) is distinct from 'array' then
    raise exception 'Exercises must be an array' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(v_exercises) = 0 then
    raise exception 'At least one exercise is required' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(v_exercises) > 100 then
    raise exception 'Too many exercises in one workout' using errcode = '22023';
  end if;
  if p_input ? 'body_weight_kg' then
    v_body_weight_kg := (p_input->>'body_weight_kg')::numeric;
    if v_body_weight_kg is not null and v_body_weight_kg <= 0 then
      raise exception 'Body weight must be positive' using errcode = '22023';
    end if;
  end if;

  if p_workout_id is null then
    if p_create_key is null then
      raise exception 'Create key is required' using errcode = '22023';
    end if;
    v_create_hash := pg_catalog.md5(p_input::text);
    select w.id, w.client_create_hash
      into v_workout_id, v_existing_hash
    from public.workouts w
    where w.user_id = v_user_id and w.client_create_key = p_create_key
    for update;
    if found then
      if v_existing_hash is distinct from v_create_hash then
        raise exception 'WORKOUT_CREATE_KEY_CONFLICT' using errcode = '23505';
      end if;
      return v_workout_id;
    end if;
  elsif p_create_key is not null then
    raise exception 'Create key is only valid for new workouts' using errcode = '22023';
  end if;

  -- Check every reference before changing an existing workout. SHARE locks
  -- serialize equipment changes against this write and remain held to commit.
  for v_exercise in
    select value from pg_catalog.jsonb_array_elements(v_exercises)
  loop
    if pg_catalog.jsonb_typeof(v_exercise) <> 'object' then
      raise exception 'Exercise input must be an object' using errcode = '22023';
    end if;
    v_exercise_id := (v_exercise->>'exercise_id')::uuid;
    v_expected_mode := v_exercise->>'load_mode';
    v_sets := v_exercise->'sets';
    if v_exercise_id is null
      or v_expected_mode is null
      or v_expected_mode not in ('external', 'bodyweight')
      or pg_catalog.jsonb_typeof(v_sets) is distinct from 'array'
    then
      raise exception 'Invalid exercise input' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(v_sets) > 200 then
      raise exception 'Too many sets for one exercise' using errcode = '22023';
    end if;

    select case when e.equipment = 'bodyweight' then 'bodyweight' else 'external' end
      into v_actual_mode
    from public.exercises e
    where e.id = v_exercise_id and e.user_id = v_user_id
    for share;
    if not found then
      raise exception 'Exercise is unavailable' using errcode = '42501';
    end if;
    if v_expected_mode <> v_actual_mode then
      raise exception 'WORKOUT_LOAD_MODE_MISMATCH' using errcode = '23514';
    end if;
  end loop;

  if p_workout_id is null then
    insert into public.workouts (
      user_id, type, date, notes, body_weight_kg,
      client_create_key, client_create_hash
    )
    values (
      v_user_id, v_type, v_date, v_notes, v_body_weight_kg,
      p_create_key, v_create_hash
    )
    on conflict (user_id, client_create_key) do nothing
    returning id into v_workout_id;
    if v_workout_id is null then
      -- Another request committed the same key while this one was validating.
      select w.id, w.client_create_hash
        into v_workout_id, v_existing_hash
      from public.workouts w
      where w.user_id = v_user_id and w.client_create_key = p_create_key
      for update;
      if not found then
        raise exception 'Create retry could not be resolved' using errcode = '40001';
      end if;
      if v_existing_hash is distinct from v_create_hash then
        raise exception 'WORKOUT_CREATE_KEY_CONFLICT' using errcode = '23505';
      end if;
      return v_workout_id;
    end if;
  else
    select w.id into v_workout_id
    from public.workouts w
    where w.id = p_workout_id and w.user_id = v_user_id
    for update;
    if not found then
      raise exception 'Workout is unavailable' using errcode = '42501';
    end if;

    update public.workouts w
    set type = v_type,
        date = v_date,
        notes = v_notes,
        body_weight_kg = case
          when p_input ? 'body_weight_kg' then v_body_weight_kg
          else w.body_weight_kg
        end
    where w.id = v_workout_id and w.user_id = v_user_id;

    -- Cascading sets are restored automatically if any later insert fails.
    delete from public.workout_exercises we
    where we.workout_id = v_workout_id;
  end if;

  for v_exercise in
    select value from pg_catalog.jsonb_array_elements(v_exercises)
  loop
    v_exercise_id := (v_exercise->>'exercise_id')::uuid;
    insert into public.workout_exercises (
      workout_id, exercise_id, load_mode, position, notes
    ) values (
      v_workout_id,
      v_exercise_id,
      v_exercise->>'load_mode',
      v_position,
      v_exercise->>'notes'
    ) returning id into v_occurrence_id;

    v_set_position := 0;
    for v_set in
      select value from pg_catalog.jsonb_array_elements(v_exercise->'sets')
    loop
      if pg_catalog.jsonb_typeof(v_set) <> 'object' then
        raise exception 'Set input must be an object' using errcode = '22023';
      end if;
      v_set_type := coalesce(v_set->>'set_type', 'working');
      if v_set_type not in ('working', 'warmup') then
        raise exception 'Invalid set type' using errcode = '22023';
      end if;
      v_to_failure := coalesce((v_set->>'to_failure')::boolean, false);
      if v_set_type = 'warmup' then
        v_to_failure := false;
      end if;

      insert into public.sets (
        workout_exercise_id, position, weight_kg, reps, to_failure, set_type
      ) values (
        v_occurrence_id,
        v_set_position,
        (v_set->>'weight_kg')::numeric,
        (v_set->>'reps')::integer,
        v_to_failure,
        v_set_type
      );
      v_set_position := v_set_position + 1;
    end loop;
    v_position := v_position + 1;
  end loop;

  return v_workout_id;
end;
$$;

revoke all on function public.save_workout_atomic(jsonb, uuid, uuid) from public;
grant execute on function public.save_workout_atomic(jsonb, uuid, uuid) to authenticated;

comment on function public.save_workout_atomic(jsonb, uuid, uuid) is
  'Atomically create or replace a caller-owned workout with ordered exercises and sets.';
