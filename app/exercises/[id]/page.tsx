import type { Metadata } from 'next'
import { ExerciseDetailView } from '@/views/exercise-detail'

export const metadata: Metadata = { title: 'Exercise' }

export default async function ExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ gym?: string | string[] }>
}) {
  const [{ id }, { gym }] = await Promise.all([params, searchParams])
  return <ExerciseDetailView exerciseId={id} initialGymId={typeof gym === 'string' ? gym : undefined} />
}
