-- Run against the temporary 0013 database. Roll back both the fixtures and
-- migration, then the main harness applies 0014 normally to an empty catalog.
begin;
insert into auth.users(id,email) values
 ('14000000-0000-0000-0000-000000000001','migration-a@example.test'),
 ('14000000-0000-0000-0000-000000000002','migration-b@example.test');
set local request.jwt.claim.sub='14000000-0000-0000-0000-000000000001';
insert into public.gyms(id,user_id,name,bar_weight_kg,plates_kg,plates_lb)
  values ('14000000-0000-0000-0000-000000000003',auth.uid(),'Old gym',20,'{}','{}');
insert into public.exercises(id,user_id,name,muscle_group_id)
  select '14000000-0000-0000-0000-000000000004',auth.uid(),'Logged',id from public.muscle_groups where user_id is null limit 1;
insert into public.gym_exercises(user_id,gym_id,exercise_id)
  values(auth.uid(),'14000000-0000-0000-0000-000000000003','14000000-0000-0000-0000-000000000004');
insert into public.workouts(id,user_id,gym_id,created_at) values
 ('14000000-0000-0000-0000-000000000005',auth.uid(),null,'2026-01-01'),
 ('14000000-0000-0000-0000-000000000006',auth.uid(),'14000000-0000-0000-0000-000000000003','2026-01-02');
insert into public.workout_exercises(id,workout_id,exercise_id,load_mode) values
 ('14000000-0000-0000-0000-000000000007','14000000-0000-0000-0000-000000000006','14000000-0000-0000-0000-000000000004','external');
insert into public.sets(workout_exercise_id,weight_kg,reps)
  values ('14000000-0000-0000-0000-000000000007',42.5,8);
\ir ../supabase/migrations/0014_exercise_scope_and_gym_preference.sql
do $$
begin
  if not exists(select from public.exercises where id='14000000-0000-0000-0000-000000000004' and is_universal)
     or exists(select from public.gym_exercises) then
    raise exception 'Existing assigned exercise was not made universal'; end if;
  if not exists(select from public.profiles where id=auth.uid() and not gym_filter_all
     and last_gym_id='14000000-0000-0000-0000-000000000003')
     or not exists(select from public.profiles where id='14000000-0000-0000-0000-000000000002'
        and gym_filter_all and last_gym_id is null) then
    raise exception 'Incorrect initial preference after 0013'; end if;
  if not exists(select from public.workout_exercises we join public.sets s on s.workout_exercise_id=we.id
     where we.exercise_id='14000000-0000-0000-0000-000000000004' and s.weight_kg=42.5 and s.reps=8) then
    raise exception 'Migration lost set history'; end if;
end $$;
rollback;
