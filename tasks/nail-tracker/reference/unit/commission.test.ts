import { describe, expect, it } from 'vitest'
import { commissionCents, turnTotals } from '../../src/domain/commission.ts'

describe('commissionCents', () => {
  it.each([
    // price in cents, rate in basis points (6000 = 60%), expected commission in cents
    [10000, 6000, 6000], // spec: $100 at 60% is $60
    [7500, 6000, 4500], // spec: Gel-X $75 at 60% is $45
    [2000, 7000, 1400], // spec: Nail Art $20 at 70% is $14
    [1999, 6250, 1249], // spec edge case 24: $19.99 at 62.5% is 1249.375 cents
    [1995, 5000, 998], // 997.5 cents rounds half up
    [1, 5000, 1], // 0.5 cents rounds half up
    [1, 4999, 0], // 0.4999 cents rounds down
    [10000, 3333, 3333],
    [0, 6000, 0], // spec edge case 17: zero-dollar service
    [10000, 0, 0], // spec edge case 4: excluded from commission
    [10000, 10000, 10000],
    [99999999, 10000, 99999999],
  ])('%d cents at %d is %d', (price, rate, expected) => {
    expect(commissionCents(price, rate)).toBe(expected)
  })
})

describe('turnTotals', () => {
  it('spec: $100 at 60% with a $10 cash tip and a $15 card tip earns $85', () => {
    expect(turnTotals([{ priceCents: 10000, rateBp: 6000 }], 1000, 1500)).toEqual({
      lineCommissionCents: [6000],
      serviceRevenueTotalCents: 10000,
      commissionTotalCents: 6000,
      earnedTotalCents: 8500,
    })
  })

  it('spec: three services at 60% with a $15 card tip earn $78', () => {
    const lines = [
      { priceCents: 4000, rateBp: 6000 },
      { priceCents: 5000, rateBp: 6000 },
      { priceCents: 1500, rateBp: 6000 },
    ]
    expect(turnTotals(lines, 0, 1500)).toEqual({
      lineCommissionCents: [2400, 3000, 900],
      serviceRevenueTotalCents: 10500,
      commissionTotalCents: 6300,
      earnedTotalCents: 7800,
    })
  })

  it('spec: a different rate per service adds up to $59', () => {
    const lines = [
      { priceCents: 7500, rateBp: 6000 },
      { priceCents: 2000, rateBp: 7000 },
    ]
    expect(turnTotals(lines, 0, 0).commissionTotalCents).toBe(5900)
  })

  it('rounds each service first, then adds the rounded amounts', () => {
    const lines = [
      { priceCents: 1, rateBp: 5000 },
      { priceCents: 1, rateBp: 5000 },
      { priceCents: 1, rateBp: 5000 },
    ]
    expect(turnTotals(lines, 0, 0).commissionTotalCents).toBe(3)
  })

  it('a tip on a zero-commission service still counts as earned', () => {
    expect(turnTotals([{ priceCents: 5000, rateBp: 0 }], 500, 0)).toMatchObject({
      commissionTotalCents: 0,
      earnedTotalCents: 500,
    })
  })

  it('tips are never part of the commission', () => {
    const withTips = turnTotals([{ priceCents: 10000, rateBp: 6000 }], 5000, 5000)
    expect(withTips.commissionTotalCents).toBe(6000)
    expect(withTips.serviceRevenueTotalCents).toBe(10000)
  })

  it('no services and no tips is all zero', () => {
    expect(turnTotals([], 0, 0)).toEqual({
      lineCommissionCents: [],
      serviceRevenueTotalCents: 0,
      commissionTotalCents: 0,
      earnedTotalCents: 0,
    })
  })
})
