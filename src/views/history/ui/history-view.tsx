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
import { useMemo, useState } from 'react'
import { useProfile } from '@/entities/user'
import { WorkoutCard, useWorkouts, type Workout } from '@/entities/workout'
import { cn } from '@/shared/lib/cn'
import { formatDayFull, fromISODate, toISODate } from '@/shared/lib/dates'
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
  const { data: profile } = useProfile()
  const [mode, setMode] = useState<Mode>('day')
  const [cursor, setCursor] = useState<Date>(() => new Date())

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

  function shift(direction: -1 | 1) {
    if (mode === 'day') setCursor((d) => addDays(d, direction))
    else if (mode === 'week') setCursor((d) => addWeeks(d, direction))
    else setCursor((d) => addMonths(d, direction))
  }

  const heading =
    mode === 'day'
      ? formatDayFull(toISODate(cursor))
      : mode === 'week'
        ? `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d')}`
        : format(cursor, 'MMMM yyyy')

  function workoutActions(workout: Workout) {
    return {
      onEdit: () => router.push(`/workouts/${workout.id}/edit`),
    }
  }

  return (
    <AppShell title="History">
      <Segmented
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: 'Day' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />

      {/* Period navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous"
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
          aria-label="Next"
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
          selected={cursor}
          onSelect={setCursor}
        />
      )}

      {mode === 'month' && (
        <MonthGrid
          cursor={cursor}
          workouts={workouts ?? []}
          onSelect={(day) => {
            setCursor(day)
            setMode('day')
          }}
        />
      )}

      {isLoading ? (
        <PageLoader />
      ) : (
        <WorkoutList
          mode={mode}
          cursor={cursor}
          workouts={workouts ?? []}
          unit={unit}
          actions={workoutActions}
        />
      )}
    </AppShell>
  )
}

function WeekStrip({
  from,
  workouts,
  selected,
  onSelect,
}: {
  from: Date
  workouts: Workout[]
  selected: Date
  onSelect: (day: Date) => void
}) {
  const days = eachDayOfInterval({ start: from, end: addDays(from, 6) })

  return (
    <div className="mb-5 grid grid-cols-7 gap-1.5">
      {days.map((day) => {
        const count = workouts.filter((w) =>
          isSameDay(fromISODate(w.date), day),
        ).length
        const active = isSameDay(day, selected)
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelect(day)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-tile border py-2.5',
              active ? 'border-lime/60 bg-lime/10' : 'border-line bg-surface',
              isToday(day) && !active && 'border-faint',
            )}
          >
            <span className="text-[10px] font-medium text-faint uppercase">
              {format(day, 'EEEEE')}
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
                'h-1.5 w-1.5 rounded-full',
                count > 0 ? 'bg-lime' : 'bg-transparent',
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

function MonthGrid({
  cursor,
  workouts,
  onSelect,
}: {
  cursor: Date
  workouts: Workout[]
  onSelect: (day: Date) => void
}) {
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div className="mb-5">
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-medium text-faint uppercase">
        {['M', 'T', 'W', 'T2', 'F', 'S', 'S2'].map((d) => (
          <span key={d}>{d.replace('2', '')}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const count = workouts.filter((w) =>
            isSameDay(fromISODate(w.date), day),
          ).length
          const inMonth = isSameMonth(day, cursor)
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl border text-sm',
                isToday(day)
                  ? 'border-lime/50 bg-lime/10'
                  : 'border-transparent',
                count > 0 && !isToday(day) && 'bg-surface',
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
              <span className="flex gap-0.5">
                {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                  <span key={i} className="h-1 w-1 rounded-full bg-lime" />
                ))}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function WorkoutList({
  mode,
  cursor,
  workouts,
  unit,
  actions,
}: {
  mode: Mode
  cursor: Date
  workouts: Workout[]
  unit: 'kg' | 'lb'
  actions: (workout: Workout) => { onEdit: () => void }
}) {
  const visible =
    mode === 'day'
      ? workouts.filter((w) => isSameDay(fromISODate(w.date), cursor))
      : workouts

  if (visible.length === 0) {
    return (
      <EmptyState
        title="No workouts here"
        hint={
          mode === 'day'
            ? 'Rest day — or time to change that.'
            : 'Nothing logged in this period yet.'
        }
      />
    )
  }

  if (mode === 'day') {
    return (
      <div className="space-y-4">
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

  // week / month — group by date
  const byDate = new Map<string, Workout[]>()
  for (const workout of visible) {
    byDate.set(workout.date, [...(byDate.get(workout.date) ?? []), workout])
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-6">
      {dates.map((date) => (
        <div key={date}>
          <p className="mb-2 text-[13px] font-medium text-muted">
            {formatDayFull(date)}
          </p>
          <div className="space-y-4">
            {byDate.get(date)!.map((workout) => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                unit={unit}
                {...actions(workout)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
