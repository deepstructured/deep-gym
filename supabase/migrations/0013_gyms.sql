-- Apply manually after 0012. Old workouts and the profile's equipment keep
-- their original meaning. One exercise can be available in several gyms.
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 100),
  bar_weight_kg numeric not null check (bar_weight_kg between 0 and 1000),
  plates_kg numeric[] not null check (cardinality(plates_kg) <= 50 and
    array_position(plates_kg,null) is null and 0 < all(plates_kg) and 1000 >= all(plates_kg)),
  plates_lb numeric[] not null check (cardinality(plates_lb) <= 50 and
    array_position(plates_lb,null) is null and 0 < all(plates_lb) and 1000 >= all(plates_lb)),
  unique(user_id,id)
);
create unique index gyms_owner_name_idx on public.gyms (user_id,lower(name));

-- Composite references enforce matching owners for all writers, including
-- direct table writes. Deleting a gym detaches workouts and keeps every set.
create unique index exercises_owner_id_idx on public.exercises(user_id,id);
create table public.gym_exercises (
  user_id uuid not null,
  gym_id uuid not null,
  exercise_id uuid not null,
  primary key (gym_id,exercise_id),
  foreign key (user_id,gym_id) references public.gyms(user_id,id) on delete cascade,
  foreign key (user_id,exercise_id) references public.exercises(user_id,id) on delete cascade
);
create index gym_exercises_exercise_idx on public.gym_exercises(exercise_id);
alter table public.workouts add column gym_id uuid,
  add foreign key(user_id,gym_id) references public.gyms(user_id,id) on delete set null (gym_id);
create index workouts_gym_idx on public.workouts(gym_id) where gym_id is not null;

alter table public.gyms enable row level security;
alter table public.gym_exercises enable row level security;
create policy gyms_own on public.gyms for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy gym_exercises_own on public.gym_exercises for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create view public.gym_catalog with (security_invoker = true) as
  select g.*, array(select ge.exercise_id from public.gym_exercises ge
                    where ge.gym_id = g.id order by ge.exercise_id) as exercise_ids
  from public.gyms g;
revoke all on public.gyms, public.gym_exercises, public.gym_catalog from public, anon, authenticated;
grant select, insert, update, delete on public.gyms, public.gym_exercises to authenticated;
grant select on public.gym_catalog to authenticated;

create function public.save_gym(p_id uuid, p_name text, p_bar_weight_kg numeric,
  p_plates_kg numeric[], p_plates_lb numeric[], p_exercise_ids uuid[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved_id uuid;
begin
  if p_exercise_ids is null then
    raise exception 'Exercise list is required' using errcode='22023';
  end if;
  if p_id is null then
    insert into public.gyms(user_id,name,bar_weight_kg,plates_kg,plates_lb)
      values(owner_id,btrim(p_name),p_bar_weight_kg,p_plates_kg,p_plates_lb) returning id into saved_id;
  else
    update public.gyms set name=btrim(p_name), bar_weight_kg=p_bar_weight_kg,
      plates_kg=p_plates_kg, plates_lb=p_plates_lb
      where user_id=owner_id and id=p_id returning id into strict saved_id;
  end if;
  delete from public.gym_exercises where gym_id=saved_id and not (exercise_id = any(p_exercise_ids));
  insert into public.gym_exercises(user_id,gym_id,exercise_id)
    select distinct owner_id,saved_id,exercise_id from unnest(p_exercise_ids) exercise_id
    on conflict (gym_id,exercise_id) do nothing;
  return saved_id;
end;
$$;

create function public.create_exercise_at_gym(p_gym_id uuid,p_input jsonb)
returns public.exercises language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  created public.exercises;
begin
  -- Use the same lock order as save_gym when changing its catalog.
  perform 1 from public.gyms where user_id=owner_id and id=p_gym_id for update;
  if not found then raise exception 'Gym is unavailable' using errcode='42501'; end if;
  if not exists (select 1 from public.muscle_groups where id=(p_input->>'muscle_group_id')::uuid)
    then raise exception 'Muscle group is unavailable' using errcode='42501'; end if;
  insert into public.exercises(user_id,muscle_group_id,name,equipment,machine_settings,working_weight_kg,unit)
    values(owner_id,(p_input->>'muscle_group_id')::uuid,btrim(p_input->>'name'),p_input->>'equipment',
      p_input->>'machine_settings',case when p_input->>'equipment' <> 'bodyweight'
        then (p_input->>'working_weight_kg')::numeric end,p_input->>'unit') returning * into created;
  insert into public.gym_exercises(user_id,gym_id,exercise_id) values(owner_id,p_gym_id,created.id);
  return created;
end;
$$;

-- The original RPC remains the write path for legacy and unassigned clients.
-- Reuse its validation and hash the complete gym-aware payload. Serializing
-- equal create keys lets a lost-response retry leave subsequent gym edits alone.
create function public.save_workout_at_gym(p_input jsonb,p_workout_id uuid,p_create_key uuid)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved_id uuid;
  repeated boolean := false;
begin
  if not (p_input ? 'gym_id') then raise exception 'Gym field is required' using errcode='22023'; end if;
  if p_workout_id is null and p_create_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(owner_id::text || p_create_key::text,0));
    select exists(select 1 from public.workouts where user_id=owner_id and client_create_key=p_create_key)
      into repeated;
  end if;
  saved_id := public.save_workout_atomic(p_input,p_workout_id,p_create_key);
  if not repeated then
    update public.workouts set gym_id=(p_input->>'gym_id')::uuid where id=saved_id and user_id=owner_id;
  end if;
  return saved_id;
end;
$$;

revoke all on function public.save_gym(uuid,text,numeric,numeric[],numeric[],uuid[]),
  public.create_exercise_at_gym(uuid,jsonb), public.save_workout_at_gym(jsonb,uuid,uuid) from public,anon;
grant execute on function public.save_gym(uuid,text,numeric,numeric[],numeric[],uuid[]),
  public.create_exercise_at_gym(uuid,jsonb), public.save_workout_at_gym(jsonb,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
