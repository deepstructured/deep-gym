'use client'

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProfile, type TrainingSchedule } from '@/entities/user'
import { WorkoutCard, useWorkouts, type Workout } from '@/entities/workout'
import { FirstWorkoutSuccessSheet } from '@/features/first-workout'
import {
  ScheduledWorkoutCard,
  scheduledWorkoutOn,
  type ScheduledWorkout,
} from '@/features/next-workout'
import { useI18n } from '@/shared/i18n'
import { cn } from '@/shared/lib/cn'
import {
  formatDayFull,
  formatMonthYear,
  formatShort,
  fromISODate,
  getDateLocale,
  toISODate,
} from '@/shared/lib/dates'
import { AppShell } from '@/widgets/app-shell'
import {
  EmptyState,
  IconChevronLeft,
  IconChevronRight,
  PageLoader,
  Segmented,
} from '@/shared/ui'

type Mode = 'day' | 'week' | 'month'

export function HistoryView() {
  const router = useRouter()
  const { t } = useI18n()
  const { data: profile, isLoading: isProfileLoading } = useProfile()
  const [mode, setMode] = useState<Mode>('day')
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [showFirstWorkoutSuccess, setShowFirstWorkoutSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setShowFirstWorkoutSuccess(params.get('first') === '1')
  }, [])

  const dismissFirstWorkoutSuccess = useCallback(() => {
    setShowFirstWorkoutSuccess(false)
    const params = new URLSearchParams(window.location.search)
    params.delete('first')
    const query = params.toString()
    router.replace(`/history${query ? `?${query}` : ''}`, { scroll: false })
  }, [router])

  const unit = profile?.unit ?? 'kg'

  const range = useMemo(() => {
    if (mode === 'day') return { from: cursor, to: cursor }
    if (mode === 'week')
      return {
        from: startOfWeek(cursor, { weekStartsOn: 1 }),
        to: endOfWeek(cursor, { weekStartsOn: 1 }),
      }
    return { from: startOfMonth(cursor), to: endOfMonth(cursor) }
  }, [mode, cursor])

  const { data: workouts, isLoading } = useWorkouts(
    toISODate(range.from),
    toISODate(range.to),
  )

  const scheduledWorkout = useMemo(
    () => scheduledWorkoutOn(profile?.training_schedule, toISODate(cursor)),
    [profile?.training_schedule, cursor],
  )

  function shift(direction: -1 | 1) {
    if (mode === 'day') setCursor((d) => addDays(d, direction))
    else if (mode === 'week') setCursor((d) => addWeeks(d, direction))
    else setCursor((d) => addMonths(d, direction))
  }

  const heading =
    mode === 'day'
      ? formatDayFull(toISODate(cursor))
      : mode === 'week'
        ? `${formatShort(toISODate(range.from))} – ${formatShort(toISODate(range.to))}`
        : formatMonthYear(cursor)

  function workoutActions(workout: Workout) {
    return {
      onEdit: () => router.push(`/workouts/${workout.id}/edit`),
    }
  }

  return (
    <AppShell title={t('history.title')}>
      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: t('history.day') },
          { value: 'week', label: t('history.week') },
          { value: 'month', label: t('history.month') },
        ]}
      />

      {/* Period navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label={t('history.previous')}
          onClick={() => shift(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised text-muted"
        >
          <IconChevronLeft size={18} />
        </button>
        <button
          type="button"
          className="text-[15px] font-semibold"
          onClick={() => setCursor(new Date())}
        >
          {heading}
        </button>
        <button
          type="button"
          aria-label={t('history.next')}
          onClick={() => shift(1)}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-raised text-muted"
        >
          <IconChevronRight size={18} />
        </button>
      </div>

      {mode === 'week' && (
        <WeekStrip
          from={range.from}
          workouts={workouts ?? []}
          schedule={profile?.training_schedule}
          selected={cursor}
          onSelect={setCursor}
        />
      )}

      {mode === 'month' && (
        <MonthGrid
          cursor={cursor}
          workouts={workouts ?? []}
          schedule={profile?.training_schedule}
          onSelect={setCursor}
        />
      )}

      {isLoading || isProfileLoading ? (
        <PageLoader />
      ) : (
        <SelectedDayWorkouts
          cursor={cursor}
          mode={mode}
          workouts={workouts ?? []}
          scheduledWorkout={scheduledWorkout}
          unit={unit}
          actions={workoutActions}
        />
      )}

      <FirstWorkoutSuccessSheet
        open={showFirstWorkoutSuccess}
        onClose={dismissFirstWorkoutSuccess}
      />
    </AppShell>
  )
}

function WeekStrip({
  from,
  workouts,
  schedule,
  selected,
  onSelect,
}: {
  from: Date
  workouts: Workout[]
  schedule: TrainingSchedule | null | undefined
  selected: Date
  onSelect: (day: Date) => void
}) {
  const days = eachDayOfInterval({ start: from, end: addDays(from, 6) })
  const hasPlanned = days.some(
    (day) =>
      !workouts.some((workout) =>
        isSameDay(fromISODate(workout.date), day),
      ) && scheduledWorkoutOn(schedule, toISODate(day)) != null,
  )

  return (
    <div className="mb-5">
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const count = workouts.filter((w) =>
            isSameDay(fromISODate(w.date), day),
          ).length
          const planned =
            count === 0
              ? scheduledWorkoutOn(schedule, toISODate(day))
              : null
          const active = isSameDay(day, selected)
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(day)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-tile border py-2.5',
                active ? 'border-lime/60 bg-lime/10' : 'border-line bg-surface',
                isToday(day) && !active && 'border-faint',
              )}
            >
              <span className="text-[10px] font-medium text-faint uppercase">
                {format(day, 'EEEEE', { locale: getDateLocale() })}
              </span>
              <span
                className={cn(
                  'font-dot text-lg leading-none',
                  active ? 'text-lime' : 'text-text',
                )}
              >
                {format(day, 'd')}
              </span>
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full border',
                  count > 0
                    ? 'border-lime bg-lime'
                    : planned
                      ? 'border-cherry bg-cherry/10'
                      : 'border-transparent bg-transparent',
                )}
              />
            </button>
          )
        })}
      </div>
      {hasPlanned && <PlannedLegend />}
    </div>
  )
}

function MonthGrid({
  cursor,
  workouts,
  schedule,
  onSelect,
}: {
  cursor: Date
  workouts: Workout[]
  schedule: TrainingSchedule | null | undefined
  onSelect: (day: Date) => void
}) {
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const weekdayLetters = eachDayOfInterval({
    start: gridStart,
    end: addDays(gridStart, 6),
  }).map((day) => format(day, 'EEEEE', { locale: getDateLocale() }))
  const hasPlanned = days.some(
    (day) =>
      isSameMonth(day, cursor) &&
      !workouts.some((workout) =>
        isSameDay(fromISODate(workout.date), day),
      ) &&
      scheduledWorkoutOn(schedule, toISODate(day)) != null,
  )

  return (
    <div className="mb-5">
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-faint uppercase">
        {weekdayLetters.map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = workouts.filter((w) =>
            isSameDay(fromISODate(w.date), day),
          ).length
          const inMonth = isSameMonth(day, cursor)
          const planned =
            count === 0 && inMonth
              ? scheduledWorkoutOn(schedule, toISODate(day))
              : null
          const active = isSameDay(day, cursor)
          return (
            <button
              key={day.toISOString()}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(day)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-sm',
                active
                  ? 'border-lime/60 bg-lime/10'
                  : isToday(day)
                    ? 'border-faint'
                    : 'border-transparent',
                count > 0 && !active && !isToday(day) && 'bg-surface',
              )}
            >
              <span
                className={cn(
                  'font-dot leading-none',
                  inMonth ? 'text-text' : 'text-faint/50',
                )}
              >
                {format(day, 'd')}
              </span>
              <span className="flex h-1.5 items-center gap-0.5">
                {count > 0
                  ? Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-lime" />
                    ))
                  : planned && (
                      <span className="h-1.5 w-1.5 rounded-full border border-cherry bg-cherry/10" />
                    )}
              </span>
            </button>
          )
        })}
      </div>
      {hasPlanned && <PlannedLegend />}
    </div>
  )
}

function PlannedLegend() {
  const { t } = useI18n()
  return (
    <p className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-faint">
      <span className="h-1.5 w-1.5 rounded-full border border-cherry bg-cherry/10" />
      {t('history.plannedMarker')}
    </p>
  )
}

/** Workouts of the selected day. Actual logged workouts take priority; every
 *  future day in the explicit training week gets a scheduled-workout hint. */
function SelectedDayWorkouts({
  cursor,
  mode,
  workouts,
  scheduledWorkout,
  unit,
  actions,
}: {
  cursor: Date
  mode: Mode
  workouts: Workout[]
  scheduledWorkout: ScheduledWorkout | null
  unit: 'kg' | 'lb'
  actions: (workout: Workout) => { onEdit: () => void }
}) {
  const { t } = useI18n()
  const visible = workouts.filter((w) =>
    isSameDay(fromISODate(w.date), cursor),
  )

  if (visible.length === 0) {
    if (scheduledWorkout) {
      const today = isToday(cursor)
      return (
        <div className="space-y-3 pt-3">
          <p className="mx-auto max-w-64 text-center text-sm leading-relaxed text-muted">
            {t(today ? 'history.todayPlanned' : 'history.plannedDay')}
          </p>
          <ScheduledWorkoutCard
            prediction={scheduledWorkout}
            label={t('history.scheduled')}
          />
        </div>
      )
    }
    return (
      <EmptyState title={t('history.emptyTitle')} hint={t('history.emptyDay')} />
    )
  }

  return (
    <div className="space-y-4">
      {mode !== 'day' && (
        <p className="text-[13px] font-medium text-muted">
          {formatDayFull(toISODate(cursor))}
        </p>
      )}
      {visible.map((workout) => (
        <WorkoutCard
          key={workout.id}
          workout={workout}
          unit={unit}
          {...actions(workout)}
        />
      ))}
    </div>
  )
}
