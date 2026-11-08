// Reports maths. Plain TypeScript: no React, no Dexie. Money is whole cents;
// percents are whole numbers rounded half up.

import {
  addDays,
  dayOfWeek,
  diffDays,
  monthRange,
  parseIsoDate,
  weekRange,
  yearRange,
  type IsoDate,
} from './dates.ts'
import { roundDiv } from './money.ts'
import {
  sumTotals,
  type DatedAdjustment,
  type TurnFigures,
} from './totals.ts'
import type { Span } from './comparisons.ts'

export type ReportKind = 'week' | 'month' | 'year' | 'custom'

const pad = (n: number) => String(n).padStart(2, '0')

function isoDay(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function addMonths(iso: IsoDate, months: number): IsoDate {
  const { year, month } = parseIsoDate(iso)
  const absolute = year * 12 + (month - 1) + months
  const targetYear = Math.floor(absolute / 12)
  const targetMonth = ((absolute % 12) + 12) % 12
  return isoDay(targetYear, targetMonth + 1, 1)
}

function sameDayLastYear(iso: IsoDate): IsoDate {
  const { year, month, day } = parseIsoDate(iso)
  return isoDay(year - 1, month, Math.min(day, daysInMonth(year - 1, month)))
}

/** The whole period before: week -7 days; the previous calendar month; the previous year;
 *  custom: the same number of days ending the day before `span.start`. */
export function previousReportSpan(kind: ReportKind, span: Span): Span {
  if (kind === 'week') {
    return { start: addDays(span.start, -7), end: addDays(span.end, -7) }
  }
  if (kind === 'month') return monthRange(addDays(span.start, -1))
  if (kind === 'year') return yearRange(addDays(span.start, -1))

  const days = diffDays(span.end, span.start) + 1
  const end = addDays(span.start, -1)
  return { start: addDays(end, -(days - 1)), end }
}

/** The same dates one year earlier; February 29 becomes February 28. */
export function lastYearSpan(span: Span): Span {
  return { start: sameDayLastYear(span.start), end: sameDayLastYear(span.end) }
}

export interface Change {
  differenceCents: number // may be negative
  percent: number | null
}

/** percent = round(difference / earlier * 100), only when earlier > 0; otherwise null. */
export function change(currentCents: number, earlierCents: number): Change {
  const differenceCents = currentCents - earlierCents
  const percent = earlierCents > 0 ? roundDiv(differenceCents * 100, earlierCents) : null
  return { differenceCents, percent }
}

/** Trend buckets: week, the 12 weeks ending with the span's week; month, the 12 months ending with the span's
 *  month; year, the 12 months of that year; custom, one bucket per day of the span (at most 62, else per week). */
export function trendSpans(kind: ReportKind, span: Span, weekStart: 0 | 1): Span[] {
  if (kind === 'week') {
    const lastStart = weekRange(span.start, weekStart).start
    const spans: Span[] = []
    for (let index = 11; index >= 0; index -= 1) {
      const start = addDays(lastStart, -7 * index)
      spans.push({ start, end: addDays(start, 6) })
    }
    return spans
  }

  if (kind === 'month') {
    const lastStart = monthRange(span.start).start
    const spans: Span[] = []
    for (let index = 11; index >= 0; index -= 1) {
      spans.push(monthRange(addMonths(lastStart, -index)))
    }
    return spans
  }

  if (kind === 'year') {
    const { year } = parseIsoDate(span.start)
    return Array.from({ length: 12 }, (_, index) => monthRange(isoDay(year, index + 1, 1)))
  }

  const days = diffDays(span.end, span.start) + 1
  if (days <= 62) {
    return Array.from({ length: days }, (_, index) => {
      const date = addDays(span.start, index)
      return { start: date, end: date }
    })
  }

  const spans: Span[] = []
  for (
    let start = weekRange(span.start, weekStart).start;
    start <= span.end;
    start = addDays(start, 7)
  ) {
    spans.push({ start, end: addDays(start, 6) })
  }
  return spans
}

export interface ServiceLine {
  name: string
  count: number
  priceCents: number
  shareCents: number
  averageCents: number
}

/** Grouped by service name (the saved snapshot), each service line counted once; sorted by share, then name. */
export function byService(
  services: readonly {
    serviceNameSnapshot: string
    servicePriceCents: number
    commissionCents: number
  }[],
): ServiceLine[] {
  const grouped = new Map<string, { count: number; priceCents: number; shareCents: number }>()

  for (const service of services) {
    const line = grouped.get(service.serviceNameSnapshot)
    if (line) {
      line.count += 1
      line.priceCents += service.servicePriceCents
      line.shareCents += service.commissionCents
    } else {
      grouped.set(service.serviceNameSnapshot, {
        count: 1,
        priceCents: service.servicePriceCents,
        shareCents: service.commissionCents,
      })
    }
  }

  const lines = [...grouped].map(([name, line]) => ({
    name,
    count: line.count,
    priceCents: line.priceCents,
    shareCents: line.shareCents,
    averageCents: roundDiv(line.priceCents, line.count),
  }))

  lines.sort((a, b) => b.shareCents - a.shareCents || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return lines
}

export interface WeekdayLine {
  weekday: number
  days: number
  averageEarnedCents: number
  averageTurns: number // tenths, so 25 means 2.5
  best: boolean
  slowest: boolean
}

/** Seven lines from the week start day. Averages over the days worked on that weekday (days with turns).
 *  Best and slowest by average earned among weekdays worked; none marked with fewer than 2 weekdays worked;
 *  a tie goes to the earlier weekday. */
export function byWeekday(
  turns: readonly TurnFigures[],
  adjustments: readonly DatedAdjustment[],
  weekStart: 0 | 1,
): WeekdayLine[] {
  const earnedByDate = new Map<IsoDate, number>()
  const turnsByDate = new Map<IsoDate, number>()

  for (const turn of turns) {
    const date = turn.localWorkDate
    earnedByDate.set(
      date,
      (earnedByDate.get(date) ?? 0) +
        turn.commissionTotalCents +
        turn.cashTipCents +
        turn.cardTipCents,
    )
    turnsByDate.set(date, (turnsByDate.get(date) ?? 0) + turn.turnCount)
  }

  for (const adjustment of adjustments) {
    if (!turnsByDate.has(adjustment.localWorkDate)) continue
    earnedByDate.set(
      adjustment.localWorkDate,
      (earnedByDate.get(adjustment.localWorkDate) ?? 0) + adjustment.amountCents,
    )
  }

  const lines: WeekdayLine[] = []
  for (let offset = 0; offset < 7; offset += 1) {
    const weekday = (weekStart + offset) % 7
    let days = 0
    let earned = 0
    let turnsTotal = 0

    for (const [date, dateTurns] of turnsByDate) {
      if (dayOfWeek(date) !== weekday) continue
      days += 1
      earned += earnedByDate.get(date) ?? 0
      turnsTotal += dateTurns
    }

    lines.push({
      weekday,
      days,
      averageEarnedCents: days === 0 ? 0 : roundDiv(earned, days),
      averageTurns: days === 0 ? 0 : roundDiv(turnsTotal * 10, days),
      best: false,
      slowest: false,
    })
  }

  const worked = lines.filter((line) => line.days > 0)
  if (worked.length >= 2) {
    let best = worked[0]
    let slowest = worked[0]
    for (const line of worked) {
      if (line.averageEarnedCents > best.averageEarnedCents) best = line
      if (line.averageEarnedCents < slowest.averageEarnedCents) slowest = line
    }
    best.best = true
    slowest.slowest = true
  }

  return lines
}

export interface ClientLine {
  kind: 'request' | 'walkIn' | 'unspecified'
  clients: number
  percent: number
  averageTipCents: number
}

/** Clients are turns with turnCount >= 1 (as sumTotals counts customers). Lines with no clients are left out. */
export function clients(
  turns: readonly (TurnFigures & { clientType: 'request' | 'walkIn' | 'unspecified' })[],
): ClientLine[] {
  const order = ['request', 'walkIn', 'unspecified'] as const
  const grouped = new Map<string, { clients: number; tipsCents: number }>()
  let total = 0

  for (const turn of turns) {
    if (turn.turnCount < 1) continue
    total += 1
    const line = grouped.get(turn.clientType)
    const tipsCents = turn.cashTipCents + turn.cardTipCents
    if (line) {
      line.clients += 1
      line.tipsCents += tipsCents
    } else {
      grouped.set(turn.clientType, { clients: 1, tipsCents })
    }
  }

  if (total === 0) return []

  const lines: ClientLine[] = []
  for (const kind of order) {
    const line = grouped.get(kind)
    if (!line || line.clients === 0) continue
    lines.push({
      kind,
      clients: line.clients,
      percent: roundDiv(line.clients * 100, total),
      averageTipCents: roundDiv(line.tipsCents, line.clients),
    })
  }
  return lines
}

export interface TipsSummary {
  cashCents: number
  cardCents: number
  averagePerClientCents: number
  percentOfPrice: number | null
  cardHeldCents: number
}

export function tipsSummary(turns: readonly TurnFigures[]): TipsSummary {
  const totals = sumTotals(turns, [])
  const clientsCount = turns.filter((turn) => turn.turnCount >= 1).length

  let cardHeldCents = 0
  for (const turn of turns) {
    if (!turn.cardTipReceived) cardHeldCents += turn.cardTipCents
  }

  return {
    cashCents: totals.cashTipsCents,
    cardCents: totals.cardTipsCents,
    averagePerClientCents: clientsCount === 0 ? 0 : roundDiv(totals.tipsCents, clientsCount),
    percentOfPrice:
      totals.serviceRevenueCents > 0
        ? roundDiv(totals.tipsCents * 100, totals.serviceRevenueCents)
        : null,
    cardHeldCents,
  }
}

export interface Records {
  bestDay: { date: IsoDate; cents: number }
  bestWeek: { start: IsoDate; cents: number }
  bestMonth: { start: IsoDate; cents: number }
  mostTurns: { date: IsoDate; turns: number }
}

function bestBucket(cents: ReadonlyMap<IsoDate, number>): { start: IsoDate; cents: number } {
  const keys = [...cents.keys()].sort()
  let best = { start: keys[0], cents: cents.get(keys[0]) ?? 0 }

  for (const key of keys) {
    const value = cents.get(key) ?? 0
    if (value > best.cents) best = { start: key, cents: value }
  }
  return best
}

/** All-time records by earned (turns plus dated adjustments). null until the first turn is at least 28 days
 *  before `today`. Ties go to the earlier date. */
export function records(
  turns: readonly TurnFigures[],
  adjustments: readonly DatedAdjustment[],
  weekStart: 0 | 1,
  today: IsoDate,
): Records | null {
  if (turns.length === 0) return null

  let earliest = turns[0].localWorkDate
  for (const turn of turns) {
    if (turn.localWorkDate < earliest) earliest = turn.localWorkDate
  }
  if (diffDays(today, earliest) < 28) return null

  const turnsByDate = new Map<IsoDate, TurnFigures[]>()
  for (const turn of turns) {
    const group = turnsByDate.get(turn.localWorkDate)
    if (group) group.push(turn)
    else turnsByDate.set(turn.localWorkDate, [turn])
  }

  const adjustmentsByDate = new Map<IsoDate, DatedAdjustment[]>()
  for (const adjustment of adjustments) {
    const group = adjustmentsByDate.get(adjustment.localWorkDate)
    if (group) group.push(adjustment)
    else adjustmentsByDate.set(adjustment.localWorkDate, [adjustment])
  }

  const dates = [...new Set([...turnsByDate.keys(), ...adjustmentsByDate.keys()])].sort()

  const weekCents = new Map<IsoDate, number>()
  const monthCents = new Map<IsoDate, number>()
  let bestDay = { date: dates[0], cents: Number.NEGATIVE_INFINITY }
  let mostTurns = { date: dates[0], turns: Number.NEGATIVE_INFINITY }

  for (const date of dates) {
    const totals = sumTotals(turnsByDate.get(date) ?? [], adjustmentsByDate.get(date) ?? [])

    if (totals.earnedCents > bestDay.cents) {
      bestDay = { date, cents: totals.earnedCents }
    }
    if (totals.turns > mostTurns.turns) {
      mostTurns = { date, turns: totals.turns }
    }

    const week = weekRange(date, weekStart).start
    weekCents.set(week, (weekCents.get(week) ?? 0) + totals.earnedCents)

    const month = monthRange(date).start
    monthCents.set(month, (monthCents.get(month) ?? 0) + totals.earnedCents)
  }

  return {
    bestDay,
    bestWeek: bestBucket(weekCents),
    bestMonth: bestBucket(monthCents),
    mostTurns,
  }
}
