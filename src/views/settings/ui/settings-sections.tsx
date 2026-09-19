'use client'

import { useEffect, useRef, useState } from 'react'
import {
  useCreateMuscleGroup,
  useDeleteMuscleGroup,
  useMuscleGroups,
} from '@/entities/muscle-group'
import { useProfile, useUpdateProfile } from '@/entities/user'
import {
  AvatarPresetGrid,
  useRemoveAvatar,
  useSetPresetAvatar,
  useUploadAvatar,
} from '@/features/avatar'
import { useI18n } from '@/shared/i18n'
import { cn } from '@/shared/lib/cn'
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from '@/shared/lib/weight'
import {
  Avatar,
  Button,
  ConfirmSheet,
  ErrorNote,
  Field,
  IconChevronDown,
  IconClose,
  IconPlus,
  Input,
  Tag,
} from '@/shared/ui'
import styles from './settings-view.module.scss'

// Editors opened from the settings list. Each one saves on its own, so the
// hosting sheet can close at any time without losing input.

/** Bar weight and the plate denominations available in the gym. */
export function PlatesSettings() {
  const { t } = useI18n()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const unit: Unit = profile?.unit ?? 'kg'
  const [barWeight, setBarWeight] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [newPlateUnit, setNewPlateUnit] = useState<Unit>(unit)

  useEffect(() => {
    if (profile) {
      setBarWeight(
        String(roundWeight(kgToUnit(profile.bar_weight_kg, profile.unit))),
      )
    }
  }, [profile])

  if (!profile) return null

  // combined plate list, heaviest first, each in its native denomination
  const plates: { value: number; unit: Unit; kg: number }[] = [
    ...profile.plates_kg.map((value) => ({
      value,
      unit: 'kg' as Unit,
      kg: value,
    })),
    ...(profile.plates_lb ?? []).map((value) => ({
      value,
      unit: 'lb' as Unit,
      kg: unitToKg(value, 'lb'),
    })),
  ].sort((a, b) => b.kg - a.kg)

  function saveBarWeight() {
    const parsed = parseWeight(barWeight)
    if (parsed != null) {
      updateProfile.mutate({
        bar_weight_kg: Math.round(unitToKg(parsed, unit) * 100) / 100,
      })
    }
  }

  function addPlate() {
    const parsed = parseWeight(newPlate)
    if (parsed == null || !profile) return
    if (newPlateUnit === 'kg') {
      if (!profile.plates_kg.includes(parsed)) {
        updateProfile.mutate({ plates_kg: [...profile.plates_kg, parsed] })
      }
    } else {
      const platesLb = profile.plates_lb ?? []
      if (!platesLb.includes(parsed)) {
        updateProfile.mutate({ plates_lb: [...platesLb, parsed] })
      }
    }
    setNewPlate('')
  }

  function removePlate(plate: { value: number; unit: Unit }) {
    if (!profile) return
    if (plate.unit === 'kg') {
      updateProfile.mutate({
        plates_kg: profile.plates_kg.filter((p) => p !== plate.value),
      })
    } else {
      updateProfile.mutate({
        plates_lb: (profile.plates_lb ?? []).filter((p) => p !== plate.value),
      })
    }
  }

  return (
    <div className={styles.sheetStack}>
      <p className={styles.cardHint}>{t('settings.plateCalcHint')}</p>

      <Field label={t('settings.barWeight', { unit })}>
        <Input
          value={barWeight}
          onChange={(e) =>
            setBarWeight(e.target.value.replace(/[^\d.,]/g, ''))
          }
          onBlur={saveBarWeight}
          inputMode="decimal"
          className={styles.barInput}
        />
      </Field>

      <div className={styles.chipsWrap}>
        {plates.map((plate) => (
          <span
            key={`${plate.unit}-${plate.value}`}
            className={styles.plateChip}
          >
            <span className={styles.plateValue}>{plate.value}</span>
            <span className={styles.plateUnit}>{plate.unit}</span>
            <button
              type="button"
              aria-label={t('settings.removePlate', {
                plate: `${plate.value} ${plate.unit}`,
              })}
              onClick={() => removePlate(plate)}
              className={styles.chipRemove}
            >
              <IconClose size={14} />
            </button>
          </span>
        ))}
      </div>

      <div className={styles.addRow}>
        <Input
          value={newPlate}
          onChange={(e) =>
            setNewPlate(e.target.value.replace(/[^\d.,]/g, ''))
          }
          onKeyDown={(e) => e.key === 'Enter' && addPlate()}
          inputMode="decimal"
          placeholder={t('settings.plateWeight')}
          className={styles.addInput}
        />
        <div className={styles.unitSwitch}>
          {(['kg', 'lb'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setNewPlateUnit(option)}
              className={cn(
                styles.unitOption,
                newPlateUnit === option && styles.unitOptionActive,
              )}
            >
              {option}
            </button>
          ))}
        </div>
        <Button variant="surface" size="compact" onClick={addPlate}>
          <IconPlus size={16} />
          {t('common.add')}
        </Button>
      </div>
    </div>
  )
}

/** Display name, saved on blur. */
export function ProfileNameField({ value }: { value: string }) {
  const { t } = useI18n()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()
  const [name, setName] = useState(value)

  function save() {
    if (name.trim() && name.trim() !== profile?.display_name) {
      updateProfile.mutate({ display_name: name.trim() })
    }
  }

  return (
    <>
      <Field label={t('settings.displayName')}>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={save}
          placeholder={t('settings.yourName')}
        />
      </Field>
      {profile?.telegram_username && (
        <p className={styles.telegramNote}>
          Telegram: <Tag>@{profile.telegram_username}</Tag>
        </p>
      )}
    </>
  )
}

export function AvatarEditor({
  avatarUrl,
  displayName,
}: {
  avatarUrl: string | null
  displayName: string | null
}) {
  const { t } = useI18n()
  const upload = useUploadAvatar()
  const removeAvatar = useRemoveAvatar()
  const setPreset = useSetPresetAvatar()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    setError(null)
    upload.mutate(file, {
      onError: (err) => setError((err as Error).message),
    })
  }

  const busy =
    upload.isPending || removeAvatar.isPending || setPreset.isPending

  return (
    <div className={styles.avatarEditor}>
      <div className={styles.avatarRow}>
        <Avatar src={avatarUrl} size={72} alt={displayName ?? ''} />
        <div className={styles.avatarActions}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className={styles.fileInput}
            onChange={onFileChange}
          />
          <Button
            variant="surface"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            loading={upload.isPending}
            disabled={busy}
          >
            {t('settings.uploadPhoto')}
          </Button>
          {avatarUrl != null && (
            <button
              type="button"
              className={styles.useDefault}
              disabled={busy}
              onClick={() => {
                setError(null)
                removeAvatar.mutate(undefined, {
                  onError: (err) => setError((err as Error).message),
                })
              }}
            >
              {t('settings.useDefault')}
            </button>
          )}
          <p className={styles.avatarHint}>{t('settings.avatarHint')}</p>
        </div>
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showPresets}
          onClick={() => setShowPresets((value) => !value)}
          className={styles.presetsToggle}
        >
          {t('settings.chooseAvatar')}
          <IconChevronDown
            size={16}
            className={cn(
              styles.presetsChevron,
              showPresets && styles.presetsChevronOpen,
            )}
          />
        </button>

        {showPresets && (
          <AvatarPresetGrid
            value={avatarUrl}
            disabled={busy}
            className={styles.presetsGrid}
            onSelect={(url) => {
              setError(null)
              if (url === null) {
                removeAvatar.mutate(undefined, {
                  onError: (err) => setError((err as Error).message),
                })
              } else {
                setPreset.mutate(url, {
                  onError: (err) => setError((err as Error).message),
                })
              }
            }}
          />
        )}
      </div>

      {error && <ErrorNote message={error} />}
    </div>
  )
}

export function MuscleGroupsSettings() {
  const { t } = useI18n()
  const { data: groups } = useMuscleGroups()
  const createGroup = useCreateMuscleGroup()
  const deleteGroup = useDeleteMuscleGroup()
  const [newGroup, setNewGroup] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function add() {
    const name = newGroup.trim()
    if (!name) return
    createGroup.mutate(name, { onSuccess: () => setNewGroup('') })
  }

  const pending = groups?.find((g) => g.id === deleteId)

  return (
    <div className={styles.sheetStack}>
      <p className={styles.cardHint}>{t('settings.muscleGroupsHint')}</p>

      <div className={styles.chipsWrap}>
        {groups?.map((group) => (
          <span
            key={group.id}
            className={styles.groupChip}
          >
            {group.name}
            {group.user_id != null && (
              <button
                type="button"
                aria-label={t('settings.deleteGroup', { name: group.name })}
                onClick={() => setDeleteId(group.id)}
                className={styles.chipRemove}
              >
                <IconClose size={14} />
              </button>
            )}
          </span>
        ))}
      </div>

      <div className={styles.addRow}>
        <Input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={t('settings.newGroup')}
          className={styles.addInput}
        />
        <Button
          variant="surface"
          size="compact"
          onClick={add}
          loading={createGroup.isPending}
        >
          <IconPlus size={16} />
          {t('common.add')}
        </Button>
      </div>

      <ConfirmSheet
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title={t('settings.deleteGroup', { name: pending?.name ?? '' })}
        message={t('settings.deleteGroupMessage')}
        loading={deleteGroup.isPending}
        onConfirm={() => {
          if (!deleteId) return
          deleteGroup.mutate(deleteId, {
            onSuccess: () => setDeleteId(null),
            onError: () => setDeleteId(null),
          })
        }}
      />
    </div>
  )
}
