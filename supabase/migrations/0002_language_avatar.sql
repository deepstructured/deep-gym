-- DeepGym — user language + avatars
-- Run this in the Supabase SQL Editor (or `supabase db push`).

-- ────────────────────────────────────────────────────────────────────────
-- PROFILES: interface language + avatar
-- ────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists language text not null default 'en'
    check (language in ('en', 'ru', 'uk')),
  add column if not exists avatar_url text;

-- ────────────────────────────────────────────────────────────────────────
-- AVATARS storage bucket (public read; users manage files in their own
-- folder: avatars/<user_id>/...)
-- ────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars: insert own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: update own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: delete own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
