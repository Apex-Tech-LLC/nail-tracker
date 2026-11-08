import type { Adjustment, NailDb, Turn } from '../../db/schema.ts'
import type { Span } from '../../domain/comparisons.ts'
import {
  addDays,
  diffDays,
  formatDayShort,
  formatMonthShort,
  parseIsoDate,
  type DateLocale,
  type IsoDate,
} from '../../domain/dates.ts'
import {
  byService,
  byWeekday,
  change,
  clients,
  lastYearSpan,
  previousReportSpan,
  records,
  tipsSummary,
  trendSpans,
  type Change,
  type ClientLine,
  type Records,
  type ServiceLine,
  type TipsSummary,
  type WeekdayLine,
} from '../../domain/reports.ts'
import { hoursPay, type HoursPay } from '../../domain/hours.ts'
import { averages, sumTotals, type Totals } from '../../domain/totals.ts'
import { loadRange } from '../turns/turnStore.ts'
import { reportKindOf, type ReportChoice } from './reportsRange.ts'

export interface TrendPoint {
  key: string
  start: IsoDate
  end: IsoDate
  label: string
  earnedCents: number
}

export interface ReportComparison {
  span: Span
  totals: Totals
  change: Change
}

export interface ReportData {
  totals: Totals
  averages: ReturnType<typeof averages>
  paidInRangeCents: number
  outstandingAllTimeCents: number
  previous: ReportComparison
  lastYear: ReportComparison & { hasTurns: boolean }
  bars: TrendPoint[]
  currentBarIndex: number
  serviceLines: ServiceLine[]
  weekdayLines: WeekdayLine[]
  clientLines: ClientLine[]
  tips: TipsSummary
  hours: HoursPay
  records: Records | null
}

export interface ReportRequest {
  choice: ReportChoice
  span: Span
  /** The day the picker is on; Day, Week, Month and Year use it to mark the current bar. */
  anchor: IsoDate
  weekStart: 0 | 1
  today: IsoDate
  locale: DateLocale
}

const DAY_TREND = 14

function spansForTrend(choice: ReportChoice, span: Span, weekStart: 0 | 1): Span[] {
  if (choice === 'day') {
    return Array.from({ length: DAY_TREND }, (_, index) => {
      const date = addDays(span.end, index - (DAY_TREND - 1))
      return { start: date, end: date }
    })
  }
  return trendSpans(reportKindOf(choice), span, weekStart)
}

function labelOf(span: Span, locale: DateLocale): string {
  const days = diffDays(span.end, span.start)
  if (days === 0) return String(parseIsoDate(span.start).day)
  if (days === 6) return formatDayShort(span.start, locale)
  return formatMonthShort(span.start, locale)
}

function earnedIn(turns: readonly Turn[], adjustments: readonly Adjustment[], span: Span): number {
  const spanTurns = turns.filter(
    (turn) => turn.localWorkDate >= span.start && turn.localWorkDate <= span.end,
  )
  const spanAdjustments = adjustments.filter(
    (adjustment) =>
      adjustment.localWorkDate >= span.start && adjustment.localWorkDate <= span.end,
  )
  return sumTotals(spanTurns, spanAdjustments).earnedCents
}

/** Every span is read with its own indexed range query, so a long history never loads whole. */
async function loadSpan(db: NailDb, span: Span) {
  const [turns, adjustments] = await Promise.all([
    db.turns.where('localWorkDate').between(span.start, span.end, true, true).toArray(),
    db.adjustments.where('localWorkDate').between(span.start, span.end, true, true).toArray(),
  ])
  return { turns, adjustments }
}

export async function loadReport(db: NailDb, request: ReportRequest): Promise<ReportData> {
  const { choice, span, anchor, weekStart, today, locale } = request
  const kind = reportKindOf(choice)
  const previousSpan = previousReportSpan(kind, span)
  const lastYear = lastYearSpan(span)
  const trend = spansForTrend(choice, span, weekStart)

  const trendStart = trend[0].start
  const trendEnd = trend[trend.length - 1].end

  const [range, previous, lastYearFigures, trendFigures, allTurns, allAdjustments, allPayments, paymentsInRange, workDays] =
    await Promise.all([
      loadRange(db, span.start, span.end),
      loadSpan(db, previousSpan),
      loadSpan(db, lastYear),
      loadSpan(db, { start: trendStart, end: trendEnd }),
      // Records look at every turn ever saved. The same read serves the all-time balance.
      db.turns.toArray(),
      db.adjustments.toArray(),
      db.payments.toArray(),
      db.payments.where('paymentDate').between(span.start, span.end, true, true).toArray(),
      db.workDays.where('date').between(span.start, span.end, true, true).toArray(),
    ])

  const totals = sumTotals(range.turns, range.adjustments)
  const previousTotals = sumTotals(previous.turns, previous.adjustments)
  const lastYearTotals = sumTotals(lastYearFigures.turns, lastYearFigures.adjustments)
  const allTotals = sumTotals(allTurns, allAdjustments)

  const bars: TrendPoint[] = trend.map((bucket) => ({
    key: `${bucket.start}:${bucket.end}`,
    start: bucket.start,
    end: bucket.end,
    label: labelOf(bucket, locale),
    earnedCents: earnedIn(trendFigures.turns, trendFigures.adjustments, bucket),
  }))

  let currentBarIndex = trend.findIndex(
    (bucket) => anchor >= bucket.start && anchor <= bucket.end,
  )
  if (currentBarIndex === -1) currentBarIndex = trend.length - 1

  return {
    totals,
    averages: averages(totals),
    paidInRangeCents: paymentsInRange.reduce((sum, payment) => sum + payment.amountCents, 0),
    // Outstanding is always the whole picture: every turn and adjustment ever
    // recorded, less every payment ever received.
    outstandingAllTimeCents:
      allTotals.expectedPayoutCents -
      allPayments.reduce((sum, payment) => sum + payment.amountCents, 0),
    previous: {
      span: previousSpan,
      totals: previousTotals,
      change: change(totals.earnedCents, previousTotals.earnedCents),
    },
    lastYear: {
      span: lastYear,
      totals: lastYearTotals,
      change: change(totals.earnedCents, lastYearTotals.earnedCents),
      hasTurns: lastYearFigures.turns.length > 0,
    },
    bars,
    currentBarIndex,
    serviceLines: byService(range.services),
    weekdayLines: byWeekday(range.turns, range.adjustments, weekStart),
    clientLines: clients(range.turns),
    tips: tipsSummary(range.turns),
    hours: hoursPay(range.turns, range.adjustments, workDays),
    records: records(allTurns, allAdjustments, weekStart, today),
  }
}
