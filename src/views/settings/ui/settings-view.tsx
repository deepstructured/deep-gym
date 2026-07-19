'use client'

import Link from 'next/link'
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
import { SignOutButton } from '@/features/auth'
import { TrainingWeekCard } from '@/features/training-schedule'
import { WhatsNewSheet } from '@/features/whats-new'
import { CURRENT_RELEASE } from '@/shared/config/releases'
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
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconHistory,
  IconInfo,
  IconPlus,
  Input,
  PageLoader,
  Segmented,
  Tag,
} from '@/shared/ui'
import styles from './settings-view.module.scss'

export function SettingsView() {
  const { t, lang, setLang } = useI18n()
  const { data: profile, isLoading } = useProfile()
  const updateProfile = useUpdateProfile()

  const [name, setName] = useState('')
  const [barWeight, setBarWeight] = useState('')
  const [newPlate, setNewPlate] = useState('')
  const [newPlateUnit, setNewPlateUnit] = useState<Unit>('kg')
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)

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
      <div className={styles.stack}>
        {/* Profile */}
        <Card variant="surface" className={styles.card}>
          <p className={styles.cardTitle}>{t('settings.profile')}</p>

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
            <p className={styles.telegramNote}>
              Telegram: <Tag>@{profile.telegram_username}</Tag>
            </p>
          )}
        </Card>

        {/* Language & units */}
        <Card variant="surface" className={styles.card}>
          <div>
            <p className={styles.groupLabel}>{t('settings.language')}</p>
            <Segmented
              value={lang}
              onChange={changeLanguage}
              options={LANGUAGE_OPTIONS}
            />
          </div>
          <div>
            <p className={styles.groupLabel}>{t('settings.weightUnit')}</p>
            <Segmented
              value={unit}
              onChange={(next) => updateProfile.mutate({ unit: next })}
              options={[
                { value: 'kg', label: t('settings.kilograms') },
                { value: 'lb', label: t('settings.pounds') },
              ]}
            />
          </div>
        </Card>

        {/* Explicit weekly workout schedule */}
        <TrainingWeekCard value={profile.training_schedule} />

        {/* Plates */}
        <Card variant="surface" className={styles.card}>
          <div>
            <p className={styles.cardTitle}>{t('settings.plateCalc')}</p>
            <p className={styles.cardHint}>{t('settings.plateCalcHint')}</p>
          </div>

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
            <Button
              variant="surface"
              size="compact"
              onClick={addPlate}
            >
              <IconPlus size={16} />
              {t('common.add')}
            </Button>
          </div>
        </Card>

        {/* Muscle groups */}
        <MuscleGroupsCard />

        <HelpUpdatesCard onOpenWhatsNew={() => setWhatsNewOpen(true)} />

        <SignOutButton />

        <p className={styles.installNote}>{t('settings.install')}</p>
      </div>

      <WhatsNewSheet
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
      />
    </AppShell>
  )
}

function HelpUpdatesCard({
  onOpenWhatsNew,
}: {
  onOpenWhatsNew: () => void
}) {
  const { t } = useI18n()

  return (
    <Card variant="surface" className={styles.helpCard}>
      <div className={styles.helpHead}>
        <span className={styles.helpDot} />
        <p className={styles.cardTitle}>{t('settings.helpUpdates')}</p>
      </div>

      <div className={styles.helpRows}>
        <Link href="/onboarding?replay=1" className={styles.helpRow}>
          <span className={cn(styles.helpIcon, styles.helpIconLime)}>
            <IconInfo size={18} />
          </span>
          <span className={styles.helpText}>
            <span className={styles.helpRowTitle}>
              {t('settings.appGuide')}
            </span>
            <span className={styles.helpRowHint}>
              {t('settings.appGuideHint')}
            </span>
          </span>
          <IconChevronRight size={18} className={styles.helpChevron} />
        </Link>

        <button
          type="button"
          onClick={onOpenWhatsNew}
          className={cn(styles.helpRow, styles.helpRowBorder)}
        >
          <span className={cn(styles.helpIcon, styles.helpIconIndigo)}>
            <IconHistory size={18} />
          </span>
          <span className={styles.helpText}>
            <span className={styles.helpRowTitle}>
              {t('settings.whatsNew')}
            </span>
            <span className={styles.helpRowHint}>
              {t('settings.whatsNewHint', {
                version: CURRENT_RELEASE.label,
              })}
            </span>
          </span>
          <IconChevronRight size={18} className={styles.helpChevron} />
        </button>
      </div>
    </Card>
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
    <Card variant="surface" className={styles.card}>
      <div>
        <p className={styles.cardTitle}>{t('settings.muscleGroups')}</p>
        <p className={styles.cardHint}>{t('settings.muscleGroupsHint')}</p>
      </div>

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
    </Card>
  )
}
