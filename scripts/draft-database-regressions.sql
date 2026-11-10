-- Runs only inside scripts/test-database.mjs's isolated temporary cluster.
begin;
insert into auth.users (id, email) values
  ('d0110000-0000-4000-8000-000000000001', 'draft-a@example.invalid'),
  ('d0110000-0000-4000-8000-000000000002', 'draft-b@example.invalid');
set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0110000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select * from public.save_workout_draft(
  'd0110000-0000-4000-8000-000000000001', '{"notes":"newer", "exercises":[]}', '2026-01-02T00:00:00Z');
select * from public.save_workout_draft(
  'd0110000-0000-4000-8000-000000000001', '{"notes":"delayed old write", "exercises":[]}', '2026-01-01T00:00:00Z');
do $$ begin
  if (select draft->>'notes' from public.workout_drafts where user_id = auth.uid()) <> 'newer' then
    raise exception 'A stale write replaced the newer draft';
  end if;
end $$;

select * from public.save_workout_draft(
  'd0110000-0000-4000-8000-000000000001', '{"notes":"", "exercises":[]}', '2026-01-03T00:00:00Z');
select * from public.save_workout_draft(
  'd0110000-0000-4000-8000-000000000001', '{"notes":"resurrected", "exercises":[]}', '2026-01-02T00:00:00Z');
do $$ begin
  if (select count(*) from public.workout_drafts where user_id = auth.uid() and draft->>'notes' = '') <> 1 then
    raise exception 'An old write resurrected a saved/discarded draft';
  end if;
  begin
    perform public.save_workout_draft('d0110000-0000-4000-8000-000000000002', '{}', now());
    raise exception 'A user wrote a draft under another user ID';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', 'd0110000-0000-4000-8000-000000000002', true);
do $$ begin
  if exists(select 1 from public.workout_drafts) then
    raise exception 'RLS exposed another user draft';
  end if;
end $$;
select * from public.save_workout_draft(
  'd0110000-0000-4000-8000-000000000002', '{"notes":"B", "exercises":[]}', '2026-01-04T00:00:00Z');
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin
    perform public.save_workout_draft('d0110000-0000-4000-8000-000000000002', '{}', now());
    raise exception 'An unauthenticated request wrote a draft';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
