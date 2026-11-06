import { describe, expect, it } from 'vitest'
import { customPeriodProblem, missingPeriods, periodContaining, periodId, periodLengthDays } from '../../src/domain/payPeriods.ts'

describe('periodLengthDays', () => {
  it('knows the two fixed schedules', () => {
    expect(periodLengthDays('weekly')).toBe(7)
    expect(periodLengthDays('biweekly')).toBe(14)
  })
})

describe('periodId', () => {
  it('is built from the dates, so two phones agree on it', () => {
    expect(periodId('2026-11-01', '2026-11-07')).toBe('period-2026-11-01-2026-11-07')
  })
})

describe('periodContaining', () => {
  it.each([
    ['2026-11-04', '2026-11-01', 7, '2026-11-01', '2026-11-07'], // spec: November 1-7
    ['2026-11-01', '2026-11-01', 7, '2026-11-01', '2026-11-07'],
    ['2026-11-07', '2026-11-01', 7, '2026-11-01', '2026-11-07'],
    ['2026-11-08', '2026-11-01', 7, '2026-11-08', '2026-11-14'],
    ['2026-10-31', '2026-11-01', 7, '2026-10-25', '2026-10-31'], // a date before the anchor
    ['2026-11-20', '2026-11-01', 14, '2026-11-15', '2026-11-28'],
    ['2026-03-10', '2026-03-08', 7, '2026-03-08', '2026-03-14'], // a clock change inside the period
  ])('%s with anchor %s every %d days is %s to %s', (date, anchor, length, startDate, endDate) => {
    expect(periodContaining(date, anchor, length)).toEqual({ startDate, endDate })
  })
})

describe('missingPeriods', () => {
  const weekly = { type: 'weekly', anchor: '2026-11-01' } as const

  it('makes nothing for a custom schedule, no schedule, or no anchor', () => {
    expect(missingPeriods([], { type: 'custom', anchor: '2026-11-01' }, '2026-11-01', '2026-11-20')).toEqual([])
    expect(missingPeriods([], { type: 'none', anchor: '2026-11-01' }, '2026-11-01', '2026-11-20')).toEqual([])
    expect(missingPeriods([], { type: 'weekly', anchor: null }, '2026-11-01', '2026-11-20')).toEqual([])
  })

  it('covers every period from the earliest date to today, oldest first', () => {
    expect(missingPeriods([], weekly, '2026-11-03', '2026-11-16')).toEqual([
      { startDate: '2026-11-01', endDate: '2026-11-07' },
      { startDate: '2026-11-08', endDate: '2026-11-14' },
      { startDate: '2026-11-15', endDate: '2026-11-21' },
    ])
  })

  it('reaches back before the anchor for an old entry', () => {
    expect(missingPeriods([], weekly, '2026-10-30', '2026-11-02')).toEqual([
      { startDate: '2026-10-25', endDate: '2026-10-31' },
      { startDate: '2026-11-01', endDate: '2026-11-07' },
    ])
  })

  it('skips periods that already exist', () => {
    const existing = [{ startDate: '2026-11-01', endDate: '2026-11-07' }]
    expect(missingPeriods(existing, weekly, '2026-11-03', '2026-11-09')).toEqual([{ startDate: '2026-11-08', endDate: '2026-11-14' }])
  })

  it('never overlaps a period left over from an older schedule', () => {
    const existing = [{ startDate: '2026-10-28', endDate: '2026-11-03' }]
    expect(missingPeriods(existing, weekly, '2026-11-02', '2026-11-09')).toEqual([{ startDate: '2026-11-08', endDate: '2026-11-14' }])
  })
})

describe('customPeriodProblem', () => {
  const existing = [{ id: 'p1', startDate: '2026-11-01', endDate: '2026-11-07' }]

  it('accepts a period that touches nothing', () => {
    expect(customPeriodProblem('2026-11-08', '2026-11-20', existing)).toBeNull()
    expect(customPeriodProblem('2026-10-01', '2026-10-31', existing)).toBeNull()
  })

  it('accepts a one-day period', () => {
    expect(customPeriodProblem('2026-11-08', '2026-11-08', existing)).toBeNull()
  })

  it('rejects an end before the start', () => {
    expect(customPeriodProblem('2026-11-20', '2026-11-08', existing)).toBe('endBeforeStart')
  })

  it('rejects any overlap, including one shared day', () => {
    expect(customPeriodProblem('2026-11-07', '2026-11-10', existing)).toBe('overlap')
    expect(customPeriodProblem('2026-10-25', '2026-11-01', existing)).toBe('overlap')
    expect(customPeriodProblem('2026-11-02', '2026-11-03', existing)).toBe('overlap')
  })

  it('lets a period keep its own dates when it is edited', () => {
    expect(customPeriodProblem('2026-11-01', '2026-11-08', existing, 'p1')).toBeNull()
  })
})
