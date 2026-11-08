import { describe, expect, it } from 'vitest'
import { calendarWeeks, colorStep } from '../../src/features/history/calendar.ts'

describe('calendarWeeks', () => {
  it('starts the week on Sunday and never drops a day', () => {
    const weeks = calendarWeeks('2026-11-04', 0)

    expect(weeks[0][0]).toBe('2026-11-01')
    expect(weeks.flat()).toContain('2026-11-30')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('starts the week on Monday when that is the setting', () => {
    const weeks = calendarWeeks('2026-11-04', 1)

    expect(weeks[0][0]).toBe('2026-10-26')
    expect(weeks.flat()).toContain('2026-11-01')
    expect(weeks.every((week) => week.length === 7)).toBe(true)
  })

  it('keeps February 2028, a leap month, whole', () => {
    const days = calendarWeeks('2028-02-10', 0).flat()

    expect(days.filter((day) => day.startsWith('2028-02-'))).toHaveLength(29)
    expect(days).toContain('2028-02-29')
  })
})

describe('colorStep', () => {
  it('gives no colour to a day with no money or when the month is empty', () => {
    expect(colorStep(0, 10000)).toBe(0)
    expect(colorStep(0, 0)).toBe(0)
  })

  it('uses four steps by the share of the month’s best day', () => {
    expect(colorStep(10000, 10000)).toBe(4)
    expect(colorStep(8000, 10000)).toBe(4)
    expect(colorStep(7000, 10000)).toBe(3)
    expect(colorStep(6000, 10000)).toBe(3)
    expect(colorStep(4000, 10000)).toBe(2)
    expect(colorStep(3000, 10000)).toBe(2)
    expect(colorStep(2000, 10000)).toBe(1)
    expect(colorStep(1, 10000)).toBe(1)
  })

  it('treats the best day as the top step even at a small amount', () => {
    expect(colorStep(1, 1)).toBe(4)
  })
})
