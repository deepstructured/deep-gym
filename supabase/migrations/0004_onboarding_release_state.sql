-- DeepGym — versioned onboarding and release-notes state.
-- Run this in the Supabase SQL Editor (or `supabase db push`).

alter table public.profiles
  add column if not exists onboarding_version integer not null default 0,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists last_seen_release_version integer not null default 0;

-- Existing athletes with workout history should not be forced through the
-- initial onboarding. Release notes deliberately stay unseen (sequence 0),
-- so everyone can receive the first versioned "What's new" announcement.
update public.profiles as profile
set
  onboarding_version = 1,
  onboarding_completed_at = coalesce(profile.onboarding_completed_at, now())
where profile.onboarding_version < 1
  and exists (
    select 1
    from public.workouts as workout
    where workout.user_id = profile.id
  );

comment on column public.profiles.onboarding_version is
  'Latest completed onboarding flow version; 0 means not completed.';
comment on column public.profiles.onboarding_completed_at is
  'Timestamp when the latest onboarding flow was completed.';
comment on column public.profiles.last_seen_release_version is
  'Latest release-notes sequence acknowledged by the user; 0 means none.';
