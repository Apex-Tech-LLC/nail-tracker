import {
  addDays,
  monthRange,
  weekRange,
  yearRange,
  type IsoDate,
} from '../../domain/dates.ts'
import type { Span } from '../../domain/comparisons.ts'
import type { ReportKind } from '../../domain/reports.ts'

export type ReportChoice = 'day' | 'week' | 'month' | 'year' | 'custom'
export type SteppableChoice = Exclude<ReportChoice, 'custom'>

export function rangeOf(
  choice: SteppableChoice,
  date: IsoDate,
  weekStart: 0 | 1,
): Span {
  switch (choice) {
    case 'day':
      return { start: date, end: date }
    case 'week':
      return weekRange(date, weekStart)
    case 'month':
      return monthRange(date)
    case 'year':
      return yearRange(date)
  }
}

/** Moves to the neighbouring period. The returned date is always a real day. */
export function stepDate(
  choice: SteppableChoice,
  date: IsoDate,
  direction: -1 | 1,
): IsoDate {
  switch (choice) {
    case 'day':
      return addDays(date, direction)
    case 'week':
      return addDays(date, direction * 7)
    case 'month': {
      const { start, end } = monthRange(date)
      return addDays(direction === -1 ? start : end, direction)
    }
    case 'year': {
      const { start, end } = yearRange(date)
      return addDays(direction === -1 ? start : end, direction)
    }
  }
}

/** The V12 maths works in week, month, year and custom periods; one day reads through the week rules. */
export function reportKindOf(choice: ReportChoice): ReportKind {
  return choice === 'day' ? 'week' : choice
}
