'use client'

import { addDays, format } from 'date-fns'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useMuscleGroups } from '@/entities/muscle-group'
import {
  normalizeTrainingSchedule,
  useProfile,
  useUpdateProfile,
} from '@/entities/user'
import { SignOutButton } from '@/features/auth'
import { BodyWeightHistory, BodyWeightTracker } from '@/features/body-weight'
import { TrainingWeekCard } from '@/features/training-schedule'
import { WhatsNewSheet } from '@/features/whats-new'
import { CURRENT_RELEASE } from '@/shared/config/releases'
import { LANGUAGE_OPTIONS, useI18n, type Lang } from '@/shared/i18n'
import { cn } from '@/shared/lib/cn'
import { getDateLocale } from '@/shared/lib/dates'
import { useUiMode } from '@/shared/lib/ui-mode'
import { kgToUnit, roundWeight, type Unit } from '@/shared/lib/weight'
import { AppShell, UiModeOptions } from '@/widgets/app-shell'
import {
  Avatar,
  ErrorNote,
  IconCalendar,
  IconCheck,
  IconChevronRight,
  IconGlobe,
  IconInfo,
  IconMonitor,
  IconMuscle,
  IconPlates,
  IconScale,
  IconSparkles,
  IconWidgets,
  PageLoader,
  Sheet,
} from '@/shared/ui'
import {
  AvatarEditor,
  MuscleGroupsSettings,
  PlatesSettings,
  ProfileNameField,
} from './settings-sections'
import styles from './settings-view.module.scss'

const SHEETS = [
  'profile',
  'weight',
  'schedule',
  'plates',
  'groups',
  'language',
  'interface',
] as const
type SheetKey = (typeof SHEETS)[number]

function isSheetKey(value: unknown): value is SheetKey {
  return typeof value === 'string' && SHEETS.includes(value as SheetKey)
}

const MONDAY = new Date(2024, 0, 1)

/**
 * Settings as a compact, grouped list: every row shows its current value and
 * opens the full editor in a sheet, so the page itself never grows with the
 * user's data. `?open=<section>` deep-links straight into a sheet.
 */
export function SettingsView() {
  const { t, lang, setLang } = useI18n()
  const { data: profile, isLoading, error: loadError } = useProfile()
  const { data: groups } = useMuscleGroups()
  const updateProfile = useUpdateProfile()
  const [sheet, setSheet] = useState<SheetKey | null>(null)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [uiMode] = useUiMode()

  useEffect(() => {
    const url = new URL(window.location.href)
    const requested = url.searchParams.get('open')
    if (!isSheetKey(requested)) return
    setSheet(requested)
    // One-shot: a reload should not reopen the sheet.
    url.searchParams.delete('open')
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }, [])

  if (isLoading || !profile) {
    return (
      <AppShell title={t('settings.title')} back>
        {loadError || (!isLoading && !profile) ? (
          <ErrorNote message={t('common.error')} />
        ) : (
          <PageLoader variant="settings" />
        )}
      </AppShell>
    )
  }

  const unit: Unit = profile.unit ?? 'kg'
  const close = () => setSheet(null)

  function changeLanguage(next: Lang) {
    setLang(next)
    updateProfile.mutate({ language: next })
  }

  const scheduleDays = normalizeTrainingSchedule(profile.training_schedule)
    .map((type, index) =>
      type
        ? format(addDays(MONDAY, index), 'EEEEEE', { locale: getDateLocale() })
        : null,
    )
    .filter(Boolean)
  const plateCount =
    profile.plates_kg.length + (profile.plates_lb?.length ?? 0)

  return (
    <AppShell title={t('settings.title')} back>
      <div className={styles.stack}>
        {/* Profile */}
        <button
          type="button"
          onClick={() => setSheet('profile')}
          className={cn(styles.profile, 'surface-well')}
        >
          <Avatar
            src={profile.avatar_url}
            size={56}
            alt={profile.display_name ?? ''}
          />
          <span className={styles.profileText}>
            <span className={styles.profileName}>
              {profile.display_name || t('settings.yourName')}
            </span>
            <span className={styles.profileMeta}>
              {profile.telegram_username
                ? `@${profile.telegram_username}`
                : t('settings.editProfile')}
            </span>
          </span>
          <IconChevronRight size={18} className={styles.chevron} />
        </button>

        <Group title={t('settings.groupBody')}>
          <Row
            icon={<IconScale size={18} />}
            tone="lime"
            title={t('bodyWeight.title')}
            value={
              profile.body_weight_kg != null
                ? `${roundWeight(kgToUnit(profile.body_weight_kg, unit))} ${unit}`
                : t('settings.notSet')
            }
            onClick={() => setSheet('weight')}
          />
        </Group>

        <Group title={t('settings.groupTraining')}>
          <Row
            icon={<IconCalendar size={18} />}
            tone="cherry"
            title={t('settings.trainingWeek')}
            value={
              scheduleDays.length > 0
                ? scheduleDays.join(' · ')
                : t('settings.flexible')
            }
            onClick={() => setSheet('schedule')}
          />
          <Row
            icon={<IconPlates size={18} />}
            tone="indigo"
            title={t('settings.plateCalc')}
            value={t('settings.platesSummary', {
              bar: roundWeight(kgToUnit(profile.bar_weight_kg, unit)),
              unit,
              count: plateCount,
            })}
            onClick={() => setSheet('plates')}
          />
          <Row
            icon={<IconMuscle size={18} />}
            tone="pink"
            title={t('settings.muscleGroups')}
            value={String(groups?.length ?? '')}
            onClick={() => setSheet('groups')}
          />
        </Group>

        <Group title={t('settings.groupApp')}>
          <Row
            icon={<IconGlobe size={18} />}
            title={t('settings.language')}
            value={LANGUAGE_OPTIONS.find((o) => o.value === lang)?.label}
            onClick={() => setSheet('language')}
          />
          <Row
            icon={<IconScale size={18} />}
            title={t('settings.weightUnit')}
            trailing={
              <div className={styles.unitSwitch}>
                {(['kg', 'lb'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={unit === option}
                    onClick={() => updateProfile.mutate({ unit: option })}
                    className={cn(
                      styles.unitOption,
                      unit === option && styles.unitOptionActive,
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            }
          />
          <Row
            icon={<IconMonitor size={18} />}
            title={t('ui.mode.title')}
            value={t(`ui.mode.${uiMode}`)}
            onClick={() => setSheet('interface')}
          />
          <Row
            icon={<IconWidgets size={18} />}
            title={t('settings.homeScreen')}
            value={t('settings.customize')}
            href="/?edit=1"
          />
        </Group>

        <Group title={t('settings.groupHelp')}>
          <Row
            icon={<IconInfo size={18} />}
            title={t('settings.appGuide')}
            href="/onboarding?replay=1"
          />
          <Row
            icon={<IconSparkles size={18} />}
            title={t('settings.whatsNew')}
            value={CURRENT_RELEASE.label}
            onClick={() => setWhatsNewOpen(true)}
          />
          <Row
            icon={<IconInfo size={18} />}
            title={t('settings.privacyPolicy')}
            href="/privacy"
          />
        </Group>

        <SignOutButton />

        <p className={styles.installNote}>{t('settings.install')}</p>
      </div>

      <Sheet
        open={sheet === 'profile'}
        onClose={close}
        title={t('settings.profile')}
      >
        <div className={styles.sheetStack}>
          <AvatarEditor
            avatarUrl={profile.avatar_url}
            displayName={profile.display_name}
          />
          <ProfileNameField value={profile.display_name ?? ''} />
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'weight'}
        onClose={close}
        title={t('bodyWeight.title')}
      >
        <div className={styles.sheetStack}>
          <BodyWeightTracker bare allowTimestampEdit />
          <div className={styles.sheetDivider} />
          <BodyWeightHistory bare />
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'schedule'}
        onClose={close}
        title={t('settings.trainingWeek')}
      >
        <TrainingWeekCard
          bare
          value={profile.training_schedule}
          onSaved={close}
        />
      </Sheet>

      <Sheet
        open={sheet === 'plates'}
        onClose={close}
        title={t('settings.plateCalc')}
      >
        <PlatesSettings />
      </Sheet>

      <Sheet
        open={sheet === 'groups'}
        onClose={close}
        title={t('settings.muscleGroups')}
      >
        <MuscleGroupsSettings />
      </Sheet>

      <Sheet
        open={sheet === 'language'}
        onClose={close}
        title={t('settings.language')}
      >
        <div className={styles.options}>
          {LANGUAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={option.value === lang}
              onClick={() => {
                changeLanguage(option.value)
                close()
              }}
              className={cn(
                styles.option,
                option.value === lang && styles.optionActive,
              )}
            >
              {option.label}
              {option.value === lang && <IconCheck size={18} />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'interface'}
        onClose={close}
        title={t('ui.mode.title')}
      >
        <UiModeOptions onPicked={close} />
      </Sheet>

      <WhatsNewSheet
        open={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
      />
    </AppShell>
  )
}

function Group({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className={styles.groupTitle}>{title}</h2>
      <div className={cn(styles.group, 'surface-well')}>{children}</div>
    </section>
  )
}

type RowTone = 'lime' | 'indigo' | 'cherry' | 'pink' | 'neutral'

function Row({
  icon,
  tone = 'neutral',
  title,
  value,
  trailing,
  onClick,
  href,
}: {
  icon: React.ReactNode
  tone?: RowTone
  title: string
  value?: string
  /** Inline control instead of a value + chevron. */
  trailing?: React.ReactNode
  onClick?: () => void
  href?: string
}) {
  const content = (
    <>
      <span className={cn(styles.rowIcon, styles[`tone_${tone}`])}>
        {icon}
      </span>
      <span className={styles.rowTitle}>{title}</span>
      {trailing ?? (
        <>
          {value && <span className={styles.rowValue}>{value}</span>}
          <IconChevronRight size={17} className={styles.chevron} />
        </>
      )}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={styles.row}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={styles.row}>
        {content}
      </button>
    )
  }
  return <div className={cn(styles.row, styles.rowStatic)}>{content}</div>
}
