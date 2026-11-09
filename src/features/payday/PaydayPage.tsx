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
import { endLoad, startLoad } from '../../lib/loadMark.ts'
import { list, primaryButton, secondaryButton } from '../../ui/styles.ts'
import { CheckPanel } from '../paycheck/CheckPanel.tsx'
import { ExactPayButton } from '../paycheck/ExactPayButton.tsx'
import { checkStatusColor, checkStatusLabel } from '../paycheck/paycheckStatus.ts'
import { StatementCard } from '../paycheck/StatementCard.tsx'
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

  const summaries = useLiveQuery(async () => {
    startLoad('load:paycheck')
    const result = await loadPeriodSummaries(db)
    endLoad('load:paycheck')
    return result
  })

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

  const current = summaries.find(
    (summary) => summary.period.startDate <= today && today <= summary.period.endDate,
  )
  // An empty period that is not the one being worked in would just be noise.
  const past = [...summaries]
    .reverse()
    .filter((summary) => summary !== current && summary.state !== 'empty')

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

      {current && (
        <>
          <StatementCard
            period={current.period}
            statement={current.statement}
            endRules={current.endRules}
            status={current.state}
          />
          <ExactPayButton summary={current} />
          <CheckPanel summary={current} />
        </>
      )}

      {past.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium">{t(locale, 'pastPayPeriods')}</h2>
          <div className={list}>
            {past.map((summary) => (
              <Link
                key={summary.period.id}
                href={paths.period(summary.period.id)}
                className="block px-4 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">
                    {formatRange(summary.period.startDate, summary.period.endDate, locale)}
                  </p>
                  <span
                    className={`shrink-0 rounded-full border border-border-strong px-2 py-0.5 text-xs ${checkStatusColor(
                      summary.check,
                      summary.record?.checkedDate ?? null,
                    )}`}
                  >
                    {checkStatusLabel(
                      locale,
                      summary.check,
                      summary.record?.checkedDate ?? null,
                    )}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-sm text-text-secondary">
                    {t(locale, 'salonShouldPay')}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatUsd(summary.statement.salonPaysCents)}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs ${PAY_STATE_COLOR[summary.state]}`}>
                  {t(locale, PAY_STATE_LABEL[summary.state])}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {current === undefined && past.length === 0 && (
        <p className="text-text-secondary">{t(locale, 'paydayNoPeriods')}</p>
      )}
    </>
  )
}
