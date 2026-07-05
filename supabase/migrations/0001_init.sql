-- DeepGym — initial schema
-- Run this in the Supabase SQL Editor (or `supabase db push`).

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit text not null default 'kg' check (unit in ('kg', 'lb')),
  bar_weight_kg numeric not null default 20,
  -- plate denominations available in the gym, in their native unit
  plates_kg numeric[] not null default array[30, 25, 20, 15, 10, 5, 2.5, 2, 1.25],
  plates_lb numeric[] not null default '{}',
  telegram_id bigint unique,
  telegram_username text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Auto-create a profile for every new auth user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, telegram_id, telegram_username)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'telegram_username',
      split_part(coalesce(new.email, 'athlete'), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'telegram_id', '')::bigint,
    new.raw_user_meta_data ->> 'telegram_username'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ────────────────────────────────────────────────────────────────────────
-- MUSCLE GROUPS (rows with user_id = null are shared defaults)
-- ────────────────────────────────────────────────────────────────────────
create table public.muscle_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

alter table public.muscle_groups enable row level security;

create policy "muscle_groups: read defaults and own" on public.muscle_groups
  for select using (user_id is null or user_id = auth.uid());
create policy "muscle_groups: insert own" on public.muscle_groups
  for insert with check (user_id = auth.uid());
create policy "muscle_groups: update own" on public.muscle_groups
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "muscle_groups: delete own" on public.muscle_groups
  for delete using (user_id = auth.uid());

insert into public.muscle_groups (name, sort_order) values
  ('Back', 1),
  ('Chest', 2),
  ('Biceps', 3),
  ('Triceps', 4),
  ('Shoulders', 5),
  ('Legs', 6);

-- ────────────────────────────────────────────────────────────────────────
-- EXERCISES (per-user catalog)
-- ────────────────────────────────────────────────────────────────────────
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  muscle_group_id uuid not null references public.muscle_groups (id) on delete restrict,
  name text not null,
  -- dumbbell weights are logged per dumbbell (one hand)
  equipment text not null default 'free_weight'
    check (equipment in ('free_weight', 'dumbbell', 'machine', 'crossover')),
  machine_settings text,
  working_weight_kg numeric,
  -- display-unit override; null = use the profile default
  unit text check (unit in ('kg', 'lb')),
  created_at timestamptz not null default now()
);

create index exercises_user_idx on public.exercises (user_id, muscle_group_id);

alter table public.exercises enable row level security;

create policy "exercises: own" on public.exercises
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────
-- WORKOUTS
-- ────────────────────────────────────────────────────────────────────────
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'Full Body',
  date date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

create index workouts_user_date_idx on public.workouts (user_id, date desc);

alter table public.workouts enable row level security;

create policy "workouts: own" on public.workouts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position int not null default 0,
  notes text
);

create index workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

alter table public.workout_exercises enable row level security;

create policy "workout_exercises: own" on public.workout_exercises
  for all using (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workouts w
      where w.id = workout_id and w.user_id = auth.uid()
    )
  );

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  position int not null default 0,
  weight_kg numeric,
  reps int,
  to_failure boolean not null default false
);

create index sets_workout_exercise_idx on public.sets (workout_exercise_id);

alter table public.sets enable row level security;

create policy "sets: own" on public.sets
  for all using (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workout_exercises we
      join public.workouts w on w.id = we.workout_id
      where we.id = workout_exercise_id and w.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────
-- TELEGRAM AUTH (service-role only: RLS enabled, no policies)
-- ────────────────────────────────────────────────────────────────────────
create table public.telegram_links (
  telegram_id bigint primary key,
  chat_id bigint not null,
  username text,
  user_id uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create index telegram_links_username_idx on public.telegram_links (lower(username));

alter table public.telegram_links enable row level security;

create table public.telegram_otps (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index telegram_otps_telegram_idx on public.telegram_otps (telegram_id, created_at desc);

alter table public.telegram_otps enable row level security;
