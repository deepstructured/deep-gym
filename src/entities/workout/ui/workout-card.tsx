'use client'

import { equipmentLabel } from '@/shared/config/workout'
import { formatDay } from '@/shared/lib/dates'
import { formatWeight, type Unit } from '@/shared/lib/weight'
import {
  Card,
  IconEdit,
  IconFlame,
  IconNote,
  IconTrash,
  Tag,
} from '@/shared/ui'
import type { Workout } from '../model/types'
import clsx from 'clsx'
import s from './workout-card.module.scss'

interface WorkoutCardProps {
  workout: Workout
  unit: Unit
  showDate?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function WorkoutCard({
  workout,
  unit,
  showDate,
  onEdit,
  onDelete,
}: WorkoutCardProps) {
  const totalSets = workout.workout_exercises.reduce(
    (sum, we) => sum + we.sets.length,
    0,
  )

  return (
    <Card onClick={onEdit} variant="surface" className={clsx('p-4', s.card)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-lime">{workout.type}</p>
          <p className="mt-0.5 text-xs text-muted">
            {showDate && <>{formatDay(workout.date)} · </>}
            {workout.workout_exercises.length} exercises · {totalSets} sets
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {/* {onEdit && (
            <button
              type="button"
              aria-label="Edit workout"
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-muted"
            >
              <IconEdit size={15} />
            </button>
          )} */}
          {/* {onDelete && (
            <button
              type="button"
              aria-label="Delete workout"
              onClick={(ev) => {
                ev.stopPropagation()
                onDelete()
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-raised text-muted"
            >
              <IconTrash size={15} />
            </button>
          )} */}
        </div>
      </div>

      {workout.notes && (
        <p className="mb-3 flex items-start gap-1.5 rounded-tile bg-raised px-3 py-2 text-[13px] leading-relaxed text-muted">
          <IconNote size={14} className="mt-0.5 shrink-0" />
          {workout.notes}
        </p>
      )}

      <div className="space-y-3">
        {workout.workout_exercises.map((we) => {
          const exerciseUnit = we.exercise?.unit ?? unit
          return (
            <div key={we.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[15px] font-medium">
                  {we.exercise?.name ?? 'Exercise'}
                </p>
                {we.exercise && (
                  <Tag className="shrink-0">
                    {equipmentLabel(we.exercise.equipment)}
                  </Tag>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {we.sets.map((set) => (
                  <span
                    key={set.id}
                    className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2.5 py-1 text-xs"
                  >
                    <span className="font-dot">
                      {set.weight_kg != null
                        ? formatWeight(set.weight_kg, exerciseUnit).replace(
                            ` ${exerciseUnit}`,
                            '',
                          )
                        : '—'}
                    </span>
                    {exerciseUnit !== unit && (
                      <span className="text-[10px] text-faint">
                        {exerciseUnit}
                      </span>
                    )}
                    <span className="text-faint">×</span>
                    <span className="font-dot">{set.reps ?? '—'}</span>
                    {set.to_failure && (
                      <IconFlame size={12} className="text-flame" />
                    )}
                  </span>
                ))}
              </div>
              {we.notes && (
                <p className="mt-1.5 text-xs leading-relaxed text-faint">
                  {we.notes}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
