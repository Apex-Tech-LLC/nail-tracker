import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import { formatRange } from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t } from '../../lib/i18n.ts'
import { card, primaryButton, secondaryButton } from '../../ui/styles.ts'
import { AddPeriodForm } from './AddPeriodForm.tsx'
import { PAY_STATE_COLOR, PAY_STATE_LABEL } from './payStateLabels.ts'
import { ensurePayPeriods, loadPeriodSummaries } from './periodStore.ts'

export function PaydayPage() {
  const { locale, payPeriodType: type, payPeriodAnchorDate: anchor } = useSettings()
  const today = useToday()
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    void ensurePayPeriods(db, { type, anchor }, today)
  }, [type, anchor, today])

  const summaries = useLiveQuery(() => loadPeriodSummaries(db))

  if (summaries === undefined) {
    return <PageHeader title={t(locale, 'paydayTitle')} />
  }

  // A custom schedule is filled in by hand, and weekly or biweekly needs the
  // first day of a period to count from.
  const noSchedule =
    type === 'none' || ((type === 'weekly' || type === 'biweekly') && anchor === null)
  if (noSchedule && summaries.length === 0) {
    return (
      <>
        <PageHeader title={t(locale, 'paydayTitle')} />
        <p>{t(locale, 'paydayNoSchedule')}</p>
        <Link href={paths.settings} className={`${primaryButton} block text-center`}>
          {t(locale, 'paydayOpenSettings')}
        </Link>
      </>
    )
  }

  // An empty period that is not the one being worked in would just be noise.
  const visible = [...summaries]
    .reverse()
    .filter(
      (summary) =>
        summary.state !== 'empty' ||
        (summary.period.startDate <= today && today <= summary.period.endDate),
    )

  return (
    <>
      <PageHeader title={t(locale, 'paydayTitle')} />

      {type === 'custom' &&
        (adding ? (
          <AddPeriodForm
            existing={summaries.map((summary) => summary.period)}
            onDone={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={secondaryButton}
          >
            {t(locale, 'addCustomPeriod')}
          </button>
        ))}

      {visible.map((summary) => {
        const current =
          summary.period.startDate <= today && today <= summary.period.endDate
        const amount =
          summary.state === 'empty' || summary.state === 'paid'
            ? summary.totals.expectedPayoutCents
            : Math.abs(summary.outstandingCents)

        return (
          <Link
            key={summary.period.id}
            href={paths.period(summary.period.id)}
            className={`${card} block`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {formatRange(summary.period.startDate, summary.period.endDate, locale)}
              </p>
              {current && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-900">
                  {t(locale, 'currentPeriod')}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className={PAY_STATE_COLOR[summary.state]}>
                {t(locale, PAY_STATE_LABEL[summary.state])}
              </span>
              <span className="shrink-0 tabular-nums">{formatUsd(amount)}</span>
            </div>
          </Link>
        )
      })}

      {visible.length === 0 && (
        <p className="text-text-secondary">{t(locale, 'paydayNoPeriods')}</p>
      )}
    </>
  )
}
