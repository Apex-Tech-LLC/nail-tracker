import { describe, expect, it } from 'vitest'
import { rangeOf, reportKindOf, stepDate } from '../../src/features/reports/reportsRange.ts'

describe('rangeOf', () => {
  it('a day is that one day', () => {
    expect(rangeOf('day', '2026-11-04', 0)).toEqual({
      start: '2026-11-04',
      end: '2026-11-04',
    })
  })

  it('a week starts on the chosen first day of the week', () => {
    expect(rangeOf('week', '2026-11-04', 1)).toEqual({
      start: '2026-11-02',
      end: '2026-11-08',
    })
  })

  it('a month covers the whole month, including a short February', () => {
    expect(rangeOf('month', '2026-02-10', 0)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
  })

  it('a year covers January 1 to December 31', () => {
    expect(rangeOf('year', '2026-11-04', 0)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    })
  })
})

describe('stepDate', () => {
  it('a day moves one real day across a month boundary', () => {
    expect(stepDate('day', '2026-11-01', -1)).toBe('2026-10-31')
  })

  it('a week moves seven days', () => {
    expect(stepDate('week', '2026-11-04', 1)).toBe('2026-11-11')
  })

  it('a month back lands on the last day of the previous month', () => {
    expect(stepDate('month', '2026-03-31', -1)).toBe('2026-02-28')
  })

  it('a month forward lands on the first day of the next month', () => {
    expect(stepDate('month', '2026-01-31', 1)).toBe('2026-02-01')
  })

  it('a year back lands on the last day of the previous year', () => {
    expect(stepDate('year', '2026-11-04', -1)).toBe('2025-12-31')
  })
})

describe('reportKindOf', () => {
  it('reads one day through the week rules, so it compares with the same weekday last week', () => {
    expect(reportKindOf('day')).toBe('week')
  })

  it('keeps every other period as it is', () => {
    expect(reportKindOf('week')).toBe('week')
    expect(reportKindOf('month')).toBe('month')
    expect(reportKindOf('year')).toBe('year')
    expect(reportKindOf('custom')).toBe('custom')
  })
})
