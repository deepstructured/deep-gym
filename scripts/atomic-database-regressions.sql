-- Synthetic fixtures in the isolated test-database.mjs cluster only.
begin;
insert into auth.users(id,email) values
  ('10000000-0000-0000-0000-000000000001','atomic-a@example.test'),
  ('10000000-0000-0000-0000-000000000002','atomic-b@example.test');
insert into public.exercises(id,user_id,muscle_group_id,name,equipment)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',id,'Atomic bench','free_weight'
from public.muscle_groups where name='Chest' and user_id is null limit 1;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare
  payload jsonb := '{"type":"Chest","date":"2026-11-10","exercises":[{"exercise_id":"20000000-0000-0000-0000-000000000001","load_mode":"external","sets":[{"weight_kg":80,"reps":8,"set_type":"working"},{"weight_kg":20,"reps":10,"set_type":"warmup","to_failure":true}]}]}';
  workout_id uuid;
  repeated_id uuid;
  invalid_payload jsonb;
begin
  workout_id := public.save_workout_atomic(payload,null,'30000000-0000-0000-0000-000000000001');
  repeated_id := public.save_workout_atomic(payload,null,'30000000-0000-0000-0000-000000000001');
  if workout_id <> repeated_id or (select count(*) from public.workouts) <> 1 then
    raise exception 'Lost-response retry created a duplicate';
  end if;
  if exists(select 1 from public.sets where set_type='warmup' and to_failure) then
    raise exception 'Warmup failure semantics changed';
  end if;
  -- Invalid set type fails AFTER update/delete in the RPC. Verify rollback.
  invalid_payload := jsonb_set(payload, '{exercises,0,sets,0,set_type}', '"invalid"');
  begin
    perform public.save_workout_atomic(invalid_payload,workout_id,null);
    raise exception 'Invalid edit unexpectedly succeeded';
  exception when invalid_parameter_value then null;
  end;
  if (select count(*) from public.sets) <> 2 or not exists(select 1 from public.sets where weight_kg=80 and reps=8) then
    raise exception 'Failed edit lost previously saved sets';
  end if;
  begin
    perform public.save_workout_atomic(jsonb_set(payload,'{type}','"Changed"'),null,'30000000-0000-0000-0000-000000000001');
    raise exception 'Different payload incorrectly reused an idempotency key';
  exception when unique_violation then null;
  end;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
  if (select count(*) from public.workouts) <> 0 or (select count(*) from public.sets) <> 0 then
    raise exception 'Second user can read first user data';
  end if;
  begin
    perform public.save_workout_atomic(payload,workout_id,null);
    raise exception 'Second user edited first user workout';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
