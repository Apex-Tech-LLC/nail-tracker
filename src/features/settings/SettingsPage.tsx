import { IconAlertTriangle, IconChevronRight, IconShieldCheck } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useState } from 'react'
import { Link } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import type { PayPeriodType, ThemeChoice } from '../../app/settings.ts'
import { updateSettings, useSettings } from '../../app/settings.ts'
import { db } from '../../db/schema.ts'
import { isIsoDate, parseIsoDate, todayIso, weekRange } from '../../domain/dates.ts'
import { centsToInput, formatRate, formatUsdShort, parseCents } from '../../domain/money.ts'
import { rulesOn } from '../../domain/payRules.ts'
import { t, tf } from '../../lib/i18n.ts'
import type { Locale } from '../../lib/locale.ts'
import { usePersistState } from '../../pwa/persistStorage.ts'
import { MoneyField } from '../../ui/MoneyField.tsx'
import { Row } from '../../ui/Row.tsx'
import { TileGroup } from '../../ui/TileGroup.tsx'
import { card, field, label, secondaryButton } from '../../ui/styles.ts'
import { BackupSection } from '../backup/BackupSection.tsx'
import { DeleteAllSection } from '../backup/DeleteAllSection.tsx'
import { payRulesSummary } from '../payRules/payRulesSummary.ts'
import { TipHandlingFields } from './TipHandlingFields.tsx'

type WeekStartChoice = 'sunday' | 'monday'

/** "$1,000 a week · $4,000 a month", whichever goals are set, or "Not set". */
function goalSummary(
  locale: Locale,
  weeklyGoalCents: number | null,
  monthlyGoalCents: number | null,
): string {
  const parts: string[] = []
  if (weeklyGoalCents !== null) {
    parts.push(tf(locale, 'goalSummaryWeek', { amount: formatUsdShort(weeklyGoalCents) }))
  }
  if (monthlyGoalCents !== null) {
    parts.push(tf(locale, 'goalSummaryMonth', { amount: formatUsdShort(monthlyGoalCents) }))
  }
  return parts.length === 0 ? t(locale, 'goalNotSet') : parts.join(' · ')
}

export function SettingsPage() {
  const {
    locale,
    theme,
    defaultCommissionRateBp: rate,
    numberPad,
    weekStartDay,
    payPeriodType,
    payPeriodAnchorDate,
    weeklyGoalCents,
    monthlyGoalCents,
    taxSetAsideBp,
    hoursOn,
    minimumWageCents,
  } = useSettings()
  const anchorId = useId()
  const numberPadHintId = useId()
  const [wageText, setWageText] = useState(() =>
    minimumWageCents === null ? '' : centsToInput(minimumWageCents),
  )
  const rules = useLiveQuery(() => db.payRules.toArray())
  const summary = payRulesSummary(locale, rate, rulesOn(rules ?? [], todayIso()))
  const taxSummary =
    taxSetAsideBp === null
      ? t(locale, 'taxNotSet')
      : tf(locale, 'taxSetAsideSummary', { rate: formatRate(taxSetAsideBp) })

  // A weekly or biweekly schedule counts from the first day of a period, so
  // start it on the first day of the week the person is working in.
  function chooseSchedule(type: PayPeriodType) {
    const needsAnchor = type === 'weekly' || type === 'biweekly'
    if (needsAnchor && payPeriodAnchorDate === null) {
      updateSettings({
        payPeriodType: type,
        payPeriodAnchorDate: weekRange(todayIso(), weekStartDay).start,
      })
      return
    }
    updateSettings({ payPeriodType: type })
  }

  function changeWage(value: string) {
    setWageText(value)
    if (value.trim() === '') {
      updateSettings({ minimumWageCents: null })
      return
    }
    const cents = parseCents(value)
    if (cents !== null) updateSettings({ minimumWageCents: cents })
  }

  return (
    <>
      <PageHeader title={t(locale, 'settingsTitle')} languageButton={false} />
      {/* Language names stay in their own language so anyone can find theirs. No flags. */}
      <TileGroup<Locale>
        legend={t(locale, 'language')}
        name="language"
        value={locale}
        onChange={(value) => updateSettings({ locale: value })}
        options={[
          { value: 'vi', glyph: 'Vi', label: 'Tiếng Việt', lang: 'vi' },
          { value: 'en', glyph: 'Aa', label: 'English', lang: 'en' },
        ]}
      />

      <TileGroup<ThemeChoice>
        legend={t(locale, 'appearance')}
        name="theme"
        value={theme}
        onChange={(value) => updateSettings({ theme: value })}
        options={[
          { value: 'system', label: t(locale, 'themeSystem') },
          { value: 'light', label: t(locale, 'themeLight') },
          { value: 'dark', label: t(locale, 'themeDark') },
        ]}
      />

      <Link href={paths.payRules} className={`${card} block`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{t(locale, 'howImPaid')}</span>
          <IconChevronRight size={18} aria-hidden="true" className="flex-none text-text-secondary" />
        </div>
        <p className="mt-1 text-sm text-text-secondary">{summary}</p>
      </Link>

      <Link href={paths.goals} className={`${card} block`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{t(locale, 'goals')}</span>
          <IconChevronRight size={18} aria-hidden="true" className="flex-none text-text-secondary" />
        </div>
        <p className="mt-1 text-sm text-text-secondary">
          {goalSummary(locale, weeklyGoalCents, monthlyGoalCents)}
        </p>
      </Link>

      <div>
        <label className="flex items-center gap-3 py-2">
          <input
            type="checkbox"
            className="size-5"
            checked={numberPad}
            onChange={(event) => updateSettings({ numberPad: event.target.checked })}
            aria-describedby={numberPadHintId}
          />
          <span>{t(locale, 'numberPadOn')}</span>
        </label>
        <p id={numberPadHintId} className="text-sm text-text-secondary">{t(locale, 'numberPadHint')}</p>
      </div>

      <div className={card}>
        <Row label={t(locale, 'commissionBasis')} value={t(locale, 'commissionBasisValue')} />
      </div>

      <TileGroup<WeekStartChoice>
        legend={t(locale, 'weekStart')}
        name="week-start"
        value={weekStartDay === 1 ? 'monday' : 'sunday'}
        onChange={(value) => updateSettings({ weekStartDay: value === 'monday' ? 1 : 0 })}
        options={[
          { value: 'sunday', label: t(locale, 'sunday') },
          { value: 'monday', label: t(locale, 'monday') },
        ]}
      />

      <TileGroup<PayPeriodType>
        legend={t(locale, 'paydaySchedule')}
        name="pay-schedule"
        value={payPeriodType}
        onChange={chooseSchedule}
        options={[
          { value: 'weekly', label: t(locale, 'scheduleWeekly') },
          { value: 'biweekly', label: t(locale, 'scheduleBiweekly') },
          { value: 'custom', label: t(locale, 'scheduleCustom') },
          { value: 'none', label: t(locale, 'scheduleNone') },
        ]}
      />

      {(payPeriodType === 'weekly' || payPeriodType === 'biweekly') && (
        <div>
          <label htmlFor={anchorId} className={label}>
            {t(locale, 'anchorDate')}
          </label>
          <input
            id={anchorId}
            type="date"
            value={payPeriodAnchorDate ?? ''}
            onChange={(event) => {
              if (isIsoDate(event.target.value)) {
                updateSettings({ payPeriodAnchorDate: event.target.value })
              }
            }}
            aria-describedby={`${anchorId}-hint`}
            className={field}
          />
          <p id={`${anchorId}-hint`} className="mt-1 text-sm text-text-secondary">
            {t(locale, 'anchorDateHint')}
          </p>
        </div>
      )}

      <TipHandlingFields />

      <Link href={paths.taxes(parseIsoDate(todayIso()).year)} className={`${card} block`}>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{t(locale, 'taxes')}</span>
          <IconChevronRight size={18} aria-hidden="true" className="flex-none text-text-secondary" />
        </div>
        <p className="mt-1 text-sm text-text-secondary">{taxSummary}</p>
      </Link>
      <section className={`${card} flex flex-col gap-3`}>
        <h2 className="font-medium">{t(locale, 'hoursTitle')}</h2>
        <div>
          <label className="flex items-center gap-3 py-2">
            <input
              type="checkbox"
              className="size-5"
              checked={hoursOn}
              onChange={(event) => updateSettings({ hoursOn: event.target.checked })}
            />
            <span>{t(locale, 'hoursOn')}</span>
          </label>
          {hoursOn && (
            <>
              <MoneyField
                label={t(locale, 'minimumWage')}
                value={wageText}
                onChange={changeWage}
              />
              <p className="mt-1 text-sm text-text-secondary">{t(locale, 'minimumWageHint')}</p>
            </>
          )}
        </div>
      </section>

      <Link href={paths.services} className={secondaryButton + ' block text-center'}>
        {t(locale, 'manageServices')}
      </Link>

      <div className={card}>
        <Row label={t(locale, 'currency')} value={t(locale, 'currencyUsd')} />
      </div>

      <StorageStatus />
      <BackupSection />
      <DeleteAllSection />
      {/* Only the build id is forced LTR; the label stays in the page direction. */}
      <p className="mt-auto text-center text-xs text-text-muted">
        {t(locale, 'version')} <span dir="ltr">{__BUILD_ID__} · {__BUILD_DATE__}</span>
      </p>
    </>
  )
}

function StorageStatus() {
  const { locale } = useSettings()
  const state = usePersistState()
  if (!state) return null
  const safe = state === 'persisted'
  const Icon = safe ? IconShieldCheck : IconAlertTriangle

  return (
    <section>
      <h2 className="mb-2 text-xs text-text-secondary">{t(locale, 'storage')}</h2>
      <div className="flex gap-3 rounded-card border border-border bg-surface p-3">
        <Icon size={20} aria-hidden="true" className={`mt-0.5 flex-none ${safe ? 'text-brand-600' : 'text-warning-text'}`} />
        <div>
          <p className="text-sm">{t(locale, safe ? 'storagePersisted' : 'storageAtRisk')}</p>
          <p className="text-xs text-text-secondary">{t(locale, safe ? 'storagePersistedHint' : 'storageAtRiskHint')}</p>
        </div>
      </div>
    </section>
  )
}
