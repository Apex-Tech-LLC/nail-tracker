import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useId, useRef, useState } from 'react'
import { Link } from 'wouter'
import { PageHeader } from '../../app/PageHeader.tsx'
import { paths } from '../../app/navigation.ts'
import { useSettings } from '../../app/settings.ts'
import { useToday } from '../../app/useToday.ts'
import { db } from '../../db/schema.ts'
import {
  addDays,
  diffDays,
  formatDayShort,
  formatMonthShortYear,
  formatMonthYear,
  formatRange,
  formatWeekday,
  parseIsoDate,
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
import { durationText } from '../hours/hoursText.ts'
import { sharePicture } from '../share/shareCanvas.ts'
import { reportPictureInput } from '../share/reportPicture.ts'
import { loadRange } from '../turns/turnStore.ts'
import { loadReport, type ReportData, type TrendPoint } from './reportsData.ts'
import { rangeOf, stepDate, type ReportChoice } from './reportsRange.ts'
import { changeText, previousLabel, rangeLabel, turnsAverage } from './reportText.ts'
import { TrendChart } from './TrendChart.tsx'

const CHOICES: { value: ReportChoice; key: StringKey }[] = [
  { value: 'day', key: 'periodDay' },
  { value: 'week', key: 'periodWeek' },
  { value: 'month', key: 'periodMonth' },
  { value: 'year', key: 'periodYear' },
  { value: 'custom', key: 'periodCustom' },
]

const TREND_TITLE_KEYS: Record<ReportChoice, StringKey> = {
  day: 'chartDaily',
  week: 'chartWeekly',
  month: 'chartMonthly',
  year: 'chartMonthly',
  custom: 'reportChartOverTime',
}

const DAYS_IN_WEEK = 7

function Stat({ labelText, value, testId }: { labelText: string; value: string; testId: string }) {
  return (
    <div className="p-3 text-center">
      <b className="block text-lg font-bold tabular-nums" data-testid={testId}>
        {value}
      </b>
      <span className="text-xs text-text-muted">{labelText}</span>
    </div>
  )
}

function ComparisonLine({ text }: { text: string }) {
  return (
    <p data-testid="report-change" className="mt-1 text-sm font-medium">
      {text}
    </p>
  )
}

function SummaryCard({
  data,
  choice,
  locale,
  hoursOn,
  showDetails,
  onToggleDetails,
}: {
  data: ReportData
  choice: ReportChoice
  locale: DateLocale
  hoursOn: boolean
  showDetails: boolean
  onToggleDetails: () => void
}) {
  const { totals, averages } = data
  const previousText =
    totals.earnedCents === 0 && data.previous.totals.turns === 0
      ? null
      : changeText(
          locale,
          data.previous.change.differenceCents,
          data.previous.change.percent,
          previousLabel(choice, locale),
        )
  const lastYearText =
    choice !== 'year' && data.lastYear.hasTurns
      ? changeText(
          locale,
          data.lastYear.change.differenceCents,
          data.lastYear.change.percent,
          formatMonthShortYear(data.lastYear.span.start, locale),
        )
      : null

  return (
    <div className={`${card} bg-brand-50!`}>
      <p className="text-sm text-text-secondary">{t(locale, 'totalEarned')}</p>
      <p className="text-3xl font-extrabold tracking-[-0.03em] tabular-nums">
        {formatUsd(totals.earnedCents)}
      </p>
      {previousText && <ComparisonLine text={previousText} />}
      {lastYearText && <p className="text-sm text-text-secondary">{lastYearText}</p>}

      <div
        className={`mt-3 grid ${
          hoursOn ? 'grid-cols-4' : 'grid-cols-3'
        } divide-x divide-border overflow-hidden rounded-control border border-border bg-surface`}
      >
        <Stat labelText={t(locale, 'turns')} value={String(totals.turns)} testId="report-stat-turns" />
        <Stat
          labelText={t(locale, 'reportClients')}
          value={String(totals.customers)}
          testId="report-stat-clients"
        />
        <Stat
          labelText={t(locale, 'homeTips')}
          value={formatUsd(totals.tipsCents)}
          testId="report-stat-tips"
        />
        {hoursOn && (
          <Stat
            labelText={t(locale, 'hoursTitle')}
            value={durationText(locale, data.hours.minutes)}
            testId="report-stat-hours"
          />
        )}
      </div>

      <button
        type="button"
        aria-expanded={showDetails}
        onClick={onToggleDetails}
        className="mt-3 min-h-11 font-semibold text-brand-600 underline"
      >
        {t(locale, 'reportDetails')}
      </button>

      {showDetails && (
        <div className="mt-1">
          <Row label={t(locale, 'serviceRevenue')} value={formatUsd(totals.serviceRevenueCents)} />
          <Row label={t(locale, 'commission')} value={formatUsd(totals.commissionCents)} />
          <Row label={t(locale, 'cashTips')} value={formatUsd(totals.cashTipsCents)} />
          <Row label={t(locale, 'cardTips')} value={formatUsd(totals.cardTipsCents)} />
          {totals.adjustmentsCents !== 0 && (
            <Row label={t(locale, 'adjustments')} value={formatUsd(totals.adjustmentsCents)} />
          )}
          <Row label={t(locale, 'totalPaid')} value={formatUsd(data.paidInRangeCents)} />
          <Row
            label={`${t(locale, 'outstandingBalance')} (${t(locale, 'allTime')})`}
            value={formatUsd(data.outstandingAllTimeCents)}
          />
          <Row label={t(locale, 'avgPerTurn')} value={formatUsd(averages.earnedPerTurnCents)} />
          <Row label={t(locale, 'avgTipsPerTurn')} value={formatUsd(averages.tipsPerTurnCents)} />
          <Row label={t(locale, 'avgPerWorkDay')} value={formatUsd(averages.earnedPerWorkDayCents)} />
        </div>
      )}
    </div>
  )
}

export function ReportsPage() {
  const { locale, weekStartDay, weeklyGoalCents, monthlyGoalCents, hoursOn, minimumWageCents } =
    useSettings()
  const today = useToday()
  const [choice, setChoice] = useState<ReportChoice>('week')
  const [date, setDate] = useState<IsoDate>(today)
  const [customStart, setCustomStart] = useState<IsoDate>(today)
  const [customEnd, setCustomEnd] = useState<IsoDate>(today)
  const [showDetails, setShowDetails] = useState(false)
  const [showAllServices, setShowAllServices] = useState(false)
  const [chosen, setChosen] = useState<{ rangeKey: string; index: number } | null>(null)
  const id = useId()

  const range =
    choice === 'custom'
      ? { start: customStart, end: customEnd }
      : rangeOf(choice, date, weekStartDay)
  const { start, end } = range
  const invalidRange = end < start
  const anchor = choice === 'custom' ? start : date

  const data = useLiveQuery(
    () =>
      invalidRange
        ? null
        : loadReport(db, {
            choice,
            span: { start, end },
            anchor,
            weekStart: weekStartDay,
            today,
            locale,
          }),
    [choice, start, end, anchor, weekStartDay, today, locale, invalidRange],
  )

  const rangeKey = `${choice}:${start}:${end}`
  const selectedIndex = chosen?.rangeKey === rangeKey ? chosen.index : null
  // Week mode draws the weekly goal and Month mode the monthly one; other
  // modes have no goal line of their own.
  const goalCents =
    choice === 'week' ? weeklyGoalCents : choice === 'month' ? monthlyGoalCents : null

  // A quick double tap runs the download twice before React can re-render.
  const exportInFlight = useRef(false)
  const shareInFlight = useRef(false)

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

  async function shareSummary() {
    if (shareInFlight.current || data === undefined || data === null) return
    shareInFlight.current = true
    try {
      await sharePicture(
        reportPictureInput({ data, choice, date, start, end, locale }),
        backupFileName('report', 'png', todayIso()),
        t(locale, 'shareSummary'),
      )
    } finally {
      shareInFlight.current = false
    }
  }

  function openBar(bar: TrendPoint) {
    if (choice === 'custom') {
      setCustomStart(bar.start)
      setCustomEnd(bar.end)
    } else if (choice === 'day' || choice === 'week') {
      setChoice(choice)
      setDate(bar.start)
    } else {
      setChoice('month')
      setDate(bar.start)
    }
    setChosen(null)
  }

  // An invalid custom range keeps the picker and its error on screen, just
  // without figures; a valid one waits for its first database result.
  if (!invalidRange && data === undefined) return null

  const weekdayShown =
    !invalidRange &&
    data !== null &&
    (choice === 'month' ||
      choice === 'year' ||
      (choice === 'custom' && diffDays(end, start) + 1 >= 14))

  const weekdayHasData =
    weekdayShown &&
    data !== undefined &&
    data !== null &&
    data.weekdayLines.some((line) => line.days > 0)

  const belowMinimum =
    data != null &&
    choice === 'week' &&
    minimumWageCents !== null &&
    data.hours.withoutTipsCents !== null &&
    data.hours.withoutTipsCents < minimumWageCents

  return (
    <>
      <PageHeader title={t(locale, 'reportsTitle')} />

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
          <SummaryCard
            data={data}
            choice={choice}
            locale={locale}
            hoursOn={hoursOn}
            showDetails={showDetails}
            onToggleDetails={() => setShowDetails((open) => !open)}
          />

          {choice === 'year' && (
            <Link
              href={paths.taxes(parseIsoDate(start).year)}
              className={`${secondaryButton} block text-center`}
            >
              {t(locale, 'taxesTitle')}
            </Link>
          )}

          <section className={card}>
            <h2 className="mb-2 text-base font-semibold">{t(locale, 'reportTrend')}</h2>
            <TrendChart
              title={t(locale, TREND_TITLE_KEYS[choice])}
              bars={data.bars}
              currentIndex={data.currentBarIndex}
              selectedIndex={selectedIndex}
              onSelect={(index) => setChosen({ rangeKey, index })}
              onOpen={openBar}
              goalCents={goalCents}
            />
          </section>

          {data.serviceLines.length > 0 && (
            <section className={card}>
              <h2 className="mb-2 text-base font-semibold">{t(locale, 'reportByService')}</h2>
              <ul className="divide-y divide-border">
                {(showAllServices ? data.serviceLines : data.serviceLines.slice(0, 8)).map(
                  (line) => (
                    <li key={line.name} data-testid="service-line" className="py-2">
                      <p className="font-medium">{line.name}</p>
                      <p className="text-sm text-text-secondary tabular-nums">
                        {tf(locale, 'reportServiceMeta', {
                          count: line.count,
                          price: formatUsd(line.priceCents),
                          share: formatUsd(line.shareCents),
                        })}{' '}
                        · {tf(locale, 'reportServiceAvg', { amount: formatUsd(line.averageCents) })}
                      </p>
                    </li>
                  ),
                )}
              </ul>
              {data.serviceLines.length > 8 && (
                <button
                  type="button"
                  onClick={() => setShowAllServices((open) => !open)}
                  className="mt-2 min-h-11 font-semibold text-brand-600 underline"
                >
                  {t(locale, showAllServices ? 'reportShowLess' : 'reportShowAll')}
                </button>
              )}
            </section>
          )}

          {weekdayHasData && data && (
            <section className={card}>
              <h2 className="mb-2 text-base font-semibold">{t(locale, 'reportByWeekday')}</h2>
              <ul className="divide-y divide-border">
                {data.weekdayLines.map((line) => (
                  <li key={line.weekday} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="text-text-secondary">
                      {formatWeekday(line.weekday, locale)}
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      {line.best && (
                        <span className="rounded-full bg-positive-bg px-2 py-0.5 text-xs font-semibold text-positive-text">
                          {t(locale, 'reportBest')}
                        </span>
                      )}
                      {line.slowest && (
                        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning-text">
                          {t(locale, 'reportSlowest')}
                        </span>
                      )}
                      <span>{formatUsd(line.averageEarnedCents)}</span>
                      <span className="text-xs text-text-muted">
                        {tf(locale, 'reportAvgTurns', { n: turnsAverage(line.averageTurns) })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.clientLines.length > 0 && (
            <section className={card}>
              <h2 className="mb-2 text-base font-semibold">{t(locale, 'reportClients')}</h2>
              <ul className="divide-y divide-border">
                {data.clientLines.map((line) => (
                  <li key={line.kind} className="py-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-text-secondary">
                        {t(
                          locale,
                          line.kind === 'request'
                            ? 'clientRequest'
                            : line.kind === 'walkIn'
                              ? 'clientWalkIn'
                              : 'clientUnspecified',
                        )}
                      </span>
                      <span className="tabular-nums">
                        {line.clients} · {line.percent}%
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3 text-sm text-text-muted">
                      <span>{t(locale, 'reportAverageTip')}</span>
                      <span className="tabular-nums">{formatUsd(line.averageTipCents)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.totals.tipsCents > 0 && (
            <section className={card}>
              <h2 className="mb-2 text-base font-semibold">{t(locale, 'homeTips')}</h2>
              <Row label={t(locale, 'cashTips')} value={formatUsd(data.tips.cashCents)} />
              <Row label={t(locale, 'cardTips')} value={formatUsd(data.tips.cardCents)} />
              <Row
                label={t(locale, 'reportAverageTip')}
                value={formatUsd(data.tips.averagePerClientCents)}
              />
              <Row
                label={t(locale, 'reportPercentOfPrice')}
                value={data.tips.percentOfPrice === null ? '—' : `${data.tips.percentOfPrice}%`}
              />
              <Row label={t(locale, 'reportCardHeld')} value={formatUsd(data.tips.cardHeldCents)} />
            </section>
          )}

          {hoursOn && data.hours.minutes > 0 && (
            <section className={card}>
              <h2 className="mb-2 text-base font-semibold">{t(locale, 'perHour')}</h2>
              <Row
                label={t(locale, 'withTips')}
                value={
                  data.hours.withTipsCents === null
                    ? '—'
                    : formatUsd(data.hours.withTipsCents)
                }
              />
              <Row
                label={t(locale, 'salonPayWithoutTips')}
                value={
                  data.hours.withoutTipsCents === null
                    ? '—'
                    : formatUsd(data.hours.withoutTipsCents)
                }
              />
              {belowMinimum && data.hours.withoutTipsCents !== null && minimumWageCents !== null && (
                <p className="mt-2 text-sm text-text-secondary">
                  {tf(locale, 'belowMinimumWage', {
                    paid: formatUsd(data.hours.withoutTipsCents),
                    minimum: formatUsd(minimumWageCents),
                  })}
                </p>
              )}
            </section>
          )}

          {data.records && (
            <section className={card}>
              <h2 className="mb-2 text-base font-semibold">{t(locale, 'reportRecords')}</h2>
              <Row
                label={t(locale, 'reportBestDay')}
                value={`${formatUsd(data.records.bestDay.cents)} · ${formatDayShort(data.records.bestDay.date, locale)}`}
              />
              <Row
                label={t(locale, 'reportBestWeek')}
                value={`${formatUsd(data.records.bestWeek.cents)} · ${formatRange(
                  data.records.bestWeek.start,
                  addDays(data.records.bestWeek.start, DAYS_IN_WEEK - 1),
                  locale,
                )}`}
              />
              <Row
                label={t(locale, 'reportBestMonth')}
                value={`${formatUsd(data.records.bestMonth.cents)} · ${formatMonthYear(
                  data.records.bestMonth.start,
                  locale,
                )}`}
              />
              <Row
                label={t(locale, 'reportMostTurns')}
                value={`${tf(locale, 'reportAvgTurns', { n: data.records.mostTurns.turns })} · ${formatDayShort(
                  data.records.mostTurns.date,
                  locale,
                )}`}
              />
            </section>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => void shareSummary()} className={secondaryButton}>
              {t(locale, 'shareSummary')}
            </button>
            <button type="button" onClick={exportRange} className={secondaryButton}>
              {t(locale, 'exportCsvRange')}
            </button>
          </div>
        </>
      )}
    </>
  )
}


