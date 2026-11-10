-- Apply manually after 0010. Empty drafts are retained as tombstones: removing
-- the row would let a delayed older request resurrect a saved/discarded draft.
create or replace function public.save_workout_draft(
  p_owner_id uuid,
  p_draft jsonb,
  p_updated_at timestamptz
)
returns table(draft jsonb, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_owner_id then
    raise exception 'Draft owner does not match the authenticated user' using errcode = '42501';
  end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' or p_updated_at is null then
    raise exception 'Invalid draft snapshot' using errcode = '22023';
  end if;

  return query
  insert into public.workout_drafts as current_draft (user_id, draft, updated_at)
  values (p_owner_id, p_draft, p_updated_at)
  on conflict (user_id) do update
  set draft = case when excluded.updated_at > current_draft.updated_at
      then excluded.draft else current_draft.draft end,
    updated_at = greatest(current_draft.updated_at, excluded.updated_at)
  returning current_draft.draft, current_draft.updated_at;
end;
$$;

revoke all on function public.save_workout_draft(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.save_workout_draft(uuid, jsonb, timestamptz) to authenticated;

comment on function public.save_workout_draft(uuid, jsonb, timestamptz) is
  'Atomically keep the newest owned draft, including empty-draft tombstones. RLS applies.';
