'use client'

import { useState } from 'react'
import { useExercises } from '@/entities/exercise'
import { filterExercisesByGym } from '@deepgym/core/gym-data'
import { useDeleteGym, useGyms, useSaveGym, type Gym, type GymInput } from '@/entities/gym'
import type { Profile } from '@/entities/user'
import { useI18n } from '@/shared/i18n'
import { kgToUnit, roundWeight, unitToKg } from '@/shared/lib/weight'
import { Button, ErrorNote, Field, IconChevronRight, IconPlus, Input, QueryError, Sheet } from '@/shared/ui'
import { PlateFields } from './settings-sections'
import styles from './settings-view.module.scss'

export function GymSettingsSheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const { t, tn } = useI18n()
  const gyms = useGyms()
  const exercises = useExercises()
  const [editing, setEditing] = useState<Gym | 'new' | null>(null)
  const [busy, setBusy] = useState(false)

  return (
    <Sheet open onClose={() => { if (!busy) onClose() }} title={t(editing === 'new' ? 'gym.new' : editing ? 'gym.edit' : 'gym.title')}>
      {editing ? (
        <GymEditor
          profile={profile}
          gym={editing === 'new' ? null : editing}
          gyms={gyms.data ?? []}
          onBusy={setBusy}
          onDone={() => setEditing(null)}
        />
      ) : gyms.isError && !gyms.data ? (
        <QueryError message={t('gym.loadError')} retrying={gyms.isFetching} onRetry={() => void gyms.refetch()} />
      ) : (
        <div className={styles.sheetStack}>
          {gyms.isLoading ? <p role="status">{t('common.loading')}</p> : gyms.data?.length ? (
            <div className={styles.options}>
              {gyms.data.map(gym => (
                <button key={gym.id} type="button" className={styles.row} onClick={() => setEditing(gym)}>
                  <span className={styles.gymName}>{gym.name}</span>
                  {exercises.data && <span className={styles.rowValue}>{tn('count.exercises', filterExercisesByGym(exercises.data, gyms.data ?? [], gym.id).length)}</span>}
                  <IconChevronRight size={16} className={styles.chevron} />
                </button>
              ))}
            </div>
          ) : <p className={styles.cardHint}>{t('gym.empty')}</p>}
          <Button variant="lime" onClick={() => setEditing('new')} disabled={!gyms.data}>
            <IconPlus size={17} /> {t('gym.new')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function GymEditor({ profile, gym, gyms, onDone, onBusy }: {
  profile: Profile
  gym: Gym | null
  gyms: Gym[]
  onDone: () => void
  onBusy: (value: boolean) => void
}) {
  const { t } = useI18n()
  const exercises = useExercises()
  const save = useSaveGym()
  const remove = useDeleteGym()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [name, setName] = useState(gym?.name ?? '')
  const [query, setQuery] = useState('')
  const base = gym ?? profile
  const initialBar = String(roundWeight(kgToUnit(base.bar_weight_kg, profile.unit)))
  const [bar, setBar] = useState(initialBar)
  const [plates, setPlates] = useState({ plates_kg: base.plates_kg, plates_lb: base.plates_lb ?? [] })
  const [ids, setIds] = useState<string[]>(gym?.exercise_ids ?? [])
  const duplicate = gyms.some(item => item.id !== gym?.id && item.name.toLowerCase() === name.trim().toLowerCase())
  const displayBar = /^\d+(?:[.,]\d+)?$/.test(bar) ? Number(bar.replace(',', '.')) : NaN
  const barKg = bar === initialBar ? base.bar_weight_kg : Math.round(unitToKg(displayBar, profile.unit) * 100) / 100
  const validBar = Number.isFinite(barKg) && barKg >= 0 && barKg <= 1000
  const canSave = name.trim().length > 0 && !duplicate && validBar
  const visible = (exercises.data ?? []).filter(item => item.name.toLowerCase().includes(query.trim().toLowerCase()))
  const universalCount = exercises.data?.filter(exercise => exercise.is_universal !== false).length ?? 0

  async function submit() {
    if (!canSave || save.isPending) return
    const input: GymInput = { name: name.trim(), bar_weight_kg: barKg, ...plates, exercise_ids: ids }
    onBusy(true)
    try {
      await save.mutateAsync({ id: gym?.id, input })
      onDone()
    } catch {
      // Leave the form open so the user can retry with the same values.
    } finally {
      onBusy(false)
    }
  }

  async function deleteGym() {
    if (!gym || remove.isPending) return
    onBusy(true)
    try {
      await remove.mutateAsync(gym.id)
      onDone()
    } catch {
      // The confirmation stays open with a localized retry message.
    } finally {
      onBusy(false)
    }
  }

  if (confirmDelete && gym) {
    return (
      <div className={styles.sheetStack}>
        <p>{t('gym.removeConfirm', { name: gym.name })}</p>
        {remove.isError && <ErrorNote message={t('gym.removeError')} />}
        <div className={styles.gymActions}>
          <Button onClick={() => setConfirmDelete(false)} disabled={remove.isPending}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={remove.isPending} onClick={deleteGym}>{t('gym.remove')}</Button>
        </div>
      </div>
    )
  }

  return (
    <fieldset className={styles.gymEditor} disabled={save.isPending}>
      <Field label={t('gym.name')}>
        <Input value={name} maxLength={100} autoComplete="off" onChange={event => setName(event.target.value)} />
      </Field>
      {duplicate && <ErrorNote message={t('gym.duplicate')} />}
      <details className={styles.gymSection}>
        <summary>{t('gym.inventory')} <IconChevronRight size={16} /></summary>
        <PlateFields unit={profile.unit} barWeight={bar} onBarChange={setBar}
          platesKg={plates.plates_kg} platesLb={plates.plates_lb}
          onPlatesChange={patch => setPlates(current => ({ ...current, ...patch }))} />
      </details>
      <details className={styles.gymSection}>
        <summary>{t('gym.chooseExercises')} <span>{ids.length + universalCount}</span><IconChevronRight size={16} /></summary>
        <div className={styles.sheetStack}>
          <p className={styles.cardHint}>{t('gym.universalHint')}</p>
          <Input value={query} aria-label={t('picker.search')} placeholder={t('picker.search')} onChange={event => setQuery(event.target.value)} />
          {exercises.isError && !exercises.data ? (
            <QueryError retrying={exercises.isFetching} onRetry={() => void exercises.refetch()} />
          ) : exercises.isLoading ? <p role="status">{t('common.loading')}</p> : (
            <div className={styles.gymExercises}>
              {visible.map(exercise => (
                <label key={exercise.id}>
                  <input type="checkbox" disabled={exercise.is_universal !== false} checked={exercise.is_universal !== false || ids.includes(exercise.id)} onChange={event => {
                    const checked = event.target.checked
                    setIds(current => checked ? [...current, exercise.id] : current.filter(id => id !== exercise.id))
                  }} />
                  {exercise.name}
                </label>
              ))}
              {!visible.length && <p className={styles.cardHint}>{t('gym.noMatching')}</p>}
            </div>
          )}
        </div>
      </details>
      {!validBar && <ErrorNote message={t('gym.invalidBar', { max: roundWeight(kgToUnit(1000, profile.unit)), unit: profile.unit })} />}
      {save.isError && <ErrorNote message={t('gym.saveError')} />}
      <div className={styles.gymActions}>
        <Button onClick={onDone}>{t('common.cancel')}</Button>
        <Button variant="lime" disabled={!canSave} loading={save.isPending} onClick={submit}>{t('common.save')}</Button>
      </div>
      {gym && <Button variant="danger" onClick={() => setConfirmDelete(true)}>{t('gym.remove')}</Button>}
    </fieldset>
  )
}
