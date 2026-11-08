// Hours maths. Plain TypeScript: no React, no Dexie. Clock times are 'HH:MM'
// in the phone's local time; a day that ends after midnight keeps its date.

import { addDays, localDateTimeToMs, type IsoDate } from './dates.ts'
import { roundDiv } from './money.ts'
import { sumTotals, type DatedAdjustment, type TurnFigures } from './totals.ts'

export interface DayHours {
  date: IsoDate
  startTime: string | null
  endTime: string | null
}

const CLOCK = /^(\d{2}):(\d{2})$/

function clockMinutes(time: string): number {
  const match = CLOCK.exec(time)
  if (!match) throw new Error(`Invalid time: ${time}`)

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${time}`)
  return hours * 60 + minutes
}

function clockText(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440
  const hours = String(Math.trunc(wrapped / 60)).padStart(2, '0')
  return `${hours}:${String(wrapped % 60).padStart(2, '0')}`
}

/** Minutes worked. An end earlier than the start means the next day. */
export function workMinutes(start: string, end: string): number {
  const from = clockMinutes(start)
  const to = clockMinutes(end)
  return to < from ? to + 1440 - from : to - from
}

export interface HoursSuggestion {
  start: string
  end: string
  firstTurnAt: number
  lastTurnAt: number
}

/** 20 minutes before the first turn and after the last, rounded to the quarter-hour. */
export function suggestHours(firstTurnAt: number, lastTurnAt: number): HoursSuggestion {
  const first = new Date(firstTurnAt)
  const last = new Date(lastTurnAt)
  const firstMinutes = first.getHours() * 60 + first.getMinutes()
  const lastMinutes = last.getHours() * 60 + last.getMinutes()
  return {
    start: clockText(Math.floor((firstMinutes - 20) / 15) * 15),
    end: clockText(Math.ceil((lastMinutes + 20) / 15) * 15),
    firstTurnAt,
    lastTurnAt,
  }
}

/**
 * A suggestion for a work day. A turn saved days later carries the moment it
 * was entered, which falls outside the day and the next early morning, so it
 * is ignored. No turns in that window means no suggestion.
 */
export function suggestionForDay(
  turns: readonly { occurredAt: number }[],
  date: IsoDate,
): HoursSuggestion | null {
  const from = localDateTimeToMs(date, '00:00')
  const until = localDateTimeToMs(addDays(date, 1), '06:00')
  const moments = turns
    .map((turn) => turn.occurredAt)
    .filter((occurredAt) => occurredAt >= from && occurredAt <= until)

  if (moments.length === 0) return null
  return suggestHours(Math.min(...moments), Math.max(...moments))
}

/** The most recent day, today or yesterday, that has a start and no end. */
export function openDay(days: readonly DayHours[], today: IsoDate): DayHours | null {
  const yesterday = addDays(today, -1)
  return (
    [...days]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .find(
        (day) =>
          day.date >= yesterday &&
          day.date <= today &&
          day.startTime !== null &&
          day.endTime === null,
      ) ?? null
  )
}

export function perHourCents(cents: number, minutes: number): number | null {
  if (minutes === 0) return null
  return roundDiv(cents * 60, minutes)
}

export interface HoursPay {
  minutes: number
  /** Earned including all tips, per hour. */
  withTipsCents: number | null
  /** Earned without tips, per hour. */
  withoutTipsCents: number | null
}

/**
 * Pay per hour from the days that have both times. Only their turns and
 * adjustments count, so a forgotten day does not drag the number down.
 */
export function hoursPay(
  turns: readonly TurnFigures[],
  adjustments: readonly DatedAdjustment[],
  days: readonly DayHours[],
): HoursPay {
  const counted = days.filter(
    (day): day is DayHours & { startTime: string; endTime: string } =>
      day.startTime !== null && day.endTime !== null,
  )
  const minutes = counted.reduce((sum, day) => sum + workMinutes(day.startTime, day.endTime), 0)
  if (minutes === 0) return { minutes, withTipsCents: null, withoutTipsCents: null }

  const dates = new Set(counted.map((day) => day.date))
  const totals = sumTotals(
    turns.filter((turn) => dates.has(turn.localWorkDate)),
    adjustments.filter((adjustment) => dates.has(adjustment.localWorkDate)),
  )
  return {
    minutes,
    withTipsCents: perHourCents(totals.earnedCents, minutes),
    withoutTipsCents: perHourCents(totals.earnedCents - totals.tipsCents, minutes),
  }
}
