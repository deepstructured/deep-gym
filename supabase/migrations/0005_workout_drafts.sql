-- DeepGym — cloud copy of the in-progress "new workout" draft.
-- Run this in the Supabase SQL Editor (or `supabase db push`).
--
-- One row per user. `updated_at` is stamped by the writing client so that
-- devices can resolve conflicts with last-write-wins; localStorage remains
-- the instant/offline source on each device.

create table public.workout_drafts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.workout_drafts enable row level security;

create policy "workout_drafts: own" on public.workout_drafts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.workout_drafts is
  'Unsaved new-workout form drafts, synced across devices (one per user).';
comment on column public.workout_drafts.updated_at is
  'Client-stamped time of the last edit; cross-device last-write-wins.';
