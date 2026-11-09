import { describe, expect, it } from 'vitest'
import { dayLabels, shortClock } from '../../src/domain/chartLabels.ts'

describe('dayLabels', () => {
  it('puts the month first in English', () => {
    expect(dayLabels('2026-11-08', 'en')).toEqual({ weekday: 'Sun', date: '11/8' })
    expect(dayLabels('2026-11-09', 'en')).toEqual({ weekday: 'Mon', date: '11/9' })
    expect(dayLabels('2026-11-14', 'en')).toEqual({ weekday: 'Sat', date: '11/14' })
  })

  it('puts the day first in Vietnamese and numbers the weekdays from T2', () => {
    expect(dayLabels('2026-11-08', 'vi')).toEqual({ weekday: 'CN', date: '8/11' })
    expect(dayLabels('2026-11-09', 'vi')).toEqual({ weekday: 'T2', date: '9/11' })
    expect(dayLabels('2026-11-14', 'vi')).toEqual({ weekday: 'T7', date: '14/11' })
  })
})

describe('shortClock', () => {
  const at = (hours: number, minutes: number) => new Date(2026, 10, 9, hours, minutes).getTime()

  it('uses a or p in English and handles noon and midnight', () => {
    expect(shortClock(at(9, 30), 'en')).toBe('9:30a')
    expect(shortClock(at(14, 5), 'en')).toBe('2:05p')
    expect(shortClock(at(12, 0), 'en')).toBe('12:00p')
    expect(shortClock(at(0, 15), 'en')).toBe('12:15a')
  })

  it('uses 24 hours in Vietnamese', () => {
    expect(shortClock(at(9, 30), 'vi')).toBe('9:30')
    expect(shortClock(at(14, 5), 'vi')).toBe('14:05')
  })
})
