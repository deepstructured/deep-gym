-- Synthetic sessions only, inside the isolated PostgreSQL suite.
begin;
insert into auth.users(id,email) values
  ('d1000000-0000-0000-0000-000000000001','gym-a@example.test'),
  ('d1000000-0000-0000-0000-000000000002','gym-b@example.test');
set local role authenticated;
do $$
declare
  owner_a uuid := 'd1000000-0000-0000-0000-000000000001';
  owner_b uuid := 'd1000000-0000-0000-0000-000000000002';
  create_key uuid := gen_random_uuid();
  location_a uuid;
  location_b uuid;
  exercise_a public.exercises;
  payload jsonb;
  session_id uuid;
begin
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  location_a := public.save_gym(null,'First',20,array[20,5],'{}','{}');
  exercise_a := public.create_exercise_at_gym(location_a,jsonb_build_object('name','Press','equipment','free_weight',
    'muscle_group_id',(select id from public.muscle_groups where user_id is null limit 1)));
  location_b := public.save_gym(null,'Second',15,'{}',array[25],array[exercise_a.id]);
  if (select count(*) from public.gym_catalog where exercise_ids = array[exercise_a.id]) <> 2 then
    raise exception 'One exercise must be available in both gyms'; end if;
  payload := jsonb_build_object('type','Push','date','2026-11-10','gym_id',location_a,'exercises',
    jsonb_build_array(jsonb_build_object('exercise_id',exercise_a.id,'load_mode','external','sets',
      '[{"reps":7,"weight_kg":60}]'::jsonb)));
  session_id := public.save_workout_at_gym(payload,null,create_key);
  perform public.save_workout_atomic(payload-'gym_id',session_id,null);
  if (select gym_id from public.workouts where id=session_id) is distinct from location_a then
    raise exception 'Legacy edit cleared location'; end if;
  perform public.save_workout_at_gym(payload || jsonb_build_object('gym_id',location_b),session_id,null);
  perform public.save_workout_at_gym(payload,null,create_key);
  if (select gym_id from public.workouts where id=session_id) is distinct from location_b then
    raise exception 'Create retry reverted location'; end if;
  perform public.save_workout_at_gym(payload || '{"gym_id":null}'::jsonb,session_id,null);
  if (select gym_id from public.workouts where id=session_id) is not null then
    raise exception 'Explicit unassignment failed'; end if;
  perform public.save_workout_at_gym(payload,session_id,null);

  perform set_config('request.jwt.claim.sub',owner_b::text,true);
  if exists(select from public.gym_catalog) or exists(select from public.gym_exercises) then
    raise exception 'Gym catalog visible outside its owner'; end if;
  begin
    perform public.save_gym(null,'Invalid membership',20,'{}','{}',array[exercise_a.id]);
    raise exception 'Cross-owner membership was accepted';
  exception when foreign_key_violation then null; end;
  if exists(select from public.gyms) then raise exception 'Failed catalog write did not roll back'; end if;
  begin
    update public.profiles set last_gym_id=location_a where id=owner_b;
    raise exception 'Profile accepted another user''s gym';
  exception when foreign_key_violation then null; end;
  location_b := public.save_gym(null,'Another owner',20,'{}','{}','{}');
  perform set_config('request.jwt.claim.sub',owner_a::text,true);
  begin
    perform public.save_workout_at_gym(payload || jsonb_build_object('gym_id',location_b),session_id,null);
    raise exception 'Cross-owner workout gym was accepted';
  exception when foreign_key_violation then null; end;
  if (select gym_id from public.workouts where id=session_id) is distinct from location_a then
    raise exception 'Failed move changed saved workout'; end if;
  begin
    perform public.save_catalog_exercise(exercise_a.id,'{"name":"Rejected"}',array[location_a,location_b]);
    raise exception 'Scope edit accepted another user''s gym';
  exception when foreign_key_violation then null; end;
  if (select name from public.exercises where id=exercise_a.id) <> 'Press' or
     (select count(*) from public.gym_exercises where exercise_id=exercise_a.id) <> 2 then
    raise exception 'Failed scope edit changed the exercise or memberships'; end if;
  update public.profiles set last_gym_id=location_a,gym_filter_all=false where id=owner_a;
  delete from public.gyms where id=location_a;
  if (select last_gym_id is not null or gym_filter_all from public.profiles where id=owner_a) then
    raise exception 'Gym deletion did not clear the remembered venue'; end if;
  if (select gym_id from public.workouts where id=session_id) is not null
    or not exists(select 1 from public.sets s join public.workout_exercises we on we.id=s.workout_exercise_id
      where we.workout_id=session_id and we.exercise_id=exercise_a.id and s.reps=7 and s.weight_kg=60) then
    raise exception 'Gym removal lost session history'; end if;
end $$;
rollback;
