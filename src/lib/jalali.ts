import { isValidJalaaliDate, jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'
import type { Locale } from './locale.ts'

// Dates are stored as ISO Gregorian strings ("2026-11-03"): they sort and
// filter correctly as plain strings and any tool can read them in a CSV
// export. Jalali is only a display layer, and so is the Gregorian calendar
// when the user picks it in settings.

export type IsoDate = string
export type Calendar = 'jalali' | 'gregorian'

export interface DateParts {
  year: number
  month: number
  day: number
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

const pad = (n: number) => String(n).padStart(2, '0')

function toIso(year: number, month: number, day: number): IsoDate {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Splits an ISO date into Gregorian parts, throwing on anything malformed. */
export function parseIsoDate(iso: IsoDate): DateParts {
  const match = ISO_DATE.exec(iso)
  if (!match) throw new Error(`Invalid ISO date: ${iso}`)
  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid ISO date: ${iso}`)
  }
  return { year, month, day }
}

/** Today's date in the user's time zone, not UTC. */
export function todayIso(now: Date = new Date()): IsoDate {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function isoToJalali(iso: IsoDate): DateParts {
  const { year, month, day } = parseIsoDate(iso)
  const { jy, jm, jd } = toJalaali(year, month, day)
  return { year: jy, month: jm, day: jd }
}

export function jalaliToIso(year: number, month: number, day: number): IsoDate {
  if (!isValidJalaaliDate(year, month, day)) {
    throw new Error(`Invalid Jalali date: ${year}/${month}/${day}`)
  }
  const { gy, gm, gd } = toGregorian(year, month, day)
  return toIso(gy, gm, gd)
}

/** The date's year, month and day in the chosen calendar. */
export function toCalendar(iso: IsoDate, calendar: Calendar): DateParts {
  return calendar === 'jalali' ? isoToJalali(iso) : parseIsoDate(iso)
}

/**
 * First and last ISO day of a month in the chosen calendar, inclusive.
 * Used to query a month's expenses with a simple string range.
 */
export function monthRange(
  year: number,
  month: number,
  calendar: Calendar,
): { start: IsoDate; end: IsoDate } {
  if (calendar === 'jalali') {
    return {
      start: jalaliToIso(year, month, 1),
      end: jalaliToIso(year, month, jalaaliMonthLength(year, month)),
    }
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { start: toIso(year, month, 1), end: toIso(year, month, lastDay) }
}

/** The month before, wrapping the year. */
export function previousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
}

const MONTHS: Record<Calendar, Record<Locale, readonly string[]>> = {
  jalali: {
    fa: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'],
    en: ['Farvardin', 'Ordibehesht', 'Khordad', 'Tir', 'Mordad', 'Shahrivar', 'Mehr', 'Aban', 'Azar', 'Dey', 'Bahman', 'Esfand'],
  },
  gregorian: {
    fa: ['ژانویه', 'فوریه', 'مارس', 'آوریل', 'مه', 'ژوئن', 'ژوئیه', 'اوت', 'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'],
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  },
}

// Indexed by Date.getUTCDay(): Sunday first.
const WEEKDAYS: Record<Locale, readonly string[]> = {
  fa: ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

// Names are hard-coded instead of read from Intl.DateTimeFormat because
// browsers disagree on Persian month names and on the default calendar
// for fa-IR. Digits still come from Intl, without grouping (no "۱٬۴۰۵").
const digitFormatters: Record<Locale, Intl.NumberFormat> = {
  fa: new Intl.NumberFormat('fa-IR', { useGrouping: false }),
  en: new Intl.NumberFormat('en-US', { useGrouping: false }),
}

const digits = (n: number, locale: Locale) => digitFormatters[locale].format(n)

export function monthName(month: number, locale: Locale, calendar: Calendar): string {
  return MONTHS[calendar][locale][month - 1]
}

/** "آبان ۱۴۰۵", "Aban 1405", "November 2026". */
export function formatMonth(year: number, month: number, locale: Locale, calendar: Calendar): string {
  return `${monthName(month, locale, calendar)} ${digits(year, locale)}`
}

export interface FormatDateOptions {
  weekday?: boolean
  year?: boolean
}

/** "سه‌شنبه ۱۲ آبان ۱۴۰۵", "Tue 12 Aban 1405", "Tue 3 November 2026". */
export function formatDate(
  iso: IsoDate,
  locale: Locale,
  calendar: Calendar,
  { weekday = true, year = true }: FormatDateOptions = {},
): string {
  const parts = toCalendar(iso, calendar)
  const words = [`${digits(parts.day, locale)} ${monthName(parts.month, locale, calendar)}`]
  if (year) words.push(digits(parts.year, locale))
  if (weekday) {
    const { year: gy, month: gm, day: gd } = parseIsoDate(iso)
    words.unshift(WEEKDAYS[locale][new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay()])
  }
  return words.join(' ')
}
