-- Compact Home data. Apply manually after 0009. No user-supplied owner ID;
-- SECURITY INVOKER retains the same RLS boundary as ordinary API reads.
create or replace function public.home_dashboard_summary(
  p_today date default current_date,
  p_records_since date default (current_date - interval '3 months')::date,
  p_muscle_since date default (current_date - interval '1 month')::date
)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with owned as materialized (
    select w.id, w.date, w.created_at
    from public.workouts w
    where w.user_id = (select auth.uid()) and w.date <= p_today
  ), occurrences as materialized (
    select we.id, we.workout_id, we.exercise_id, we.position, we.load_mode,
      w.date, w.created_at, e.name, e.unit, e.muscle_group_id,
      count(s.id)::integer as all_sets,
      count(s.id) filter (where s.set_type <> 'warmup')::integer as sets,
      coalesce(sum(s.reps) filter (where s.set_type <> 'warmup'), 0) as reps,
      coalesce(sum(s.weight_kg * s.reps) filter (
        where s.set_type <> 'warmup' and we.load_mode <> 'bodyweight'
      ), 0) as volume,
      max(s.weight_kg) filter (where s.set_type <> 'warmup' and we.load_mode <> 'bodyweight') as max_weight,
      max(s.weight_kg * (1 + s.reps::numeric / 30)) filter (
        where s.set_type <> 'warmup' and we.load_mode <> 'bodyweight' and s.reps > 0
      ) as max_one_rm,
      max(s.reps) filter (where s.set_type <> 'warmup') as max_reps
    from owned w join public.workout_exercises we on we.workout_id = w.id
    join public.exercises e on e.id = we.exercise_id
    left join public.sets s on s.workout_exercise_id = we.id
    group by we.id, we.workout_id, we.exercise_id, we.position, we.load_mode,
      w.date, w.created_at, e.name, e.unit, e.muscle_group_id
  ), activity as (
    select w.id, w.date, w.created_at,
      coalesce(sum(o.sets), 0) as sets, coalesce(sum(o.reps), 0) as reps,
      coalesce(sum(o.volume), 0) as volume
    from owned w left join occurrences o on o.workout_id = w.id
    group by w.id, w.date, w.created_at
  ), baselines as (
    select o.*,
      max(max_weight) over prior as prior_weight,
      max(max_one_rm) over prior as prior_one_rm,
      max(max_reps) over prior as prior_reps
    from occurrences o where o.sets > 0
    window prior as (partition by exercise_id order by date, created_at, workout_id, position, id
      rows between unbounded preceding and 1 preceding)
  ), record_candidates as (
    select b.*,
      case when load_mode = 'bodyweight' then
        case when max_reps > prior_reps then 'reps' end
      when max_weight > prior_weight + 0.000000001 then 'weight'
      when max_one_rm > prior_one_rm + 0.05 then 'oneRm' end as kind
    from baselines b where date >= p_records_since
  ), records as (
    select jsonb_build_object(
      'exerciseId', exercise_id, 'exerciseName', name, 'exerciseUnit', unit,
      'date', date, 'kind', kind,
      'value', case kind when 'reps' then max_reps when 'weight' then max_weight else max_one_rm end,
      'previous', case kind when 'reps' then prior_reps when 'weight' then prior_weight else prior_one_rm end
    ) as value, date, created_at, workout_id, position, id
    from record_candidates where kind is not null
    order by date desc, created_at desc, workout_id desc, position desc, id desc limit 5
  ), lift_candidates as (
    select o.exercise_id, o.name, o.unit, o.date, o.created_at, o.id,
      s.id as set_id, s.position, s.weight_kg, s.reps,
      s.weight_kg * (1 + s.reps::numeric / 30) as one_rm
    from occurrences o join public.sets s on s.workout_exercise_id = o.id
    where o.load_mode <> 'bodyweight' and s.set_type <> 'warmup'
      and s.weight_kg is not null and s.reps > 0
  ), best_per_exercise as (
    select distinct on (exercise_id) * from lift_candidates
    order by exercise_id, one_rm desc, date desc, created_at desc, id, position, set_id
  ), lifts as (
    select jsonb_build_object('exerciseId', exercise_id, 'exerciseName', name,
      'exerciseUnit', unit, 'date', date, 'oneRmKg', one_rm, 'weightKg', weight_kg, 'reps', reps) as value,
      one_rm, exercise_id
    from best_per_exercise order by one_rm desc, exercise_id limit 5
  ), recent_exercises as (
    select exercise_id, max(date) as last_date from occurrences where all_sets > 0 group by exercise_id
  ), muscles as (
    select muscle_group_id, sum(sets) as sets from occurrences
    where date >= p_muscle_since group by muscle_group_id
  )
  select jsonb_build_object(
    'total', (select count(*) from public.workouts where user_id = (select auth.uid())),
    'activity', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'date', date, 'sets', sets, 'reps', reps, 'volumeKg', volume
    ) order by date desc, created_at desc, id desc) from activity), '[]'::jsonb),
    'records', coalesce((select jsonb_agg(value order by date desc, created_at desc, workout_id desc, position desc, id desc) from records), '[]'::jsonb),
    'lifts', coalesce((select jsonb_agg(value order by one_rm desc, exercise_id) from lifts), '[]'::jsonb),
    'recentExerciseIds', coalesce((select jsonb_agg(exercise_id order by last_date desc, exercise_id) from recent_exercises), '[]'::jsonb),
    'muscleSets', coalesce((select jsonb_object_agg(muscle_group_id, sets) from muscles), '{}'::jsonb)
  );
$$;
-- Hosted Supabase can grant anon EXECUTE explicitly through default privileges;
-- revoking only PUBLIC would leave that separate grant in place.
revoke all on function public.home_dashboard_summary(date, date, date) from public, anon;
grant execute on function public.home_dashboard_summary(date, date, date) to authenticated;
