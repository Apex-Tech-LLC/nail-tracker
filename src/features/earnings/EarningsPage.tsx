import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState } from 'react'
import { PageHeader } from '../../app/PageHeader.tsx'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import {
  diffDays,
  formatDayLong,
  formatMonthYear,
  formatRange,
  todayIso,
  type DateLocale,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
import { Row } from '../../ui/Row.tsx'
import {
  card,
  chip,
  chipOff,
  chipOn,
  errorText,
  field,
  label,
  secondaryButton,
} from '../../ui/styles.ts'
import { backupFileName, download } from '../backup/backupFormat.ts'
import { exportCsv } from '../backup/exportCsv.ts'
import { loadRange } from '../turns/turnStore.ts'
import { BarChart } from './BarChart.tsx'
import { bucketSizeOf, type BucketSize } from './chartData.ts'
import { loadEarnings } from './earningsData.ts'
import { rangeOf, stepDate, type PeriodChoice } from './earningsRange.ts'

const CHOICES: { value: PeriodChoice; key: StringKey }[] = [
  { value: 'daily', key: 'periodDaily' },
  { value: 'weekly', key: 'periodWeekly' },
  { value: 'monthly', key: 'periodMonthly' },
  { value: 'yearly', key: 'periodYearly' },
  { value: 'custom', key: 'periodCustom' },
]

const CHART_TITLE_KEYS: Record<BucketSize, StringKey> = {
  day: 'chartDaily',
  week: 'chartWeekly',
  month: 'chartMonthly',
}

function rangeLabel(
  choice: Exclude<PeriodChoice, 'custom'>,
  date: IsoDate,
  start: IsoDate,
  end: IsoDate,
  locale: DateLocale,
): string {
  switch (choice) {
    case 'daily':
      return formatDayLong(date, locale)
    case 'weekly':
      return formatRange(start, end, locale)
    case 'monthly':
      return formatMonthYear(date, locale)
    case 'yearly':
      return start.slice(0, 4)
  }
}

export function EarningsPage() {
  const { locale, weekStartDay } = useSettings()
  const today = useToday()
  const [choice, setChoice] = useState<PeriodChoice>('weekly')
  const [date, setDate] = useState<IsoDate>(today)
  const [customStart, setCustomStart] = useState<IsoDate>(today)
  const [customEnd, setCustomEnd] = useState<IsoDate>(today)
  const id = useId()

  const range =
    choice === 'custom'
      ? { start: customStart, end: customEnd }
      : rangeOf(choice, date, weekStartDay)
  const { start, end } = range
  const invalidRange = end < start
  const data = useLiveQuery(
    () => (invalidRange ? null : loadEarnings(db, start, end, weekStartDay, locale)),
    [start, end, invalidRange, weekStartDay, locale],
  )

  const hasChartData =
    data?.bars.some((bar) => bar.earnedCents > 0 || bar.revenueCents > 0) ?? false
  const chartTitle = t(locale, CHART_TITLE_KEYS[bucketSizeOf(start, end)])
  const chartSummary = data
    ? tf(locale, 'chartSummary', {
        days: diffDays(end, start) + 1,
        amount: formatUsd(data.highestDayCents),
      })
    : ''

  // A quick double tap runs the download twice before React can re-render.
  const exportInFlight = useRef(false)

  async function exportRange() {
    if (exportInFlight.current) return
    exportInFlight.current = true
    try {
      const loaded = await loadRange(db, start, end)
      download(
        exportCsv(loaded.turns, loaded.services, loaded.adjustments, locale),
        backupFileName('turns', 'csv', todayIso()),
        'text/csv',
      )
    } finally {
      exportInFlight.current = false
    }
  }

  // An invalid custom range keeps the picker and its error on screen, just
  // without figures; a valid one waits for its first database result.
  if (!invalidRange && data === undefined) return null

  return (
    <>
      <PageHeader title={t(locale, 'earningsTitle')} />

      <div className="flex flex-wrap gap-2">
        {CHOICES.map(({ value, key }) => (
          <button
            key={value}
            type="button"
            aria-pressed={choice === value}
            className={`${chip} ${choice === value ? chipOn : chipOff}`}
            onClick={() => setChoice(value)}
          >
            {t(locale, key)}
          </button>
        ))}
      </div>

      {choice === 'custom' ? (
        <>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-from`} className={label}>
                {t(locale, 'from')}
              </label>
              <input
                id={`${id}-from`}
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                aria-invalid={invalidRange}
                aria-describedby={invalidRange ? `${id}-range-error` : undefined}
                className={field}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-to`} className={label}>
                {t(locale, 'to')}
              </label>
              <input
                id={`${id}-to`}
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                aria-invalid={invalidRange}
                aria-describedby={invalidRange ? `${id}-range-error` : undefined}
                className={field}
              />
            </div>
          </div>
          {invalidRange && (
            <p id={`${id}-range-error`} className={errorText}>
              {t(locale, 'errorRange')}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={t(locale, 'previousPeriod')}
            onClick={() => setDate(stepDate(choice, date, -1))}
            className="rounded-control p-3"
          >
            <IconChevronLeft size={20} aria-hidden="true" />
          </button>
          <p className="min-w-0 text-center font-medium">
            {rangeLabel(choice, date, start, end, locale)}
          </p>
          <button
            type="button"
            aria-label={t(locale, 'nextPeriod')}
            onClick={() => setDate(stepDate(choice, date, 1))}
            className="rounded-control p-3"
          >
            <IconChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      )}

      {!invalidRange && data && (
        <>
          <div className={`${card} bg-brand-50!`}>
            <p className="text-sm text-text-secondary">{t(locale, 'totalEarned')}</p>
            <p className="text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
              {formatUsd(data.totals.earnedCents)}
            </p>
          </div>

          <div className={card}>
            <Row label={t(locale, 'totalTurns')} value={String(data.totals.turns)} />
            <Row label={t(locale, 'customers')} value={String(data.totals.customers)} />
            <Row label={t(locale, 'workDays')} value={String(data.totals.workDays)} />
            <Row
              label={t(locale, 'serviceRevenue')}
              value={formatUsd(data.totals.serviceRevenueCents)}
            />
            <Row label={t(locale, 'commission')} value={formatUsd(data.totals.commissionCents)} />
            <Row label={t(locale, 'cashTips')} value={formatUsd(data.totals.cashTipsCents)} />
            <Row label={t(locale, 'cardTips')} value={formatUsd(data.totals.cardTipsCents)} />
            <Row label={t(locale, 'totalTips')} value={formatUsd(data.totals.tipsCents)} />
            {data.totals.adjustmentsCents !== 0 && (
              <Row
                label={t(locale, 'adjustments')}
                value={formatUsd(data.totals.adjustmentsCents)}
              />
            )}
          </div>

          <div className={card}>
            <Row label={t(locale, 'totalPaid')} value={formatUsd(data.paidInRangeCents)} />
            <div
              className={
                data.outstandingAllTimeCents > 0
                  ? 'text-warning-text'
                  : data.outstandingAllTimeCents < 0
                    ? 'text-positive-text'
                    : undefined
              }
            >
              <Row
                label={`${t(locale, 'outstandingBalance')} (${t(locale, 'allTime')})`}
                value={formatUsd(data.outstandingAllTimeCents)}
              />
            </div>
          </div>

          <div className={card}>
            <Row
              label={t(locale, 'avgPerTurn')}
              value={formatUsd(data.averages.earnedPerTurnCents)}
            />
            <Row
              label={t(locale, 'avgTipsPerTurn')}
              value={formatUsd(data.averages.tipsPerTurnCents)}
            />
            <Row
              label={t(locale, 'avgPerWorkDay')}
              value={formatUsd(data.averages.earnedPerWorkDayCents)}
            />
          </div>

          {choice !== 'daily' && (
            <div className={`${card} flex flex-col gap-4`}>
              {hasChartData ? (
                <>
                  <BarChart
                    title={chartTitle}
                    summary={chartSummary}
                    bars={data.bars}
                    series={['earned']}
                  />
                  <BarChart
                    title={t(locale, 'chartRevenueVsEarned')}
                    summary={chartSummary}
                    bars={data.bars}
                    series={['revenue', 'earned']}
                  />
                </>
              ) : (
                <p className="text-sm text-text-secondary">{t(locale, 'chartNoData')}</p>
              )}
            </div>
          )}

          <button type="button" onClick={exportRange} className={secondaryButton}>
            {t(locale, 'exportCsvRange')}
          </button>
        </>
      )}
    </>
  )
}
