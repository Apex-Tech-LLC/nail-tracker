import { addDays, diffDays, monthRange, weekRange, type IsoDate } from '../../domain/dates.ts'

/**
 * Rows of seven days that cover start to end. Rows begin on the week start
 * day, or on `start` itself when no week start is given (a pay period's rows
 * begin on its own first day).
 */
export function dayRows(start: IsoDate, end: IsoDate, weekStart?: 0 | 1): IsoDate[][] {
  const gridStart = weekStart === undefined ? start : weekRange(start, weekStart).start
  const gridEnd = weekStart === undefined ? end : weekRange(end, weekStart).end
  const dayCount = diffDays(gridEnd, gridStart) + 1

  const rows: IsoDate[][] = []
  for (let offset = 0; offset < dayCount; offset += 7) {
    rows.push(Array.from({ length: 7 }, (_, index) => addDays(gridStart, offset + index)))
  }
  return rows
}

/** Every day of the month grid, seven to a week, starting on the person's week start day. */
export function calendarWeeks(monthIso: IsoDate, weekStart: 0 | 1): IsoDate[][] {
  const range = monthRange(monthIso)
  return dayRows(range.start, range.end, weekStart)
}

/** At most six rows: a longer stretch shows the six rows ending at the row with today. */
export function visibleRows(rows: IsoDate[][], today: IsoDate, limit = 6): IsoDate[][] {
  if (rows.length <= limit) return rows
  const todayRow = rows.findIndex((row) => row.includes(today))
  const first = Math.min(Math.max(todayRow - (limit - 1), 0), rows.length - limit)
  return rows.slice(first, first + limit)
}

export type ColorStep = 0 | 1 | 2 | 3 | 4

/**
 * How dark a day's cell is: nothing for no money, then four steps by the day's
 * share of the month's best day.
 */
export function colorStep(earnedCents: number, bestCents: number): ColorStep {
  if (earnedCents <= 0 || bestCents <= 0) return 0
  const share = earnedCents / bestCents
  if (share > 0.75) return 4
  if (share > 0.5) return 3
  if (share > 0.25) return 2
  return 1
}
