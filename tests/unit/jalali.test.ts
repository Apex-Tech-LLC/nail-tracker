import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatMonth,
  isoToJalali,
  jalaliToIso,
  monthRange,
  parseIsoDate,
  previousMonth,
  todayIso,
} from '../../src/lib/jalali.ts'

describe('known dates', () => {
  it.each([
    ['2024-03-20', { year: 1403, month: 1, day: 1 }],
    ['2025-03-21', { year: 1404, month: 1, day: 1 }],
    ['2026-11-03', { year: 1405, month: 8, day: 12 }],
    ['2026-09-22', { year: 1405, month: 6, day: 31 }],
    ['2026-09-23', { year: 1405, month: 7, day: 1 }],
  ])('%s is %o', (iso, jalali) => {
    expect(isoToJalali(iso)).toEqual(jalali)
    expect(jalaliToIso(jalali.year, jalali.month, jalali.day)).toBe(iso)
  })
})

describe('leap years', () => {
  it('has Esfand 30 in leap year 1403', () => {
    expect(jalaliToIso(1403, 12, 30)).toBe('2025-03-20')
    expect(monthRange(1403, 12, 'jalali').end).toBe('2025-03-20')
  })

  it('has no Esfand 30 in 1404', () => {
    expect(() => jalaliToIso(1404, 12, 30)).toThrow()
    expect(monthRange(1404, 12, 'jalali').end).toBe('2026-03-20')
  })

  it('goes from the last day of a leap year straight to Nowruz', () => {
    expect(isoToJalali('2025-03-20')).toEqual({ year: 1403, month: 12, day: 30 })
    expect(isoToJalali('2025-03-21')).toEqual({ year: 1404, month: 1, day: 1 })
  })
})

describe('monthRange', () => {
  it('covers a Jalali month that spans two Gregorian months', () => {
    expect(monthRange(1405, 8, 'jalali')).toEqual({ start: '2026-10-23', end: '2026-11-21' })
  })

  it('handles 31-day Jalali months', () => {
    expect(monthRange(1405, 6, 'jalali')).toEqual({ start: '2026-08-23', end: '2026-09-22' })
  })

  it('handles Gregorian February in leap and normal years', () => {
    expect(monthRange(2024, 2, 'gregorian').end).toBe('2024-02-29')
    expect(monthRange(2026, 2, 'gregorian').end).toBe('2026-02-28')
  })

  it('works with plain string comparison', () => {
    const { start, end } = monthRange(1405, 8, 'jalali')
    expect('2026-10-22' >= start).toBe(false)
    expect('2026-11-03' >= start && '2026-11-03' <= end).toBe(true)
    expect('2026-11-22' <= end).toBe(false)
  })
})

describe('previousMonth', () => {
  it('wraps from the first month to the last month of the year before', () => {
    expect(previousMonth(1405, 1)).toEqual({ year: 1404, month: 12 })
    expect(previousMonth(1405, 8)).toEqual({ year: 1405, month: 7 })
  })
})

describe('parseIsoDate', () => {
  it.each(['2026-02-30', '2026-13-01', '2026-1-3', '03-11-2026', '', 'today'])('rejects %j', (iso) => {
    expect(() => parseIsoDate(iso)).toThrow()
  })
})

describe('todayIso', () => {
  it('uses local date parts, zero padded', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})

describe('formatting', () => {
  it('formats in Persian with the Jalali calendar', () => {
    expect(formatDate('2026-11-03', 'fa', 'jalali')).toBe('سه‌شنبه ۱۲ آبان ۱۴۰۵')
    expect(formatMonth(1405, 8, 'fa', 'jalali')).toBe('آبان ۱۴۰۵')
  })

  it('formats in English with the Jalali calendar', () => {
    expect(formatDate('2026-11-03', 'en', 'jalali')).toBe('Tue 12 Aban 1405')
    expect(formatMonth(1405, 8, 'en', 'jalali')).toBe('Aban 1405')
  })

  it('formats with the Gregorian calendar in both languages', () => {
    expect(formatDate('2026-11-03', 'en', 'gregorian')).toBe('Tue 3 November 2026')
    expect(formatDate('2026-11-03', 'fa', 'gregorian')).toBe('سه‌شنبه ۳ نوامبر ۲۰۲۶')
  })

  it('can drop the weekday and the year', () => {
    expect(formatDate('2026-11-03', 'fa', 'jalali', { weekday: false, year: false })).toBe('۱۲ آبان')
  })
})
