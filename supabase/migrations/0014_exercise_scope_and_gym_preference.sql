-- Apply once, after 0013. Legacy exercises become universal, including ones
-- that already had a gym assignment. Exercise and workout IDs stay intact.
alter table public.exercises add column is_universal boolean not null default true;
delete from public.gym_exercises;

alter table public.profiles
  add column last_gym_id uuid,
  add column gym_filter_all boolean not null default true,
  add foreign key (id,last_gym_id) references public.gyms(user_id,id)
    on delete set null (last_gym_id);

-- For accounts that have used gyms, recover the last logged choice, including
-- a subsequent workout explicitly logged without a gym. Other users browse all.
with latest as (
  select distinct on (user_id) user_id,gym_id from public.workouts
  order by user_id,created_at desc,id desc
)
update public.profiles p set last_gym_id=l.gym_id, gym_filter_all=false
from latest l where l.user_id=p.id and exists (
  select from public.workouts w where w.user_id=p.id and w.gym_id is not null
);

-- Existing installed clients treat gym_catalog.exercise_ids as the complete
-- picker list. New clients compute that list from the exercise flag and only
-- download explicit memberships (even for large universal catalogs).
create view public.scoped_gym_catalog with (security_invoker = true) as
  select g.*,array(select ge.exercise_id from public.gym_exercises ge
                   join public.exercises e on e.id=ge.exercise_id
                   where ge.gym_id=g.id and not e.is_universal order by ge.exercise_id) as exercise_ids
  from public.gyms g;
revoke all on public.scoped_gym_catalog from public,anon,authenticated;
grant select on public.scoped_gym_catalog to authenticated;

create or replace view public.gym_catalog with (security_invoker = true) as
  select g.*,array(select e.id from public.exercises e where e.user_id=g.user_id
        and (e.is_universal or exists(select from public.gym_exercises ge
                         where ge.gym_id=g.id and ge.exercise_id=e.id)) order by e.id) as exercise_ids
  from public.gyms g;

-- The empty array explicitly means universal. NULL leaves the scope of an
-- existing exercise untouched (and defaults to universal on creation).
create function public.save_catalog_exercise(p_id uuid,p_input jsonb,p_gym_ids uuid[])
returns public.exercises language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved public.exercises;
  fields public.exercises;
begin
  if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if jsonb_typeof(p_input) is distinct from 'object' or
     p_input - array['name','muscle_group_id','equipment','machine_settings','working_weight_kg','unit'] <> '{}'::jsonb then
    raise exception 'Invalid exercise fields' using errcode='22023';
  end if;
  -- The two editors replace opposite sides of the same relation. Serialize
  -- those writes per account, including legacy clients using save_gym.
  perform pg_advisory_xact_lock(hashtextextended('gym catalog:' || owner_id::text,0));
  if p_id is not null then
    select * into strict saved from public.exercises where id=p_id and user_id=owner_id for update;
  end if;
  fields := jsonb_populate_record(saved,p_input);
  if not exists(select from public.muscle_groups where id=fields.muscle_group_id
      and (user_id is null or user_id=owner_id)) then
    raise exception 'Muscle group is unavailable' using errcode='42501';
  end if;
  if fields.equipment='bodyweight' then fields.working_weight_kg := null; end if;
  if p_id is null then
    insert into public.exercises(user_id,name,muscle_group_id,equipment,machine_settings,working_weight_kg,unit,is_universal)
    values(owner_id,btrim(fields.name),fields.muscle_group_id,coalesce(fields.equipment,'free_weight'),
      fields.machine_settings,fields.working_weight_kg,fields.unit,coalesce(cardinality(p_gym_ids),0)=0) returning * into saved;
  else
    update public.exercises set name=btrim(fields.name),muscle_group_id=fields.muscle_group_id,equipment=fields.equipment,
      machine_settings=fields.machine_settings,working_weight_kg=fields.working_weight_kg,unit=fields.unit,
      is_universal=coalesce(cardinality(p_gym_ids)=0,saved.is_universal)
      where id=p_id and user_id=owner_id returning * into saved;
  end if;
  if p_gym_ids is not null then
    delete from public.gym_exercises ge where ge.exercise_id=saved.id and not (ge.gym_id=any(p_gym_ids));
    insert into public.gym_exercises(user_id,gym_id,exercise_id)
      select distinct owner_id,gid,saved.id from unnest(p_gym_ids) gid
      on conflict (gym_id,exercise_id) do nothing;
  end if;
  return saved;
end;
$$;

create or replace function public.create_exercise_at_gym(p_gym_id uuid,p_input jsonb)
returns public.exercises language sql security invoker set search_path = '' as $$
  select public.save_catalog_exercise(null,p_input,array[p_gym_id]);
$$;

create or replace function public.save_gym(p_id uuid,p_name text,p_bar_weight_kg numeric,
  p_plates_kg numeric[],p_plates_lb numeric[],p_exercise_ids uuid[])
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  saved_id uuid;
begin
  if p_exercise_ids is null then
    raise exception 'Exercise list is required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('gym catalog:' || owner_id::text,0));
  if exists(select from unnest(p_exercise_ids) eid where not exists(
      select from public.exercises where id=eid and user_id=owner_id)) then
    raise exception 'Exercise is unavailable' using errcode='23503';
  end if;
  if p_id is null then
    insert into public.gyms(user_id,name,bar_weight_kg,plates_kg,plates_lb)
      values(owner_id,btrim(p_name),p_bar_weight_kg,p_plates_kg,p_plates_lb) returning id into saved_id;
  else
    update public.gyms set name=btrim(p_name),bar_weight_kg=p_bar_weight_kg,plates_kg=p_plates_kg,plates_lb=p_plates_lb
      where user_id=owner_id and id=p_id returning id into strict saved_id;
  end if;
  delete from public.gym_exercises where gym_id=saved_id and not (exercise_id=any(p_exercise_ids));
  insert into public.gym_exercises(user_id,gym_id,exercise_id)
    select owner_id,saved_id,id from public.exercises
    where user_id=owner_id and id=any(p_exercise_ids) and not is_universal
    on conflict (gym_id,exercise_id) do nothing;
  return saved_id;
end;
$$;

revoke all on function public.save_catalog_exercise(uuid,jsonb,uuid[]) from public,anon;
grant execute on function public.save_catalog_exercise(uuid,jsonb,uuid[]) to authenticated;
notify pgrst,'reload schema';
