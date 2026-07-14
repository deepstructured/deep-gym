'use client'

import { useEffect, useRef, useState } from 'react'
import {
  useCreateMuscleGroup,
  useDeleteMuscleGroup,
  useMuscleGroups,
} from '@/entities/muscle-group'
import { useProfile, useUpdateProfile } from '@/entities/user'
import {
  PRESET_AVATARS,
  useRemoveAvatar,
  useSetPresetAvatar,
  useUploadAvatar,
} from '@/features/avatar'
import { SignOutButton } from '@/features/auth'
import { LANGUAGE_OPTIONS, useI18n, type Lang } from '@/shared/i18n'
import { cn } from '@/shared/lib/cn'
import {
  kgToUnit,
  parseWeight,
  roundWeight,
  unitToKg,
  type Unit,
} from '@/shared/lib/weight'
import { AppShell } from '@/widgets/app-shell'
import {
  Avatar,
  Button,
  Card,
  ConfirmSheet,
  ErrorNote,
  Field,
  IconClose,
  IconPlus,
  Input,
  PageLoader,
  Segmented,
  Tag,
} from '@/shared/ui'

export function SettingsView() {
  const { t, lang, setLang } = useI18n()
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const [name, setName] = useState('')
  const [barWeight, setBarWeight] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [newPlateUnit, setNewPlateUnit] = useState<Unit>('kg')

  const unit: Unit = profile?.unit ?? 'kg'

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? '')
      setBarWeight(
        String(roundWeight(kgToUnit(profile.bar_weight_kg, profile.unit))),
      )
    }
  }, [profile])

  if (isLoading || !profile) {
    return (
      <AppShell title={t('settings.title')}>
        <PageLoader />
      </AppShell>
    )
  }

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

  function saveName() {
    if (name.trim() && name.trim() !== profile?.display_name) {
      updateProfile.mutate({ display_name: name.trim() })
    }
  }

  function saveBarWeight() {
    const parsed = parseWeight(barWeight)
    if (parsed != null) {
      updateProfile.mutate({
        bar_weight_kg: Math.round(unitToKg(parsed, unit) * 100) / 100,
      })
    }
  }

  function changeLanguage(next: Lang) {
    setLang(next)
    updateProfile.mutate({ language: next })
  }

  function addPlate() {
    const parsed = parseWeight(newPlate)
    if (parsed == null) return
    if (newPlateUnit === 'kg') {
      if (!profile!.plates_kg.includes(parsed)) {
        updateProfile.mutate({ plates_kg: [...profile!.plates_kg, parsed] })
      }
    } else {
      const platesLb = profile!.plates_lb ?? []
      if (!platesLb.includes(parsed)) {
        updateProfile.mutate({ plates_lb: [...platesLb, parsed] })
      }
    }
    setNewPlate('')
  }

  function removePlate(plate: { value: number; unit: Unit }) {
    if (plate.unit === 'kg') {
      updateProfile.mutate({
        plates_kg: profile!.plates_kg.filter((p) => p !== plate.value),
      })
    } else {
      updateProfile.mutate({
        plates_lb: (profile!.plates_lb ?? []).filter((p) => p !== plate.value),
      })
    }
  }

  return (
    <AppShell title={t('settings.title')}>
      <div className="space-y-5">
        {/* Profile */}
        <Card variant="surface" className="space-y-4 p-4">
          <p className="text-sm font-semibold">{t('settings.profile')}</p>

          <AvatarEditor
            avatarUrl={profile.avatar_url}
            displayName={profile.display_name}
          />

          <Field label={t('settings.displayName')}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              placeholder={t('settings.yourName')}
            />
          </Field>
          {profile.telegram_username && (
            <p className="text-sm text-muted">
              Telegram: <Tag>@{profile.telegram_username}</Tag>
            </p>
          )}
        </Card>

        {/* Language */}
        <Card variant="surface" className="space-y-3 p-4">
          <p className="text-sm font-semibold">{t('settings.language')}</p>
          <Segmented
            value={lang}
            onChange={changeLanguage}
            options={LANGUAGE_OPTIONS}
          />
        </Card>

        {/* Units */}
        <Card variant="surface" className="space-y-3 p-4">
          <p className="text-sm font-semibold">{t('settings.weightUnit')}</p>
          <Segmented
            value={unit}
            onChange={(next) => updateProfile.mutate({ unit: next })}
            options={[
              { value: 'kg', label: t('settings.kilograms') },
              { value: 'lb', label: t('settings.pounds') },
            ]}
          />
        </Card>

        {/* Plates */}
        <Card variant="surface" className="space-y-4 p-4">
          <div>
            <p className="text-sm font-semibold">{t('settings.plateCalc')}</p>
            <p className="mt-0.5 text-xs text-muted">
              {t('settings.plateCalcHint')}
            </p>
          </div>

          <Field label={t('settings.barWeight', { unit })}>
            <Input
              value={barWeight}
              onChange={(e) =>
                setBarWeight(e.target.value.replace(/[^\d.,]/g, ''))
              }
              onBlur={saveBarWeight}
              inputMode="decimal"
              className="max-w-32"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            {plates.map((plate) => (
              <span
                key={`${plate.unit}-${plate.value}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised pr-2 pl-3.5 text-sm"
              >
                <span className="font-dot">{plate.value}</span>
                <span className="text-xs text-muted">{plate.unit}</span>
                <button
                  type="button"
                  aria-label={t('settings.removePlate', {
                    plate: `${plate.value} ${plate.unit}`,
                  })}
                  onClick={() => removePlate(plate)}
                  className="text-faint active:text-flame"
                >
                  <IconClose size={14} />
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <Input
              value={newPlate}
              onChange={(e) =>
                setNewPlate(e.target.value.replace(/[^\d.,]/g, ''))
              }
              onKeyDown={(e) => e.key === 'Enter' && addPlate()}
              inputMode="decimal"
              placeholder={t('settings.plateWeight')}
              className="h-10 flex-1"
            />
            <div className="flex rounded-full border border-line bg-surface p-0.5 items-center">
              {(['kg', 'lb'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setNewPlateUnit(option)}
                  className={
                    newPlateUnit === option
                      ? 'h-9 rounded-full bg-lime px-3 text-sm font-medium text-black'
                      : 'h-9 rounded-full px-3 text-sm font-medium text-muted'
                  }
                >
                  {option}
                </button>
              ))}
            </div>
            <Button
              variant="surface"
              size="sm"
              className="h-10"
              onClick={addPlate}
            >
              <IconPlus size={16} />
              {t('common.add')}
            </Button>
          </div>
        </Card>

        {/* Muscle groups */}
        <MuscleGroupsCard />

        <SignOutButton />

        <p className="pb-2 text-center text-xs text-faint">
          {t('settings.install')}
        </p>
      </div>
    </AppShell>
  )
}

function AvatarEditor({
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
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <Avatar src={avatarUrl} size={72} alt={displayName ?? ''} />
        <div className="flex min-w-0 flex-col items-start gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
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
              className="text-xs text-muted disabled:opacity-50"
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
          <p className="text-xs text-faint">{t('settings.avatarHint')}</p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted">
          {t('settings.chooseAvatar')}
        </p>
        <div className="grid grid-cols-5 gap-3">
          {PRESET_AVATARS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-label={preset.id}
              disabled={busy}
              onClick={() => {
                setError(null)
                setPreset.mutate(preset.url, {
                  onError: (err) => setError((err as Error).message),
                })
              }}
              className={cn(
                'justify-self-center rounded-full transition-opacity disabled:opacity-60',
                avatarUrl === preset.url &&
                  'ring-2 ring-lime ring-offset-2 ring-offset-surface',
              )}
            >
              <Avatar src={preset.url} size={48} alt={preset.id} />
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNote message={error} />}
    </div>
  )
}

function MuscleGroupsCard() {
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
    <Card variant="surface" className="space-y-4 p-4">
      <div>
        <p className="text-sm font-semibold">{t('settings.muscleGroups')}</p>
        <p className="mt-0.5 text-xs text-muted">
          {t('settings.muscleGroupsHint')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups?.map((group) => (
          <span
            key={group.id}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-sm"
          >
            {group.name}
            {group.user_id != null && (
              <button
                type="button"
                aria-label={t('settings.deleteGroup', { name: group.name })}
                onClick={() => setDeleteId(group.id)}
                className="text-faint active:text-flame"
              >
                <IconClose size={14} />
              </button>
            )}
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={t('settings.newGroup')}
          className="h-10 flex-1"
        />
        <Button
          variant="surface"
          size="sm"
          className="h-10"
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
    </Card>
  )
}
