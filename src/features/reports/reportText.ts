import {
  formatDayLong,
  formatMonthYear,
  formatRange,
  type DateLocale,
  type IsoDate,
} from '../../domain/dates.ts'
import { formatUsd } from '../../domain/money.ts'
import { t, tf, type StringKey } from '../../lib/i18n.ts'
import type { ReportChoice } from './reportsRange.ts'

/** The words the Reports screen and its shared picture both use. */
export function rangeLabel(
  choice: Exclude<ReportChoice, 'custom'>,
  date: IsoDate,
  start: IsoDate,
  end: IsoDate,
  locale: DateLocale,
): string {
  switch (choice) {
    case 'day':
      return formatDayLong(date, locale)
    case 'week':
      return formatRange(start, end, locale)
    case 'month':
      return formatMonthYear(date, locale)
    case 'year':
      return start.slice(0, 4)
  }
}

export function previousLabel(choice: ReportChoice, locale: DateLocale): string {
  switch (choice) {
    case 'day':
      return t(locale, 'reportSpanSameDayLastWeek')
    case 'week':
      return t(locale, 'reportSpanLastWeek')
    case 'month':
      return t(locale, 'reportSpanLastMonth')
    case 'year':
      return t(locale, 'reportSpanLastYear')
    case 'custom':
      return t(locale, 'reportSpanDaysBefore')
  }
}

export function changeText(
  locale: DateLocale,
  differenceCents: number,
  percent: number | null,
  span: string,
): string {
  if (differenceCents === 0) return tf(locale, 'reportChangeSame', { span })
  const amount = formatUsd(Math.abs(differenceCents))
  const percentText = percent === null ? '' : ` (${percent}%)`
  const key: StringKey = differenceCents > 0 ? 'reportChangeUp' : 'reportChangeDown'
  return tf(locale, key, { amount, percent: percentText, span })
}

export function turnsAverage(tenths: number): string {
  return `${Math.trunc(tenths / 10)}.${Math.abs(tenths % 10)}`
}
