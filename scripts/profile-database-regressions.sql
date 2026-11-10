-- Synthetic fixtures only; executed by test-database.mjs, never production.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
  ('d0120000-0000-4000-8000-000000000001','profile-a@example.invalid','{"full_name":"Initial"}'),
  ('d0120000-0000-4000-8000-000000000002','profile-b@example.invalid','{"full_name":"Other account"}');
update public.profiles set unit='lb',display_name='Preserve B'
where id='d0120000-0000-4000-8000-000000000002';
insert into public.workouts(id,user_id,type,date) values
  ('d0120000-0000-4000-8000-000000000003','d0120000-0000-4000-8000-000000000001','History','2026-01-01');
delete from public.profiles where id='d0120000-0000-4000-8000-000000000001';
-- Editable metadata must never establish a Telegram identity during repair.
update auth.users set raw_user_meta_data='{"full_name":"Repaired","telegram_id":"123456","telegram_username":"forged"}'
where id='d0120000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','d0120000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);
do $$
declare repaired public.profiles;
begin
  repaired := public.ensure_current_profile();
  if repaired.id <> auth.uid() or repaired.display_name <> 'Repaired' or repaired.unit <> 'kg'
    or repaired.telegram_id is not null or repaired.telegram_username is not null then
    raise exception 'Missing profile repair produced invalid/default/identity data';
  end if;
  if (select count(*) from public.workouts) <> 1 then raise exception 'Repair changed workout history'; end if;
  update public.profiles set unit='lb',display_name='Preserve A' where id=auth.uid();
  repaired := public.ensure_current_profile();
  if repaired.unit <> 'lb' or repaired.display_name <> 'Preserve A' then
    raise exception 'Repeated repair overwrote existing settings';
  end if;
  if exists(select 1 from public.profiles where id<>auth.uid()) then raise exception 'Profile RLS exposed another account'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.ensure_current_profile();
    raise exception 'Unauthenticated repair succeeded';
  exception when invalid_authorization_specification then null;
  end;
end $$;
reset role;
do $$ begin
  if not exists(select 1 from public.profiles where id='d0120000-0000-4000-8000-000000000002' and unit='lb' and display_name='Preserve B') then
    raise exception 'Repair changed another account';
  end if;
  if has_function_privilege('anon','public.ensure_current_profile()','EXECUTE') then raise exception 'Anonymous execute grant survived'; end if;
end $$;
set local role anon;
do $$ begin
  begin
    perform public.ensure_current_profile();
    raise exception 'Anonymous role executed repair';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
