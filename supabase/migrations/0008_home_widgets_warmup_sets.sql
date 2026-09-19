-- DeepGym — customizable home screen and warm-up sets.
-- Run this migration manually in the Supabase SQL Editor after 0007.

-- Home screen layout: ordered widget instances ({ version, widgets: [...] }).
-- NULL means the built-in default layout. The client validates the shape and
-- falls back to the default for anything it does not recognize.
alter table public.profiles
  add column if not exists home_widgets jsonb;

comment on column public.profiles.home_widgets is
  'Customized home screen layout (widget instances, sizes, order); null = default.';

-- Set kind. Warm-up sets are stored and displayed with the workout but are
-- excluded from every progress statistic on the client.
alter table public.sets
  add column if not exists set_type text not null default 'working';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sets_set_type_check'
      and conrelid = 'public.sets'::regclass
  ) then
    alter table public.sets
      add constraint sets_set_type_check
      check (set_type in ('working', 'warmup'));
  end if;
end
$$;

comment on column public.sets.set_type is
  'working = counts toward progress; warmup = logged but excluded from stats.';
