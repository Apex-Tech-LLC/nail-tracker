import { addDays, diffDays, type IsoDate } from './dates.ts'

export type PayPeriodType = 'weekly' | 'biweekly' | 'custom' | 'none'

export interface DateSpan {
  startDate: IsoDate
  endDate: IsoDate
}

export function periodLengthDays(type: 'weekly' | 'biweekly'): number {
  return type === 'weekly' ? 7 : 14
}

/** Built from the dates, so a restored backup and a second phone agree on the id. */
export function periodId(start: IsoDate, end: IsoDate): string {
  return `period-${start}-${end}`
}

/** Math.floor, not truncation: dates before the anchor belong to an earlier period. */
export function periodContaining(date: IsoDate, anchor: IsoDate, length: number): DateSpan {
  const index = Math.floor(diffDays(date, anchor) / length)
  const startDate = addDays(anchor, index * length)
  return { startDate, endDate: addDays(startDate, length - 1) }
}

function overlaps(a: DateSpan, b: DateSpan): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate
}

export function missingPeriods(
  existing: readonly DateSpan[],
  schedule: { type: PayPeriodType; anchor: IsoDate | null },
  earliest: IsoDate,
  today: IsoDate,
): DateSpan[] {
  if ((schedule.type !== 'weekly' && schedule.type !== 'biweekly') || schedule.anchor === null) {
    return []
  }

  const length = periodLengthDays(schedule.type)
  const last = periodContaining(today, schedule.anchor, length)
  const missing: DateSpan[] = []

  let span = periodContaining(earliest, schedule.anchor, length)
  while (span.startDate <= last.startDate) {
    if (!existing.some((known) => overlaps(known, span))) missing.push(span)
    span = periodContaining(addDays(span.startDate, length), schedule.anchor, length)
  }

  return missing
}

export function customPeriodProblem(
  start: IsoDate,
  end: IsoDate,
  existing: readonly (DateSpan & { id: string })[],
  ignoreId?: string,
): 'endBeforeStart' | 'overlap' | null {
  if (end < start) return 'endBeforeStart'

  const candidate = { startDate: start, endDate: end }
  const clash = existing.some((known) => known.id !== ignoreId && overlaps(known, candidate))
  return clash ? 'overlap' : null
}
