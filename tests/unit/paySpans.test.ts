import { describe, expect, it } from 'vitest'
import {
  currentPayPeriod,
  payCurrentSpan,
  payPreviousSpan,
  previousPayPeriod,
} from '../../src/domain/paySpans.ts'

const span = (startDate: string, endDate: string) => ({ startDate, endDate })

const weekly = { type: 'weekly', anchor: '2026-11-01' } as const
const biweekly = { type: 'biweekly', anchor: '2026-11-01' } as const
const custom = { type: 'custom', anchor: null } as const
const none = { type: 'none', anchor: null } as const

describe('currentPayPeriod', () => {
  it('is the stored row holding today, whatever the schedule says', () => {
    const stored = [span('2026-10-29', '2026-11-11')]
    expect(currentPayPeriod(stored, weekly, '2026-11-09')).toEqual(stored[0])
    expect(currentPayPeriod(stored, custom, '2026-11-09')).toEqual(stored[0])
    expect(currentPayPeriod(stored, none, '2026-11-09')).toEqual(stored[0])
  })

  it('counts a weekly period from the first day when no row is stored yet', () => {
    expect(currentPayPeriod([], weekly, '2026-11-11')).toEqual(span('2026-11-08', '2026-11-14'))
  })

  it('counts a two-week period from the first day when no row is stored yet', () => {
    expect(currentPayPeriod([], biweekly, '2026-11-11')).toEqual(span('2026-11-01', '2026-11-14'))
    expect(currentPayPeriod([], biweekly, '2026-11-15')).toEqual(span('2026-11-15', '2026-11-28'))
  })

  it('counts the period back from a first day that is still ahead', () => {
    expect(currentPayPeriod([], biweekly, '2026-10-20')).toEqual(span('2026-10-18', '2026-10-31'))
  })

  it('has no period for a custom schedule with no row holding today', () => {
    const stored = [span('2026-10-01', '2026-10-15')]
    expect(currentPayPeriod(stored, custom, '2026-11-09')).toBeNull()
  })

  it('has no period when the schedule is not set or has no first day', () => {
    expect(currentPayPeriod([], none, '2026-11-09')).toBeNull()
    expect(currentPayPeriod([], { type: 'weekly', anchor: null }, '2026-11-09')).toBeNull()
  })
})

describe('previousPayPeriod', () => {
  it('counts the period before a two-week period', () => {
    expect(previousPayPeriod([], biweekly, span('2026-11-01', '2026-11-14'))).toEqual(
      span('2026-10-18', '2026-10-31'),
    )
  })

  it('takes the stored period that ended latest before this one', () => {
    const stored = [span('2026-09-01', '2026-09-30'), span('2026-10-01', '2026-10-20')]
    expect(previousPayPeriod(stored, custom, span('2026-11-01', '2026-11-14'))).toEqual(stored[1])
  })

  it('is nothing when a custom schedule has no earlier row', () => {
    expect(previousPayPeriod([], custom, span('2026-11-01', '2026-11-14'))).toBeNull()
  })
})

describe('the spans compared on Home', () => {
  const current = span('2026-11-01', '2026-11-14')

  it('runs the period from its first day to today', () => {
    expect(payCurrentSpan(current, '2026-11-09')).toEqual({ start: '2026-11-01', end: '2026-11-09' })
  })

  it('runs the previous period as far in as today is into this one', () => {
    expect(payPreviousSpan(current, span('2026-10-18', '2026-10-31'), '2026-11-09')).toEqual({
      start: '2026-10-18',
      end: '2026-10-26',
    })
  })

  it('stops at the end of a shorter previous period', () => {
    expect(payPreviousSpan(current, span('2026-10-25', '2026-10-31'), '2026-11-12')).toEqual({
      start: '2026-10-25',
      end: '2026-10-31',
    })
  })
})
