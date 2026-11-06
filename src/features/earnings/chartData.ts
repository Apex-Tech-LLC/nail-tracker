import {
  addDays,
  diffDays,
  formatDayShort,
  monthRange,
  parseIsoDate,
  weekRange,
  type DateLocale,
  type IsoDate,
} from '../../domain/dates.ts'
import {
  sumTotals,
  type AdjustmentFigures,
  type TurnFigures,
} from '../../domain/totals.ts'

export interface ChartBar {
  key: string // a date, a week start, or a month start
  label: string
  earnedCents: number
  revenueCents: number
}

type BucketSize = 'day' | 'week' | 'month'

function toIso(year: number, month: number, day: number): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/** The start of the bucket a work day belongs to. */
function bucketStart(date: IsoDate, size: BucketSize, weekStart: 0 | 1): IsoDate {
  switch (size) {
    case 'day':
      return date
    case 'week':
      return weekRange(date, weekStart).start
    case 'month':
      return monthRange(date).start
  }
}

/** Every bucket start from the one holding `start` to the last one that begins on or before `end`. */
function bucketKeys(start: IsoDate, end: IsoDate, size: BucketSize, weekStart: 0 | 1): IsoDate[] {
  const first = bucketStart(start, size, weekStart)
  const keys: IsoDate[] = []

  if (size === 'day') {
    for (let date = first; date <= end; date = addDays(date, 1)) keys.push(date)
    return keys
  }

  if (size === 'week') {
    for (let key = first; key <= end; key = addDays(key, 7)) keys.push(key)
    return keys
  }

  const { year: firstYear, month: firstMonth } = parseIsoDate(first)
  const { year: lastYear, month: lastMonth } = parseIsoDate(end)
  const months = (lastYear - firstYear) * 12 + (lastMonth - firstMonth) + 1
  for (let index = 0; index < months; index += 1) {
    // Count months from a zero-based absolute month so December rolls into January.
    const absolute = firstYear * 12 + (firstMonth - 1) + index
    keys.push(toIso(Math.floor(absolute / 12), (absolute % 12) + 1, 1))
  }
  return keys
}

function labelOf(key: IsoDate, size: BucketSize, locale: DateLocale): string {
  if (size === 'day') return String(parseIsoDate(key).day)
  if (size === 'week') return formatDayShort(key, locale)

  const { year, month } = parseIsoDate(key)
  if (locale === 'vi') return `T${month}`

  return new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  )
}

/**
 * One bar per day, week or month, chosen by the length of the range.
 * Edges are kept whole, so the bars cover every day data could sit on.
 */
export function buildBars(
  turns: readonly TurnFigures[],
  adjustments: readonly (AdjustmentFigures & { localWorkDate: string })[],
  start: IsoDate,
  end: IsoDate,
  weekStart: 0 | 1,
  locale: DateLocale,
): ChartBar[] {
  const days = diffDays(end, start) + 1
  const size: BucketSize = days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
  const keys = bucketKeys(start, end, size, weekStart)

  const turnsByKey = new Map<string, TurnFigures[]>()
  for (const turn of turns) {
    if (turn.localWorkDate < start || turn.localWorkDate > end) continue
    const key = bucketStart(turn.localWorkDate, size, weekStart)
    const group = turnsByKey.get(key)
    if (group) group.push(turn)
    else turnsByKey.set(key, [turn])
  }

  const adjustmentsByKey = new Map<string, (AdjustmentFigures & { localWorkDate: string })[]>()
  for (const adjustment of adjustments) {
    if (adjustment.localWorkDate < start || adjustment.localWorkDate > end) continue
    const key = bucketStart(adjustment.localWorkDate, size, weekStart)
    const group = adjustmentsByKey.get(key)
    if (group) group.push(adjustment)
    else adjustmentsByKey.set(key, [adjustment])
  }

  return keys.map((key) => {
    const totals = sumTotals(turnsByKey.get(key) ?? [], adjustmentsByKey.get(key) ?? [])
    return {
      key,
      label: labelOf(key, size, locale),
      earnedCents: totals.earnedCents,
      revenueCents: totals.serviceRevenueCents,
    }
  })
}

/** The largest value, so bars can be scaled. At least 1, so nothing divides by zero. */
export function chartMax(bars: readonly ChartBar[]): number {
  let max = 1
  for (const bar of bars) {
    max = Math.max(max, bar.earnedCents, bar.revenueCents)
  }
  return max
}
