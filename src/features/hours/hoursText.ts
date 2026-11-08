import { formatTime, localDateTimeToMs, type DateLocale } from '../../domain/dates.ts'
import { workMinutes } from '../../domain/hours.ts'
import { tf } from '../../lib/i18n.ts'

// Any date works for showing a clock time; only the hours and minutes matter.
const SAMPLE_DATE = '2026-01-01'

export function clockText(time: string, locale: DateLocale): string {
  return formatTime(localDateTimeToMs(SAMPLE_DATE, time), locale)
}

export function durationText(locale: DateLocale, minutes: number): string {
  const hours = Math.trunc(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return tf(locale, 'hoursMinuteShort', { n: rest })
  if (rest === 0) return tf(locale, 'hoursHourShort', { n: hours })
  return tf(locale, 'hoursMinutes', { h: hours, m: rest })
}

/** "9:45 AM – 7:00 PM · 9 h 15 min" */
export function dayHoursText(locale: DateLocale, start: string, end: string): string {
  return `${clockText(start, locale)} – ${clockText(end, locale)} · ${durationText(
    locale,
    workMinutes(start, end),
  )}`
}
