-- DeepGym — explicit user-managed weekly training schedule.
-- Indexes in the array are Monday (1) through Sunday (7); a NULL element is
-- a rest day. The whole column is NULL until the user configures the week.

alter table public.profiles
  add column if not exists training_schedule text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_training_schedule_seven_days'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_training_schedule_seven_days
      check (
        training_schedule is null
        or (
          cardinality(training_schedule) = 7
          and array_lower(training_schedule, 1) = 1
        )
      );
  end if;
end
$$;

comment on column public.profiles.training_schedule is
  'Seven workout types from Monday to Sunday; NULL items are rest days.';
