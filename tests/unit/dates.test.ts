import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayOfWeek,
  diffDays,
  formatDayLong,
  formatDatePill,
  formatDayShort,
  formatMonthShort,
  formatMonthShortYear,
  formatMonthYear,
  formatWeekday,
  formatWeekdayLong,
  formatWeekdayShort,
  formatRange,
  formatTime,
  isIsoDate,
  localDateTimeToMs,
  monthRange,
  monthShift,
  parseIsoDate,
  timeOf,
  todayIso,
  weekRange,
  yearRange,
} from '../../src/domain/dates.ts'

describe('parseIsoDate and isIsoDate', () => {
  it('reads a real date', () => {
    expect(parseIsoDate('2026-11-04')).toEqual({ year: 2026, month: 11, day: 4 })
    expect(isIsoDate('2028-02-29')).toBe(true)
  })

  it.each([['2026-02-30'], ['2026-13-01'], ['11/04/2026'], ['2026-1-1'], ['']])('rejects %j', (value) => {
    expect(() => parseIsoDate(value)).toThrow()
    expect(isIsoDate(value)).toBe(false)
  })

  it('isIsoDate is false for anything that is not text', () => {
    expect(isIsoDate(20261104)).toBe(false)
    expect(isIsoDate(null)).toBe(false)
  })
})

describe('todayIso', () => {
  it('uses the local calendar day', () => {
    expect(todayIso(new Date(2026, 10, 4, 23, 59))).toBe('2026-11-04')
    expect(todayIso(new Date(2026, 10, 5, 0, 1))).toBe('2026-11-05')
    expect(todayIso(new Date(2026, 0, 2))).toBe('2026-01-02')
  })
})

describe('addDays and diffDays', () => {
  it.each([
    ['2026-11-04', 1, '2026-11-05'],
    ['2026-11-30', 1, '2026-12-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-11-01', 7, '2026-11-08'], // clocks go back on 2026-11-01 in the US
    ['2026-03-08', 1, '2026-03-09'], // clocks go forward on 2026-03-08 in the US
  ])('%s plus %d is %s', (iso, days, expected) => {
    expect(addDays(iso, days)).toBe(expected)
    expect(diffDays(expected, iso)).toBe(days)
  })
})

describe('dayOfWeek', () => {
  it.each([
    ['2026-11-01', 0],
    ['2026-11-02', 1],
    ['2026-11-04', 3],
    ['2026-11-07', 6],
  ])('%s is day %d', (iso, expected) => {
    expect(dayOfWeek(iso)).toBe(expected)
  })
})

describe('weekRange', () => {
  it('starts on Sunday when asked', () => {
    expect(weekRange('2026-11-04', 0)).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weekRange('2026-11-01', 0)).toEqual({ start: '2026-11-01', end: '2026-11-07' })
    expect(weekRange('2026-11-07', 0)).toEqual({ start: '2026-11-01', end: '2026-11-07' })
  })

  it('starts on Monday when asked', () => {
    expect(weekRange('2026-11-04', 1)).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(weekRange('2026-11-01', 1)).toEqual({ start: '2026-10-26', end: '2026-11-01' })
    expect(weekRange('2026-11-02', 1)).toEqual({ start: '2026-11-02', end: '2026-11-08' })
  })
})

describe('monthRange and yearRange', () => {
  it('covers the whole month, leap years included', () => {
    expect(monthRange('2026-11-04')).toEqual({ start: '2026-11-01', end: '2026-11-30' })
    expect(monthRange('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthRange('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(monthRange('2026-12-31')).toEqual({ start: '2026-12-01', end: '2026-12-31' })
  })

  it('covers the whole year', () => {
    expect(yearRange('2026-11-04')).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })
})

describe('monthShift', () => {
  it('lands on the first day of the month a number of months away', () => {
    expect(monthShift('2026-11-04', 1)).toBe('2026-12-01')
    expect(monthShift('2026-01-31', -1)).toBe('2025-12-01')
    expect(monthShift('2026-11-04', 0)).toBe('2026-11-01')
    expect(monthShift('2026-11-04', 14)).toBe('2028-01-01')
  })
})

describe('formatting', () => {
  it('writes a long day in each language', () => {
    expect(formatDayLong('2026-11-04', 'en')).toBe('Wednesday, November 4')
    expect(formatDayLong('2026-11-04', 'vi')).toBe('Thứ Tư, 4 tháng 11')
  })

  it('writes a short day in each language', () => {
    expect(formatDayShort('2026-11-04', 'en')).toBe('Nov 4')
    expect(formatDayShort('2026-11-04', 'vi')).toBe('4 thg 11')
  })

  it('writes a month and year in each language', () => {
    expect(formatMonthYear('2026-11-04', 'en')).toBe('November 2026')
    expect(formatMonthYear('2026-11-04', 'vi')).toBe('tháng 11 năm 2026')
  })

  it('writes a weekday in each language, long and short', () => {
    expect(formatWeekdayLong('2026-11-04', 'en')).toBe('Wednesday')
    expect(formatWeekdayLong('2026-11-04', 'vi')).toBe('Thứ Tư')
    expect(formatWeekdayShort('2026-11-04', 'en')).toBe('Wed')
    expect(formatWeekdayShort('2026-11-04', 'vi')).toBe('Thứ 4')
  })

  it('names a weekday by its number', () => {
    expect(formatWeekday(0, 'en')).toBe('Sunday')
    expect(formatWeekday(3, 'en')).toBe('Wednesday')
    expect(formatWeekday(6, 'en')).toBe('Saturday')
    expect(formatWeekday(1, 'vi')).toBe('Thứ Hai')
  })

  it('writes a short month, with and without the year', () => {
    expect(formatMonthShort('2026-10-15', 'en')).toBe('Oct')
    expect(formatMonthShortYear('2026-10-15', 'en')).toBe('Oct 2026')
    expect(formatMonthShort('2026-10-15', 'vi')).toBe('Tháng 10')
  })

  it('writes a range, and one day alone when both ends match', () => {
    expect(formatRange('2026-11-01', '2026-11-07', 'en')).toBe('Nov 1 – Nov 7')
    expect(formatRange('2026-11-04', '2026-11-04', 'en')).toBe('Nov 4')
  })
})

describe('local time helpers', () => {
  it('turns a work date and a typed time into a timestamp and back', () => {
    const ms = localDateTimeToMs('2026-11-04', '14:30')
    expect(ms).toBe(new Date(2026, 10, 4, 14, 30).getTime())
    expect(timeOf(ms)).toBe('14:30')
  })

  it('pads the hour and minute', () => {
    expect(timeOf(new Date(2026, 10, 4, 7, 5).getTime())).toBe('07:05')
  })

  it('writes the time of day in each language', () => {
    // Local time, so the machine's time zone cannot change the hour.
    const ms = new Date(2026, 10, 6, 15, 40).getTime()
    expect(formatTime(ms, 'en')).toContain(':40')
    expect(formatTime(ms, 'vi')).toContain('15:40')
  })
})

describe('formatDatePill', () => {
  it('writes the weekday and month first in English', () => {
    expect(formatDatePill('2026-11-09', 'en')).toBe('Mon 11/9')
    expect(formatDatePill('2026-11-08', 'en')).toBe('Sun 11/8')
  })

  it('writes T2 to T7 and CN with the day first in Vietnamese', () => {
    expect(formatDatePill('2026-11-09', 'vi')).toBe('T2 9/11')
    expect(formatDatePill('2026-11-14', 'vi')).toBe('T7 14/11')
    expect(formatDatePill('2026-11-08', 'vi')).toBe('CN 8/11')
  })
})
