-- Repair a missing profile on the next verified request by that account.
-- No existing settings are overwritten and no other user's row is changed.
create or replace function public.ensure_current_profile()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_id uuid := auth.uid();
  result public.profiles;
begin
  if current_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  insert into public.profiles (id, display_name)
  select account.id,
    left(coalesce(
      nullif(account.raw_user_meta_data ->> 'full_name', ''),
      nullif(account.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(account.email, '@', 1), ''),
      'Athlete'
    ), 200)
  from auth.users as account
  where account.id = current_id
  on conflict (id) do nothing;

  select profile.* into result
  from public.profiles as profile where profile.id = current_id;
  if not found then
    raise exception 'Account unavailable' using errcode = '28000';
  end if;
  return result;
end;
$$;

-- Supabase can grant anon directly through its default privileges, so revoke
-- both PUBLIC and anon explicitly. The function accepts no account argument.
revoke all on function public.ensure_current_profile() from public, anon;
grant execute on function public.ensure_current_profile() to authenticated;
