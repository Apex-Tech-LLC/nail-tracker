import { addDays, diffDays, monthRange, weekRange, type IsoDate } from '../../domain/dates.ts'

/** Every day of the month grid, seven to a week, starting on the person's week start day. */
export function calendarWeeks(monthIso: IsoDate, weekStart: 0 | 1): IsoDate[][] {
  const range = monthRange(monthIso)
  const gridStart = weekRange(range.start, weekStart).start
  const gridEnd = weekRange(range.end, weekStart).end
  const dayCount = diffDays(gridEnd, gridStart) + 1

  const weeks: IsoDate[][] = []
  for (let offset = 0; offset < dayCount; offset += 7) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(gridStart, offset + index)))
  }
  return weeks
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
