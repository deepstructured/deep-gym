'use client'

import { format } from 'date-fns'
import Link from 'next/link'
import { useMemo } from 'react'
import { useI18n } from '@/shared/i18n'
import { fromISODate, getDateLocale } from '@/shared/lib/dates'
import { Card, IconCalendar, IconChevronRight } from '@/shared/ui'
import { predictNextWorkout } from '../model/predict'

interface NextWorkoutCardProps {
  workouts: { date: string; type: string }[] | undefined
}

/** "Next workout: Tuesday · Upper" — hidden until a weekly rhythm emerges. */
export function NextWorkoutCard({ workouts }: NextWorkoutCardProps) {
  const { t, lang } = useI18n()

  const prediction = useMemo(
    () => (workouts ? predictNextWorkout(workouts) : null),
    [workouts],
  )
  if (!prediction) return null

  const isToday = prediction.daysAway === 0
  // lang is read so the weekday re-renders on language switch
  void lang
  const when = isToday
    ? t('home.today')
    : prediction.daysAway === 1
      ? t('home.tomorrow')
      : capitalize(
          format(fromISODate(prediction.date), 'EEEE', {
            locale: getDateLocale(),
          }),
        )

  return (
    <Link
      href={`/workouts/new?type=${encodeURIComponent(prediction.type)}`}
      className="block"
    >
      <Card variant="surface" className="flex items-center gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime/10 text-lime">
          <IconCalendar size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium tracking-wide text-faint uppercase">
            {t('home.nextWorkout')}
          </span>
          <span className="mt-0.5 block truncate text-[17px] font-semibold">
            <span className={isToday ? 'text-lime' : undefined}>{when}</span>
            <span className="text-faint"> · </span>
            {prediction.type}
          </span>
        </span>
        <IconChevronRight size={18} className="shrink-0 text-faint" />
      </Card>
    </Link>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
