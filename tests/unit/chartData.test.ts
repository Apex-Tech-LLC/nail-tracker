import { describe, expect, it } from 'vitest'
import type { AdjustmentFigures, TurnFigures } from '../../src/domain/totals.ts'
import { buildBars, chartMax } from '../../src/features/earnings/chartData.ts'

const turn = (overrides: Partial<TurnFigures> = {}): TurnFigures => ({
  localWorkDate: '2026-11-03',
  turnCount: 1,
  serviceRevenueTotalCents: 0,
  commissionTotalCents: 0,
  cashTipCents: 0,
  cardTipCents: 0,
  cashTipReceived: true,
  cardTipReceived: false,
  ...overrides,
})

const adjustment = (
  amountCents: number,
  localWorkDate = '2026-11-03',
  category: AdjustmentFigures['category'] = 'bonus',
): AdjustmentFigures & { localWorkDate: string } => ({ amountCents, category, localWorkDate })

const bar = (earnedCents: number, revenueCents: number) => ({
  key: '2026-11-03',
  label: '3',
  earnedCents,
  revenueCents,
})

describe('buildBars', () => {
  it('a week gets one bar per day, with the earned and revenue money on its day', () => {
    const bars = buildBars(
      [turn({ commissionTotalCents: 6000, serviceRevenueTotalCents: 10000 })],
      [],
      '2026-11-01',
      '2026-11-07',
      0,
      'en',
    )

    expect(bars.map((item) => item.label)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(bars[2]).toMatchObject({ earnedCents: 6000, revenueCents: 10000 })
    expect(bars.filter((_, index) => index !== 2).every((item) => item.earnedCents === 0 && item.revenueCents === 0)).toBe(true)
  })

  it('an adjustment lands on its day and changes earned', () => {
    const bars = buildBars(
      [turn({ commissionTotalCents: 6000, serviceRevenueTotalCents: 10000 })],
      [adjustment(-500)],
      '2026-11-01',
      '2026-11-07',
      0,
      'en',
    )

    expect(bars[2].earnedCents).toBe(5500)
  })

  it('a month of 30 days gets 30 bars', () => {
    const bars = buildBars([], [], '2026-11-01', '2026-11-30', 0, 'en')

    expect(bars).toHaveLength(30)
  })

  it('a 60-day range uses whole weeks, starting at the week holding the start date', () => {
    const bars = buildBars(
      [turn({ localWorkDate: '2026-08-31', commissionTotalCents: 9900 })],
      [],
      '2026-09-01',
      '2026-10-30',
      0,
      'en',
    )

    expect(bars).toHaveLength(9)
    expect(bars[0].key).toBe('2026-08-30')
    // Aug 31 sits in the first week's bar but outside the range, so it is left out.
    expect(bars[0]).toMatchObject({ earnedCents: 0, revenueCents: 0 })
  })

  it('a year gets 12 English month bars', () => {
    const bars = buildBars([], [], '2026-01-01', '2026-12-31', 0, 'en')

    expect(bars).toHaveLength(12)
    expect(bars[0].label).toBe('Jan')
    expect(bars[11].label).toBe('Dec')
  })

  it('a year gets 12 Vietnamese month bars', () => {
    const bars = buildBars([], [], '2026-01-01', '2026-12-31', 0, 'vi')

    expect(bars).toHaveLength(12)
    expect(bars[0].label).toBe('T1')
    expect(bars[11].label).toBe('T12')
  })

  it('month bars run in order across the new year', () => {
    const bars = buildBars([], [], '2026-12-01', '2027-04-30', 0, 'en')

    expect(bars.map((item) => item.key)).toEqual([
      '2026-12-01',
      '2027-01-01',
      '2027-02-01',
      '2027-03-01',
      '2027-04-01',
    ])
    expect(bars.map((item) => item.label)).toEqual(['Dec', 'Jan', 'Feb', 'Mar', 'Apr'])
  })
})

describe('chartMax', () => {
  it('is the largest value across both series', () => {
    expect(chartMax([bar(100, 0), bar(0, 200)])).toBe(200)
  })

  it('is at least 1 so an empty chart cannot divide by zero', () => {
    expect(chartMax([])).toBe(1)
  })
})
