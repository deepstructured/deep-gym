-- DeepGym — reusable workout templates.
-- Run this migration manually in the Supabase SQL Editor after 0006.

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  type text not null default 'Full Body' check (char_length(btrim(type)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workout_templates_user_updated_idx
  on public.workout_templates (user_id, updated_at desc);

alter table public.workout_templates enable row level security;

create policy "workout_templates: select own" on public.workout_templates
  for select using (user_id = auth.uid());
create policy "workout_templates: insert own" on public.workout_templates
  for insert with check (user_id = auth.uid());
create policy "workout_templates: update own" on public.workout_templates
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "workout_templates: delete own" on public.workout_templates
  for delete using (user_id = auth.uid());

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null
    references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null
    references public.exercises (id) on delete cascade,
  position int not null default 0 check (position >= 0),
  unique (template_id, exercise_id),
  unique (template_id, position)
);

create index workout_template_exercises_exercise_idx
  on public.workout_template_exercises (exercise_id);

alter table public.workout_template_exercises enable row level security;

create policy "workout_template_exercises: select own"
  on public.workout_template_exercises
  for select using (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = workout_template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  );

create policy "workout_template_exercises: insert own"
  on public.workout_template_exercises
  for insert with check (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = workout_template_exercises.template_id
        and wt.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.exercises e
      where e.id = workout_template_exercises.exercise_id
        and e.user_id = auth.uid()
    )
  );

create policy "workout_template_exercises: update own"
  on public.workout_template_exercises
  for update using (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = workout_template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = workout_template_exercises.template_id
        and wt.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.exercises e
      where e.id = workout_template_exercises.exercise_id
        and e.user_id = auth.uid()
    )
  );

create policy "workout_template_exercises: delete own"
  on public.workout_template_exercises
  for delete using (
    exists (
      select 1
      from public.workout_templates wt
      where wt.id = workout_template_exercises.template_id
        and wt.user_id = auth.uid()
    )
  );

create or replace function public.touch_workout_template_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workout_templates_touch_updated_at
  before update on public.workout_templates
  for each row execute function public.touch_workout_template_updated_at();

-- Keep each template structure consistent. The parent row and its ordered
-- exercise references are written in a single transaction by these RPCs.
-- SECURITY INVOKER is intentional: all table RLS policies remain in force.
create or replace function public.create_workout_template(
  p_name text,
  p_type text,
  p_exercise_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_template_id uuid;
  v_exercise_count int;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'Template name is required' using errcode = '22023';
  end if;
  if p_type is null or char_length(btrim(p_type)) = 0 then
    raise exception 'Workout type is required' using errcode = '22023';
  end if;
  if p_exercise_ids is null or cardinality(p_exercise_ids) = 0 then
    raise exception 'At least one exercise is required' using errcode = '22023';
  end if;
  if array_position(p_exercise_ids, null) is not null then
    raise exception 'Exercise IDs cannot contain nulls' using errcode = '22023';
  end if;

  select count(distinct requested.exercise_id)
  into v_exercise_count
  from unnest(p_exercise_ids) as requested(exercise_id);

  if v_exercise_count <> cardinality(p_exercise_ids) then
    raise exception 'Exercise IDs must be unique' using errcode = '22023';
  end if;

  select count(*)
  into v_exercise_count
  from public.exercises e
  where e.user_id = v_user_id
    and e.id = any(p_exercise_ids);

  if v_exercise_count <> cardinality(p_exercise_ids) then
    raise exception 'One or more exercises are unavailable' using errcode = '42501';
  end if;

  insert into public.workout_templates (user_id, name, type)
  values (v_user_id, btrim(p_name), btrim(p_type))
  returning id into v_template_id;

  insert into public.workout_template_exercises (
    template_id,
    exercise_id,
    position
  )
  select
    v_template_id,
    requested.exercise_id,
    (requested.ordinality - 1)::int
  from unnest(p_exercise_ids) with ordinality
    as requested(exercise_id, ordinality);

  return v_template_id;
end;
$$;

create or replace function public.update_workout_template(
  p_template_id uuid,
  p_name text,
  p_type text,
  p_exercise_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_exercise_count int;
  v_updated_count int;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_template_id is null then
    raise exception 'Template ID is required' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then
    raise exception 'Template name is required' using errcode = '22023';
  end if;
  if p_type is null or char_length(btrim(p_type)) = 0 then
    raise exception 'Workout type is required' using errcode = '22023';
  end if;
  if p_exercise_ids is null or cardinality(p_exercise_ids) = 0 then
    raise exception 'At least one exercise is required' using errcode = '22023';
  end if;
  if array_position(p_exercise_ids, null) is not null then
    raise exception 'Exercise IDs cannot contain nulls' using errcode = '22023';
  end if;

  select count(distinct requested.exercise_id)
  into v_exercise_count
  from unnest(p_exercise_ids) as requested(exercise_id);

  if v_exercise_count <> cardinality(p_exercise_ids) then
    raise exception 'Exercise IDs must be unique' using errcode = '22023';
  end if;

  select count(*)
  into v_exercise_count
  from public.exercises e
  where e.user_id = v_user_id
    and e.id = any(p_exercise_ids);

  if v_exercise_count <> cardinality(p_exercise_ids) then
    raise exception 'One or more exercises are unavailable' using errcode = '42501';
  end if;

  update public.workout_templates
  set name = btrim(p_name),
      type = btrim(p_type)
  where id = p_template_id
    and user_id = v_user_id;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> 1 then
    raise exception 'Template not found' using errcode = 'P0002';
  end if;

  delete from public.workout_template_exercises
  where template_id = p_template_id;

  insert into public.workout_template_exercises (
    template_id,
    exercise_id,
    position
  )
  select
    p_template_id,
    requested.exercise_id,
    (requested.ordinality - 1)::int
  from unnest(p_exercise_ids) with ordinality
    as requested(exercise_id, ordinality);

  return p_template_id;
end;
$$;

revoke all on function public.create_workout_template(text, text, uuid[])
  from public;
revoke all on function public.update_workout_template(uuid, text, text, uuid[])
  from public;
grant execute on function public.create_workout_template(text, text, uuid[])
  to authenticated;
grant execute on function public.update_workout_template(uuid, text, text, uuid[])
  to authenticated;

comment on table public.workout_templates is
  'User-owned reusable workout structures.';
comment on table public.workout_template_exercises is
  'Ordered exercise references belonging to a workout template.';
