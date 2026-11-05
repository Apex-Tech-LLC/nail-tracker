// A work day is text ('2026-11-04'), so days sort and compare as strings.
// Every day calculation goes through Date.UTC so a clock change cannot move it.

export type IsoDate = string
export type DateLocale = 'en' | 'vi'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME = /^(\d{2}):(\d{2})$/

const pad = (n: number) => String(n).padStart(2, '0')

function toIso(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

export function parseIsoDate(iso: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE.exec(iso)
  if (!match) throw new Error(`Invalid ISO date: ${iso}`)

  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid ISO date: ${iso}`)
  }
  return { year, month, day }
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  try {
    parseIsoDate(value)
    return true
  } catch {
    return false
  }
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(iso)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

function utcMs(iso: IsoDate): number {
  const { year, month, day } = parseIsoDate(iso)
  return Date.UTC(year, month - 1, day)
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((utcMs(a) - utcMs(b)) / 86400000)
}

export function dayOfWeek(iso: IsoDate): number {
  return new Date(utcMs(iso)).getUTCDay()
}

export function weekRange(iso: IsoDate, weekStart: 0 | 1): { start: IsoDate; end: IsoDate } {
  const offset = (dayOfWeek(iso) - weekStart + 7) % 7
  const start = addDays(iso, -offset)
  return { start, end: addDays(start, 6) }
}

export function monthRange(iso: IsoDate): { start: IsoDate; end: IsoDate } {
  const { year, month } = parseIsoDate(iso)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: toIso(year, month, 1), end: toIso(year, month, lastDay) }
}

export function yearRange(iso: IsoDate): { start: IsoDate; end: IsoDate } {
  const { year } = parseIsoDate(iso)
  return { start: toIso(year, 1, 1), end: toIso(year, 12, 31) }
}

function formatIso(
  iso: IsoDate,
  locale: DateLocale,
  options: Intl.DateTimeFormatOptions,
): string {
  const { year, month, day } = parseIsoDate(iso)
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    ...options,
    timeZone: 'UTC',
  }).format(date)
}

export function formatDayLong(iso: IsoDate, locale: DateLocale): string {
  return formatIso(iso, locale, { weekday: 'long', month: 'long', day: 'numeric' })
}

export function formatDayShort(iso: IsoDate, locale: DateLocale): string {
  return formatIso(iso, locale, { month: 'short', day: 'numeric' })
}

export function formatMonthYear(iso: IsoDate, locale: DateLocale): string {
  return formatIso(iso, locale, { month: 'long', year: 'numeric' })
}

export function formatRange(start: IsoDate, end: IsoDate, locale: DateLocale): string {
  if (start === end) return formatDayShort(start, locale)
  return `${formatDayShort(start, locale)} – ${formatDayShort(end, locale)}`
}

export function localDateTimeToMs(iso: IsoDate, time: string): number {
  const match = TIME.exec(time)
  if (!match) throw new Error(`Invalid time: ${time}`)

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${time}`)

  const { year, month, day } = parseIsoDate(iso)
  return new Date(year, month - 1, day, hours, minutes).getTime()
}

export function timeOf(ms: number): string {
  const date = new Date(ms)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}
