// Short labels for the Home chart. Plain TypeScript: no React, no Dexie.

import { dayOfWeek, parseIsoDate } from './dates.ts'
import type { DateLocale, IsoDate } from './dates.ts'

const WEEKDAYS: Record<DateLocale, readonly string[]> = {
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  vi: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
}

/** A day name over a short date: 'Sun' over '11/8' in English, 'CN' over '8/11' in Vietnamese. */
export function dayLabels(iso: IsoDate, locale: DateLocale): { weekday: string; date: string } {
  const { month, day } = parseIsoDate(iso)
  return {
    weekday: WEEKDAYS[locale][dayOfWeek(iso)],
    date: locale === 'vi' ? `${day}/${month}` : `${month}/${day}`,
  }
}

/** A clock time that fits a narrow bar: '9:30a' or '2:05p' in English, '14:05' in Vietnamese. */
export function shortClock(ms: number, locale: DateLocale): string {
  const moment = new Date(ms)
  const hours = moment.getHours()
  const minutes = String(moment.getMinutes()).padStart(2, '0')
  if (locale === 'vi') return `${hours}:${minutes}`
  return `${hours % 12 === 0 ? 12 : hours % 12}:${minutes}${hours < 12 ? 'a' : 'p'}`
}
