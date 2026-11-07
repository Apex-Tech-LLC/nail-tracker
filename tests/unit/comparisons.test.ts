import { describe, expect, it } from 'vitest'
import {
  compare,
  currentSpan,
  fillPercent,
  previousSpan,
  weekDays,
} from '../../src/domain/comparisons.ts'

describe('currentSpan', () => {
  it('is today only for the today period', () => {
    expect(currentSpan('today', '2026-11-04', 0)).toEqual({
      start: '2026-11-04',
      end: '2026-11-04',
    })
  })

  it('runs from the week start to today with a Sunday start', () => {
    expect(currentSpan('week', '2026-11-04', 0)).toEqual({
      start: '2026-11-01',
      end: '2026-11-04',
    })
  })

  it('runs from the week start to today with a Monday start', () => {
    expect(currentSpan('week', '2026-11-04', 1)).toEqual({
      start: '2026-11-02',
      end: '2026-11-04',
    })
  })

  it('runs from the first of the month to today', () => {
    expect(currentSpan('month', '2026-11-04', 0)).toEqual({
      start: '2026-11-01',
      end: '2026-11-04',
    })
  })
})

describe('previousSpan', () => {
  it('is the same weekday last week for the today period', () => {
    expect(previousSpan('today', '2026-11-06', 0)).toEqual({
      start: '2026-10-30',
      end: '2026-10-30',
    })
  })

  it('runs last week start to the same weekday with a Sunday start', () => {
    expect(previousSpan('week', '2026-11-04', 0)).toEqual({
      start: '2026-10-25',
      end: '2026-10-28',
    })
  })

  it('runs last week start to the same weekday with a Monday start', () => {
    expect(previousSpan('week', '2026-11-04', 1)).toEqual({
      start: '2026-10-26',
      end: '2026-10-28',
    })
  })

  it('is one day when today is the week start', () => {
    expect(previousSpan('week', '2026-11-01', 0)).toEqual({
      start: '2026-10-25',
      end: '2026-10-25',
    })
  })

  it('caps the same day number at the end of a shorter month', () => {
    expect(previousSpan('month', '2026-03-31', 0)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    })
    expect(previousSpan('month', '2028-03-31', 0)).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    })
  })

  it('crosses the year boundary in January', () => {
    expect(previousSpan('month', '2026-01-15', 0)).toEqual({
      start: '2025-12-01',
      end: '2025-12-15',
    })
  })
})

describe('compare', () => {
  it('reports more with a positive difference', () => {
    expect(compare(64000, 49800, 12)).toEqual({ kind: 'more', differenceCents: 14200 })
  })

  it('reports less with a positive difference', () => {
    expect(compare(100, 300, 1)).toEqual({ kind: 'less', differenceCents: 200 })
  })

  it('reports same with no difference', () => {
    expect(compare(500, 500, 2)).toEqual({ kind: 'same', differenceCents: 0 })
  })

  it('reports nothing to compare when last time had no turns', () => {
    expect(compare(500, 0, 0)).toEqual({ kind: 'nothingToCompare', differenceCents: 0 })
  })
})

describe('weekDays', () => {
  it('returns seven days in order from the week start', () => {
    const days = weekDays('2026-11-04', 0, new Map())
    expect(days.map((day) => day.date)).toEqual([
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ])
  })

  it('marks today and future days', () => {
    const days = weekDays('2026-11-04', 0, new Map())
    expect(days.filter((day) => day.isToday).map((day) => day.date)).toEqual(['2026-11-04'])
    expect(days.filter((day) => day.isFuture).map((day) => day.date)).toEqual([
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
    ])
  })

  it('reads this week and last week by date', () => {
    const earned = new Map([
      ['2026-11-02', 12000],
      ['2026-10-26', 8000],
      ['2026-10-01', 99999],
    ])
    const days = weekDays('2026-11-04', 0, earned)
    expect(days.find((day) => day.date === '2026-11-02')).toEqual({
      date: '2026-11-02',
      earnedCents: 12000,
      isFuture: false,
      isToday: false,
      lastWeekEarnedCents: 8000,
    })
    expect(days.find((day) => day.date === '2026-11-03')?.earnedCents).toBe(0)
  })
})

describe('fillPercent', () => {
  it('is zero when there is nothing to measure', () => {
    expect(fillPercent(0, 0)).toBe(0)
  })

  it('is the rounded share of the largest value', () => {
    expect(fillPercent(150, 300)).toBe(50)
    expect(fillPercent(100, 300)).toBe(33)
    expect(fillPercent(300, 300)).toBe(100)
  })
})
