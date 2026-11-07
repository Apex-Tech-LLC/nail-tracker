// Comparison maths for Home. Plain TypeScript: no React, no Dexie.
// A span is the stretch already lived through, so Home compares like with like.

import { addDays, monthRange, parseIsoDate, weekRange } from './dates.ts'
import type { IsoDate } from './dates.ts'

export type HomePeriod = 'today' | 'week' | 'month'

export interface Span {
  start: IsoDate
  end: IsoDate
}

const pad = (n: number) => String(n).padStart(2, '0')

function isoDay(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

function firstOfMonth(year: number, month: number): IsoDate {
  return isoDay(year, month, 1)
}

/** The current period so far: today only; week start to today; month start to today. */
export function currentSpan(period: HomePeriod, today: IsoDate, weekStart: 0 | 1): Span {
  if (period === 'today') return { start: today, end: today }
  if (period === 'week') return { start: weekRange(today, weekStart).start, end: today }
  return { start: monthRange(today).start, end: today }
}

/**
 * The same stretch of the previous period:
 * - today: the same weekday last week (today - 7).
 * - week: last week's start to the same weekday last week.
 * - month: last month's day 1 to the same day number, capped at last month's last day
 *   (March 31 compares with February 1 to February 28, or 29 in a leap year).
 */
export function previousSpan(period: HomePeriod, today: IsoDate, weekStart: 0 | 1): Span {
  if (period === 'today') {
    const day = addDays(today, -7)
    return { start: day, end: day }
  }

  if (period === 'week') {
    const start = addDays(weekRange(today, weekStart).start, -7)
    return { start, end: addDays(today, -7) }
  }

  const { year, month, day } = parseIsoDate(today)
  const previousYear = month === 1 ? year - 1 : year
  const previousMonth = month === 1 ? 12 : month - 1
  const previous = monthRange(firstOfMonth(previousYear, previousMonth))
  const lastDay = parseIsoDate(previous.end).day
  return {
    start: previous.start,
    end: isoDay(previousYear, previousMonth, Math.min(day, lastDay)),
  }
}

export interface Comparison {
  kind: 'more' | 'less' | 'same' | 'nothingToCompare'
  differenceCents: number // always zero or positive
}

/** nothingToCompare when the previous span had no turns at all (previousTurns === 0). */
export function compare(currentCents: number, previousCents: number, previousTurns: number): Comparison {
  if (previousTurns === 0) return { kind: 'nothingToCompare', differenceCents: 0 }

  const difference = currentCents - previousCents
  const differenceCents = Math.abs(difference)
  if (difference > 0) return { kind: 'more', differenceCents }
  if (difference < 0) return { kind: 'less', differenceCents }
  return { kind: 'same', differenceCents }
}

export interface WeekDay {
  date: IsoDate
  earnedCents: number
  isFuture: boolean
  isToday: boolean
  lastWeekEarnedCents: number
}

/**
 * Seven days of the week holding `today`, in order from the week start day, each with that day's
 * earned total and the same weekday's total last week. `earnedByDate` holds earned cents per work date
 * and may include dates outside the two weeks.
 */
export function weekDays(
  today: IsoDate,
  weekStart: 0 | 1,
  earnedByDate: ReadonlyMap<IsoDate, number>,
): WeekDay[] {
  const start = weekRange(today, weekStart).start
  const days: WeekDay[] = []
  for (let index = 0; index < 7; index += 1) {
    const date = addDays(start, index)
    days.push({
      date,
      earnedCents: earnedByDate.get(date) ?? 0,
      isFuture: date > today,
      isToday: date === today,
      lastWeekEarnedCents: earnedByDate.get(addDays(date, -7)) ?? 0,
    })
  }
  return days
}

/** Fill level for the week view, 0 to 100: earned divided by the largest value among this week's and last week's days, rounded. 0 when everything is 0. */
export function fillPercent(earnedCents: number, maxCents: number): number {
  if (maxCents <= 0) return 0
  const percent = Math.round((earnedCents / maxCents) * 100)
  return Math.min(100, Math.max(0, percent))
}
