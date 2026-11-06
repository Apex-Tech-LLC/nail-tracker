import { describe, expect, it } from 'vitest'
import { rangeOf, stepDate } from '../../src/features/earnings/earningsRange.ts'

describe('rangeOf', () => {
  it('daily is that one day', () => {
    expect(rangeOf('daily', '2026-11-04', 0)).toEqual({
      start: '2026-11-04',
      end: '2026-11-04',
    })
  })

  it('weekly starts on the chosen first day of the week', () => {
    expect(rangeOf('weekly', '2026-11-04', 1)).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    })
  })

  it('monthly covers the whole month, including a short February', () => {
    expect(rangeOf('monthly', '2026-02-10', 0)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('yearly covers January 1 to December 31', () => {
    expect(rangeOf('yearly', '2026-11-04', 0)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
  })
})

describe('stepDate', () => {
  it('daily moves one real day across a month boundary', () => {
    expect(stepDate('daily', '2026-11-01', -1)).toBe('2026-10-31')
  })

  it('weekly moves seven days', () => {
    expect(stepDate('weekly', '2026-11-04', 1)).toBe('2026-11-11')
  })

  it('monthly back lands on the last day of the previous month', () => {
    expect(stepDate('monthly', '2026-03-31', -1)).toBe('2026-02-28')
  })

  it('monthly forward lands on the first day of the next month', () => {
    expect(stepDate('monthly', '2026-01-31', 1)).toBe('2026-02-01')
  })

  it('yearly back lands on the last day of the previous year', () => {
    expect(stepDate('yearly', '2026-11-04', -1)).toBe('2025-12-31')
  })
})
