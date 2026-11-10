-- Only for the isolated PostgreSQL harness; all synthetic fixtures roll back.
begin;
insert into auth.users(id,email) values
  ('a0000000-0000-0000-0000-000000000001','summary-a@example.test'),
  ('a0000000-0000-0000-0000-000000000002','summary-b@example.test');
insert into public.exercises(id,user_id,muscle_group_id,name,equipment)
select 'b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',id,'Summary bench','free_weight'
from public.muscle_groups where name='Chest' and user_id is null limit 1;
insert into public.exercises(id,user_id,muscle_group_id,name,equipment)
select 'b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',id,'Summary pullup','bodyweight'
from public.muscle_groups where name='Back' and user_id is null limit 1;
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare
  summary jsonb;
  baseline jsonb := '{"type":"Summary","date":"2025-01-01","exercises":[{"exercise_id":"b0000000-0000-0000-0000-000000000001","load_mode":"external","sets":[{"weight_kg":100,"reps":5,"set_type":"working"},{"weight_kg":1000,"reps":100,"set_type":"warmup"}]},{"exercise_id":"b0000000-0000-0000-0000-000000000002","load_mode":"bodyweight","sets":[{"weight_kg":90,"reps":20,"set_type":"working"}]}]}';
  current_workout jsonb := '{"type":"Summary","date":"2026-11-09","exercises":[{"exercise_id":"b0000000-0000-0000-0000-000000000001","load_mode":"external","sets":[{"weight_kg":110,"reps":5,"set_type":"working"}]},{"exercise_id":"b0000000-0000-0000-0000-000000000002","load_mode":"bodyweight","sets":[{"weight_kg":90,"reps":25,"set_type":"working"}]}]}';
  later_workout jsonb := '{"type":"Summary","date":"2026-11-10","exercises":[{"exercise_id":"b0000000-0000-0000-0000-000000000001","load_mode":"external","sets":[{"weight_kg":105,"reps":10,"set_type":"working"}]}]}';
  chest_id text;
begin
  perform public.save_workout_atomic(baseline,null,'c0000000-0000-0000-0000-000000000001');
  perform public.save_workout_atomic(current_workout,null,'c0000000-0000-0000-0000-000000000002');
  perform public.save_workout_atomic(later_workout,null,'c0000000-0000-0000-0000-000000000003');
  -- Future workouts count toward total but do not contaminate today's metrics.
  perform public.save_workout_atomic(jsonb_set(later_workout,'{date}','"2026-11-11"'),null,'c0000000-0000-0000-0000-000000000004');
  summary := public.home_dashboard_summary('2026-11-10','2026-08-10','2026-10-10');
  if (summary->>'total')::integer <> 4 or jsonb_array_length(summary->'activity') <> 3 then
    raise exception 'Summary workout completeness/date boundary failed: %', summary;
  end if;
  if (select sum((r->>'sets')::integer) from jsonb_array_elements(summary->'activity') r) <> 5
    or (select sum((r->>'reps')::integer) from jsonb_array_elements(summary->'activity') r) <> 65
    or (select sum((r->>'volumeKg')::numeric) from jsonb_array_elements(summary->'activity') r) <> 2100 then
    raise exception 'Warmup/bodyweight aggregate semantics changed: %', summary;
  end if;
  if jsonb_array_length(summary->'records') <> 3
    or not exists(select 1 from jsonb_array_elements(summary->'records') r where r->>'kind'='weight' and (r->>'value')::numeric=110 and (r->>'previous')::numeric=100)
    or not exists(select 1 from jsonb_array_elements(summary->'records') r where r->>'kind'='reps' and (r->>'value')::numeric=25 and (r->>'previous')::numeric=20)
    or not exists(select 1 from jsonb_array_elements(summary->'records') r where r->>'kind'='oneRm' and abs((r->>'value')::numeric-140)<0.000001) then
    raise exception 'All-time record baseline or record precedence changed: %', summary;
  end if;
  if jsonb_array_length(summary->'lifts') <> 1 or abs((summary#>>'{lifts,0,oneRmKg}')::numeric-140)>0.000001 then
    raise exception 'Strongest lift includes warmup/bodyweight or misses historical max: %', summary;
  end if;
  select muscle_group_id::text into chest_id from public.exercises where id='b0000000-0000-0000-0000-000000000001';
  if (summary->'muscleSets'->>chest_id)::integer <> 2 or jsonb_array_length(summary->'recentExerciseIds')<>2 then
    raise exception 'Recent muscle/selection aggregates incorrect: %', summary;
  end if;
  perform set_config('request.jwt.claim.sub','a0000000-0000-0000-0000-000000000002',true);
  summary := public.home_dashboard_summary('2026-11-10','2026-08-10','2026-10-10');
  if (summary->>'total')::integer <> 0 or summary->'activity' <> '[]'::jsonb
    or summary->'records' <> '[]'::jsonb or summary->'lifts' <> '[]'::jsonb
    or summary->'muscleSets' <> '{}'::jsonb then
    raise exception 'Summary leaked another user data: %', summary;
  end if;
  if has_function_privilege('anon','public.home_dashboard_summary(date,date,date)','EXECUTE') then
    raise exception 'Anonymous role can execute private summary';
  end if;
end $$;
rollback;
