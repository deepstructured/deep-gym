'use client'

import { useI18n } from '@/shared/i18n'
import { formatDay } from '@/shared/lib/dates'
import { formatWeight, type Unit } from '@/shared/lib/weight'
import { Card, IconFlame, IconNote, Tag } from '@/shared/ui'
import type { Workout } from '../model/types'
import clsx from 'clsx'
import s from './workout-card.module.scss'

interface WorkoutCardProps {
  workout: Workout
  unit: Unit
  showDate?: boolean
  className?: string
  onEdit?: () => void
  onDelete?: () => void
}

export function WorkoutCard({
  workout,
  unit,
  showDate,
  className,
  onEdit,
}: WorkoutCardProps) {
  const { t, tn } = useI18n()
  const totalSets = workout.workout_exercises.reduce(
    (sum, we) => sum + we.sets.length,
    0,
  )

  return (
    <Card
      onClick={onEdit}
      variant="surface"
      className={clsx(s.card, className)}
    >
      <div className={s.header}>
        <div className={s.headerText}>
          <p className={s.type}>{workout.type}</p>
          <p className={s.meta}>
            {showDate && <>{formatDay(workout.date)} · </>}
            {tn('count.exercises', workout.workout_exercises.length)} ·{' '}
            {tn('count.sets', totalSets)}
          </p>
        </div>
      </div>

      {workout.notes && (
        <p className={s.note}>
          <IconNote size={14} className={s.noteIcon} />
          {workout.notes}
        </p>
      )}

      <div className={s.exercises}>
        {workout.workout_exercises.map((we) => {
          const exerciseUnit = we.exercise?.unit ?? unit
          return (
            <div key={we.id}>
              <div className={s.exerciseHeader}>
                <p className={s.exerciseName}>
                  {we.exercise?.name ?? 'Exercise'}
                </p>
                {we.exercise && (
                  <Tag className={s.exerciseTag}>
                    {t(`equipment.${we.exercise.equipment}`)}
                  </Tag>
                )}
              </div>
              <div className={s.sets}>
                {we.sets.map((set) => (
                  <span key={set.id} className={s.set}>
                    <span className={s.setValue}>
                      {set.weight_kg != null
                        ? formatWeight(set.weight_kg, exerciseUnit).replace(
                            ` ${exerciseUnit}`,
                            '',
                          )
                        : '—'}
                    </span>
                    {exerciseUnit !== unit && (
                      <span className={s.setUnit}>{exerciseUnit}</span>
                    )}
                    <span className={s.setX}>×</span>
                    <span className={s.setValue}>{set.reps ?? '—'}</span>
                    {set.to_failure && (
                      <IconFlame size={12} className={s.flame} />
                    )}
                  </span>
                ))}
              </div>
              {we.notes && <p className={s.exerciseNote}>{we.notes}</p>}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
