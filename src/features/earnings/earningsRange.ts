import {
  addDays,
  monthRange,
  weekRange,
  yearRange,
  type IsoDate,
} from '../../domain/dates.ts'

export type PeriodChoice = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export function rangeOf(
  choice: Exclude<PeriodChoice, 'custom'>,
  date: IsoDate,
  weekStart: 0 | 1,
): { start: IsoDate; end: IsoDate } {
  switch (choice) {
    case 'daily':
      return { start: date, end: date }
    case 'weekly':
      return weekRange(date, weekStart)
    case 'monthly':
      return monthRange(date)
    case 'yearly':
      return yearRange(date)
  }
}

/** Moves to the neighbouring period. The returned date is always a real day. */
export function stepDate(
  choice: Exclude<PeriodChoice, 'custom'>,
  date: IsoDate,
  direction: -1 | 1,
): IsoDate {
  switch (choice) {
    case 'daily':
      return addDays(date, direction)
    case 'weekly':
      return addDays(date, direction * 7)
    case 'monthly': {
      const { start, end } = monthRange(date)
      return addDays(direction === -1 ? start : end, direction)
    }
    case 'yearly': {
      const { start, end } = yearRange(date)
      return addDays(direction === -1 ? start : end, direction)
    }
  }
}
