// Which pay period Home's Pay period chip shows, and the one before it.
// Plain TypeScript: the stored periods come in as dates, nothing is read here.

import type { Span } from './comparisons.ts'
import { addDays, diffDays, type IsoDate } from './dates.ts'
import {
  periodContaining,
  periodLengthDays,
  type DateSpan,
  type PayPeriodType,
} from './payPeriods.ts'

export interface PaySchedule {
  type: PayPeriodType
  anchor: IsoDate | null
}

/** Weekly and every two weeks count from a first day; custom periods are typed in by hand. */
export function isCounted(schedule: PaySchedule): schedule is {
  type: 'weekly' | 'biweekly'
  anchor: IsoDate
} {
  return (schedule.type === 'weekly' || schedule.type === 'biweekly') && schedule.anchor !== null
}

/**
 * The pay period holding today. A stored period wins for every schedule, so
 * Home, Payday and "Salon owes" always agree. Only a weekly or two-week
 * schedule whose rows are not stored yet counts the period out from its first
 * day (before that day too, the same way the stored rows are filled in).
 */
export function currentPayPeriod(
  stored: readonly DateSpan[],
  schedule: PaySchedule,
  today: IsoDate,
): DateSpan | null {
  const row = stored.find((span) => span.startDate <= today && today <= span.endDate)
  if (row) return { startDate: row.startDate, endDate: row.endDate }
  if (!isCounted(schedule)) return null
  return periodContaining(today, schedule.anchor, periodLengthDays(schedule.type))
}

/** The stored or counted period that ended latest before this one started. */
export function previousPayPeriod(
  stored: readonly DateSpan[],
  schedule: PaySchedule,
  current: DateSpan,
): DateSpan | null {
  let best: DateSpan | null = null
  const consider = (span: DateSpan) => {
    if (span.endDate < current.startDate && (best === null || span.endDate > best.endDate)) {
      best = { startDate: span.startDate, endDate: span.endDate }
    }
  }

  for (const span of stored) consider(span)
  if (isCounted(schedule)) {
    consider(
      periodContaining(
        addDays(current.startDate, -1),
        schedule.anchor,
        periodLengthDays(schedule.type),
      ),
    )
  }
  return best
}

/** The period so far: its first day to today. */
export function payCurrentSpan(current: DateSpan, today: IsoDate): Span {
  return { start: current.startDate, end: today < current.endDate ? today : current.endDate }
}

/** The same stretch of the previous period: as many days from its first day, never past its end. */
export function payPreviousSpan(current: DateSpan, previous: DateSpan, today: IsoDate): Span {
  const end = addDays(previous.startDate, Math.max(0, diffDays(today, current.startDate)))
  return { start: previous.startDate, end: end < previous.endDate ? end : previous.endDate }
}
